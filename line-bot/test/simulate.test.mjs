// 「測試」指令:穆穆用客人視角試小精靈
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from '../src/handler.js';
import { ESCALATE_REPLY, GREETING } from '../src/reply.js';
import * as state from '../src/state.js';
import { mockEnv, stubFetch } from './helpers.mjs';

const msg = (uid, text) => ({
  type: 'message',
  replyToken: 'rt-1',
  source: { type: 'user', userId: uid },
  message: { type: 'text', text },
});

test('測試指令:走完整客服流程,答案回到穆穆的視窗', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: 'jpg / psd / ai 都可以喲' });
  try {
    await state.setAdminId(env, 'U-mumu');
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U-mumu', '測試 可以用什麼格式'));
    assert.equal(f.llmCalls().length, 1, '要真的呼叫 AI');
    const r = f.replies().at(-1);
    assert.ok(r.startsWith(GREETING), '要看到跟客人一模一樣的首次問候');
    assert.ok(r.includes('jpg / psd / ai'));
  } finally { f.restore(); }
});

test('測試指令:查無資料 → AI 看全表判斷、沒把握就轉人工,靜音只落在模擬房', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '[[轉人工]]' });
  try {
    await state.setAdminId(env, 'U-mumu');
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U-mumu', '測試 我可以參觀工作室嗎'));
    assert.equal(f.replies().at(-1), ESCALATE_REPLY, '要看到客人視角的轉人工留言');
    assert.equal(await state.isMuted(env, 'sim:U-mumu'), true, '模擬房被靜音');
    assert.equal(await state.isMuted(env, 'U-mumu'), false, '穆穆本人的房間不可被靜音');

    // 模擬房的靜音不影響下一次測試(simulated 跳過靜音判斷)
    await handleEvent(env, msg('U-mumu', '測試 我可以參觀工作室嗎'));
    assert.equal(f.replies().at(-1), ESCALATE_REPLY, '再測一次仍要有回應');
  } finally { f.restore(); }
});

test('測試指令:就算上班(靜默)模式也能預覽小精靈的回答', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '出血留 3mm 喔' });
  try {
    await state.setAdminId(env, 'U-mumu');
    await state.setMode(env, 'force_on_duty'); // 靜默中
    await handleEvent(env, msg('U-mumu', '測試 出血要留多少'));
    assert.ok(f.replies().at(-1).includes('出血留 3mm'), '測試不受靜默模式影響');
  } finally { f.restore(); }
});

test('光說「測試」兩個字(沒接問題)→ 回指令說明,不進客服流程', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setAdminId(env, 'U-mumu');
    await handleEvent(env, msg('U-mumu', '測試'));
    assert.ok(f.replies().at(-1).includes('測試 你的問題'), '應回指令清單');
    assert.equal(f.llmCalls().length, 0);
  } finally { f.restore(); }
});
