// 上下文追問與「測試」豁免額度
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from '../src/handler.js';
import { ESCALATE_REPLY } from '../src/reply.js';
import * as state from '../src/state.js';
import { retrieve } from '../src/kb.js';
import { LIMITS } from '../src/config.js';
import { mockEnv, stubFetch } from './helpers.mjs';

const msg = (uid, text) => ({
  type: 'message',
  replyToken: 'rt-1',
  source: { type: 'user', userId: uid },
  message: { type: 'text', text },
});

test('追問靠上下文:「這樣的話沒問題嗎?」單獨查無資料,有對話脈絡就接得住', async () => {
  const followUp = '這樣的話沒問題嗎？';
  assert.equal(retrieve(followUp).length, 0, '前提:這句單獨檢索必須查無資料');

  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '沒問題喲' });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U7', '我想印A3滿版可以嗎'));
    assert.equal(f.llmCalls().length, 1);
    await handleEvent(env, msg('U7', followUp));
    assert.equal(f.llmCalls().length, 2, '追問要靠脈絡進 AI,不可轉人工');
    assert.equal(await state.isMuted(env, 'U7'), false, '不該被轉人工靜音');
  } finally { f.restore(); }
});

test('沒有脈絡的無關訊息 → 仍然轉人工(上下文檢索不會濫開大門)', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U8', '這樣的話沒問題嗎？'));
    assert.equal(f.llmCalls().length, 0);
    assert.equal(f.replies()[0], ESCALATE_REPLY);
  } finally { f.restore(); }
});

test('「測試」不佔每日額度:連測超過上限也照樣回答', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '好喲' });
  try {
    await state.setAdminId(env, 'U-mumu');
    await state.setMode(env, 'force_off_duty');
    const rounds = LIMITS.perUserDaily + 5;
    for (let i = 0; i < rounds; i++) {
      await handleEvent(env, msg('U-mumu', '測試 可以用什麼格式'));
    }
    assert.equal(f.llmCalls().length, rounds, `全部 ${rounds} 次都要真的回答,不可被額度罐頭擋下`);
  } finally { f.restore(); }
});
