// 排程判斷 — 全部用 Asia/Taipei，絕不吐 UTC 給人看
// Sheet 欄：「排程時段」（穆穆填，格式 M/D 或 M/D HH:MM 或 YYYY-MM-DD ...）
//          「發文狀態」（程式填：pending / posted / retry:N / failed）

const TZ = 'Asia/Taipei';

/** 現在的台北時間，回 { y, m, d, hh, mm, dateKey:'2026-09-18', hm:'09:00' } */
export function nowTaipei(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]),
  );
  const hh = p.hour === '24' ? '00' : p.hour;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +hh, mm: +p.minute, dateKey: `${p.year}-${p.month}-${p.day}`, hm: `${hh}:${p.minute}` };
}

/**
 * 解析穆穆填的「排程時段」→ { dateKey, slotIdx|null }
 * 接受：'9/18' / '09/18' / '2026-09-18' / '9/18 12:00' / '9/18 #2'（第 2 個時段）
 * 沒寫時間 → slotIdx null（＝這天任一 slot 都可以排，由 assignSlots 分配）
 */
export function parseSchedule(raw, year = nowTaipei().y) {
  const s = (raw || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(.*))?$/);
  let y, mo, d, rest;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
  else {
    m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:\s+(.*))?$/);
    if (!m) return null;
    y = year; mo = +m[1]; d = +m[2]; rest = m[3];
  }
  const dateKey = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  let slotHm = null, slotIdx = null;
  if (rest) {
    const t = rest.match(/(\d{1,2}):(\d{2})/);
    const n = rest.match(/#(\d)/);
    if (t) slotHm = `${t[1].padStart(2, '0')}:${t[2]}`;
    else if (n) slotIdx = +n[1] - 1;
  }
  return { dateKey, slotHm, slotIdx };
}

export function slots(env) {
  return (env.POST_SLOTS || '09:00,12:00,15:00,18:00,21:00').split(',').map((s) => s.trim());
}

/**
 * 找「這一輪要發」的列。
 * 規則：同一天內、沒指定時段的列，按 Sheet 順序依次配到 slot[0..4]；
 *       超過 5 列的當天多出來的 → 排到 slot 最後一個之後不會發（記 log 提醒穆穆）。
 * 一輪 = cron 15 分掃一次；「該發」= slot 時間 <= 現在 且 狀態不是 posted/failed。
 * 為避免同一 slot 被下一輪重發，posted 立刻寫回 Sheet。
 */
export function pickDue(rows, env, now = nowTaipei()) {
  const S = slots(env);
  const today = rows
    .map((r) => ({ r, sch: parseSchedule(r['排程時段'], now.y) }))
    .filter((x) => x.sch && x.sch.dateKey === now.dateKey);

  // 分配時段
  let auto = 0;
  const assigned = today.map((x) => {
    let hm = x.sch.slotHm;
    if (!hm && x.sch.slotIdx != null) hm = S[x.sch.slotIdx] ?? null;
    if (!hm) hm = S[auto++] ?? null; // 沒指定 → 依序自動配
    return { ...x, hm };
  });

  const overflow = assigned.filter((x) => !x.hm);
  const due = assigned.filter((x) => {
    if (!x.hm) return false;
    const st = (x.r['發文狀態'] || '').trim();
    if (st.startsWith('posted') || st.startsWith('failed')) return false;
    return x.hm <= now.hm;
  });
  return { due, overflow, all: assigned };
}
