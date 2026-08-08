// 防洗訊息與範圍守門:所有「不花錢就能擋掉」的判斷都在這裡,順序在呼叫 AI 之前。

import { LIMITS, OFF_SCOPE_PATTERNS, BOOPOS_PATTERN } from './config.js';
import * as state from './state.js';

export function isOffScope(text) {
  const t = String(text || '');
  return OFF_SCOPE_PATTERNS.some((p) => t.includes(p));
}

export function isBooPos(text) {
  return BOOPOS_PATTERN.test(String(text || ''));
}

export function isTooLong(text) {
  return String(text || '').length > LIMITS.maxMsgLen;
}

// 回傳 { ok:true } 或 { ok:false, reason:'burst'|'user_daily'|'global_daily' }
export async function checkBudget(env, uid, now = new Date()) {
  const burst = await state.bumpBurst(env, now);
  if (burst > LIMITS.burstPer10Min) return { ok: false, reason: 'burst', burst };
  const user = await state.bumpUserDaily(env, uid, now);
  if (user > LIMITS.perUserDaily) return { ok: false, reason: 'user_daily' };
  const global = await state.bumpGlobalDaily(env, now);
  if (global > LIMITS.globalDaily) return { ok: false, reason: 'global_daily' };
  return { ok: true };
}
