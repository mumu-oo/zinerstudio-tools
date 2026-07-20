// 狀態機:全域值班模式 + 單一聊天室狀態 + 用量計數,全部放 Cloudflare KV。
// KV 是最終一致性的儲存,計數器極端情況會少算一兩次——當「上限保險絲」夠用,不是記帳。

import { BUSINESS_HOURS, LIMITS } from './config.js';

// ---- 時間(全部以台北時間判斷,台灣無日光節約) ----
export function taipeiNow(now = new Date()) {
  const t = new Date(now.getTime() + BUSINESS_HOURS.utcOffset * 3600_000);
  return {
    day: t.getUTCDay(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    dateKey: t.toISOString().slice(0, 10), // 以台北時間換日
  };
}

export function isBusinessHours(now = new Date()) {
  const { day, hour } = taipeiNow(now);
  return BUSINESS_HOURS.days.includes(day) && hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour;
}

// 給 system prompt 用的日期標籤,例:2026-07-03(週五)
export function taipeiDateLabel(now = new Date()) {
  const { dateKey, day } = taipeiNow(now);
  return `${dateKey}(週${'日一二三四五六'[day]})`;
}

// ---- 全域模式 ----
// 'schedule'       依上班時間表自動切(預設)
// 'force_on_duty'  穆穆值班:小精靈強制靜默(指令「上班」)
// 'force_off_duty' 小精靈值班:強制接手(指令「下班」)
export async function getMode(env) {
  return (await env.STATE.get('mode')) || 'schedule';
}
export async function setMode(env, mode) {
  await env.STATE.put('mode', mode);
}
export async function isBotActive(env, now = new Date()) {
  const mode = await getMode(env);
  if (mode === 'force_on_duty') return false;
  if (mode === 'force_off_duty') return true;
  return !isBusinessHours(now);
}

// ---- 管理員(穆穆本人的 LINE userId,由「認主」指令綁定) ----
export async function getAdminId(env) {
  return env.STATE.get('admin_uid');
}
export async function setAdminId(env, uid) {
  await env.STATE.put('admin_uid', uid);
}

// ---- 聊天室:短代號、靜音、對話記憶 ----
export function shortId(uid) {
  // 給穆穆看的 4 碼代號(FNV-1a),同一位客人永遠同代號
  let h = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).slice(0, 4);
}

export async function indexRoom(env, uid) {
  const sid = shortId(uid);
  await env.STATE.put(`rid:${sid}`, uid, { expirationTtl: 30 * 24 * 3600 });
  return sid;
}
export async function resolveRoom(env, sid) {
  return env.STATE.get(`rid:${sid}`);
}

export async function muteRoom(env, uid, ttl = LIMITS.muteTtlSec) {
  await env.STATE.put(`mute:${uid}`, '1', { expirationTtl: ttl });
}
export async function unmuteRoom(env, uid) {
  await env.STATE.delete(`mute:${uid}`);
}
export async function isMuted(env, uid) {
  return (await env.STATE.get(`mute:${uid}`)) !== null;
}

export async function getHistory(env, uid) {
  const raw = await env.STATE.get(`hist:${uid}`);
  return raw ? JSON.parse(raw) : [];
}
export async function pushHistory(env, uid, role, content) {
  const hist = await getHistory(env, uid);
  hist.push({ role, content });
  while (hist.length > LIMITS.historyTurns) hist.shift();
  await env.STATE.put(`hist:${uid}`, JSON.stringify(hist), { expirationTtl: LIMITS.historyTtlSec });
}

// ---- 計數器(每日/突發) ----
async function bump(env, key, ttl) {
  const n = parseInt((await env.STATE.get(key)) || '0', 10) + 1;
  await env.STATE.put(key, String(n), { expirationTtl: ttl });
  return n;
}
export async function bumpUserDaily(env, uid, now = new Date()) {
  const { dateKey } = taipeiNow(now);
  return bump(env, `cnt:u:${uid}:${dateKey}`, 26 * 3600);
}
export async function bumpGlobalDaily(env, now = new Date()) {
  const { dateKey } = taipeiNow(now);
  return bump(env, `cnt:g:${dateKey}`, 26 * 3600);
}
export async function bumpBurst(env, now = new Date()) {
  const bucket = Math.floor(now.getTime() / 600_000); // 10 分鐘一格
  return bump(env, `cnt:b:${bucket}`, 1200);
}
export async function getCounters(env, now = new Date()) {
  const { dateKey } = taipeiNow(now);
  const g = parseInt((await env.STATE.get(`cnt:g:${dateKey}`)) || '0', 10);
  return { globalDaily: g, dateKey };
}

// ---- 對話紀錄(留 14 天,supabase/Sheets 之後要再說) ----
export async function logExchange(env, uid, kind, q, a) {
  const key = `log:${Date.now()}:${shortId(uid)}`;
  await env.STATE.put(key, JSON.stringify({ uid, kind, q, a }), { expirationTtl: LIMITS.logTtlSec });
}

// 「查帳」用:掃全 log,依 sid 去重,回最近 N 位互動客人
export async function recentRooms(env, { limit = 10 } = {}) {
  const rows = [];
  let cursor;
  do {
    const res = await env.STATE.list({ prefix: 'log:', cursor, limit: 1000 });
    for (const k of res.keys) rows.push(k.name);
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor && rows.length < 4000);
  rows.sort().reverse(); // 時間戳倒序
  const seen = new Set();
  const picked = [];
  for (const name of rows) {
    const parts = name.split(':');
    const ts = Number(parts[1]);
    const sid = parts[2];
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    const raw = await env.STATE.get(name);
    if (!raw) continue;
    let entry;
    try { entry = JSON.parse(raw); } catch { continue; }
    picked.push({ sid, ts, kind: entry.kind, q: entry.q, uid: entry.uid });
    if (picked.length >= limit) break;
  }
  return picked;
}

// 「看 #代號」用:某位客人最近幾則對話
export async function recentByRoom(env, sid, { limit = 3 } = {}) {
  const rows = [];
  let cursor;
  do {
    const res = await env.STATE.list({ prefix: 'log:', cursor, limit: 1000 });
    for (const k of res.keys) {
      if (k.name.endsWith(`:${sid}`)) rows.push(k.name);
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor && rows.length < 200);
  rows.sort().reverse();
  const out = [];
  for (const name of rows.slice(0, limit)) {
    const raw = await env.STATE.get(name);
    if (!raw) continue;
    let entry;
    try { entry = JSON.parse(raw); } catch { continue; }
    out.push({ ts: Number(name.split(':')[1]), ...entry });
  }
  return out;
}
