// 守門與狀態機:額度、範圍外、靜音、模式切換(KV 用記憶體假貨)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOffScope, isTooLong, checkBudget } from '../src/guard.js';
import * as state from '../src/state.js';
import { LIMITS } from '../src/config.js';
import { mockEnv } from './helpers.mjs';

test('貼紙/盒子 → 範圍外;燙金不算(交給知識庫解釋金墨)', () => {
  assert.equal(isOffScope('可以印貼紙嗎'), true);
  assert.equal(isOffScope('想做紙盒'), true);
  assert.equal(isOffScope('請問可以燙金嗎'), false);
  assert.equal(isOffScope('出血要留多少'), false);
});

test('超長訊息擋下', () => {
  assert.equal(isTooLong('a'.repeat(LIMITS.maxMsgLen + 1)), true);
  assert.equal(isTooLong('正常訊息'), false);
});

test('單人每日額度:第 11 次改罐頭', async () => {
  const env = mockEnv();
  let last;
  for (let i = 0; i < LIMITS.perUserDaily + 1; i++) last = await checkBudget(env, 'U1');
  assert.equal(last.ok, false);
  assert.equal(last.reason, 'user_daily');
});

test('模式切換與靜音', async () => {
  const env = mockEnv();
  assert.equal(await state.getMode(env), 'schedule');
  await state.setMode(env, 'force_off_duty');
  assert.equal(await state.isBotActive(env), true);
  await state.setMode(env, 'force_on_duty');
  assert.equal(await state.isBotActive(env), false);

  await state.muteRoom(env, 'U9');
  assert.equal(await state.isMuted(env, 'U9'), true);
  await state.unmuteRoom(env, 'U9');
  assert.equal(await state.isMuted(env, 'U9'), false);
});

test('聊天室代號:穩定、可反查', async () => {
  const env = mockEnv();
  const sid = await state.indexRoom(env, 'U-abcdef123456');
  assert.equal(state.shortId('U-abcdef123456'), sid);
  assert.equal(await state.resolveRoom(env, sid), 'U-abcdef123456');
});

test('對話記憶:超過上限會遺忘最舊的', async () => {
  const env = mockEnv();
  for (let i = 1; i <= LIMITS.historyTurns + 2; i++) {
    await state.pushHistory(env, 'U1', 'user', `msg${i}`);
  }
  const hist = await state.getHistory(env, 'U1');
  assert.equal(hist.length, LIMITS.historyTurns);
  assert.equal(hist[0].content, 'msg3');
});
