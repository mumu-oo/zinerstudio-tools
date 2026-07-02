// 端對端決策鏈:一則 LINE 訊息進來後,小精靈的每一種反應
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from '../src/handler.js';
import { ESCALATE_REPLY, OFF_SCOPE_REPLY, GREETING, ESCALATE_SENTINEL } from '../src/reply.js';
import * as state from '../src/state.js';
import { mockEnv, stubFetch } from './helpers.mjs';

const msg = (uid, text) => ({
  type: 'message',
  replyToken: 'rt-1',
  source: { type: 'user', userId: uid },
  message: { type: 'text', text },
});

test('穆穆值班(上班模式)→ 小精靈一個字都不發', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_on_duty');
    await handleEvent(env, msg('U1', '可以用什麼格式'));
    assert.equal(f.calls.length, 0, `不該有任何對外呼叫:${JSON.stringify(f.calls.map((c) => c.url))}`);
  } finally { f.restore(); }
});

test('小精靈值班 + 知識庫命中 → 首次回覆帶問候語與結尾', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '可以用 jpg / psd / ai 喲～' });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U1', '可以用什麼格式'));
    assert.equal(f.llmCalls().length, 1);
    // system prompt 必須含知識庫原文,不是模型自由發揮
    const sys = f.llmCalls()[0].body.messages[0].content;
    assert.ok(sys.includes('jpg / psd / ai'), 'system prompt 應包含檔案格式條目');
    const r = f.replies();
    assert.equal(r.length, 1);
    assert.ok(r[0].startsWith(GREETING), '首次回覆要有問候語');
    assert.ok(r[0].includes('MUMU 本人將於上班時段回覆'), '首次回覆要有結尾說明');
  } finally { f.restore(); }
});

test('第二輪對話 → 不再重複問候語', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '出血留 3mm 喔' });
  try {
    await state.setMode(env, 'force_off_duty');
    await state.pushHistory(env, 'U1', 'user', '前一題');
    await state.pushHistory(env, 'U1', 'assistant', '前一答');
    await handleEvent(env, msg('U1', '出血要留多少'));
    const r = f.replies();
    assert.ok(!r[0].startsWith(GREETING), '第二輪不該再問候');
    // 對話記憶要進到模型
    const sent = f.llmCalls()[0].body.messages;
    assert.ok(sent.some((m) => m.content === '前一題'), '要帶上下文');
  } finally { f.restore(); }
});

test('查無資料 → 轉人工留言、該房靜音、不呼叫 AI、通知 Discord', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U2', '請問可以贊助我們嗎'));
    assert.equal(f.llmCalls().length, 0, '查無資料不可花錢呼叫 AI');
    assert.equal(f.replies()[0], ESCALATE_REPLY);
    assert.equal(await state.isMuted(env, 'U2'), true, '轉人工後應靜音');
    assert.ok(f.calls.some((c) => c.url.includes('discord')), '要通知穆穆');

    // 靜音後再來訊息 → 完全沉默
    const before = f.calls.length;
    await handleEvent(env, msg('U2', '在嗎?'));
    assert.equal(f.calls.length, before, '靜音房不該有任何回應');
  } finally { f.restore(); }
});

test('範圍外業務(貼紙)→ 罐頭婉拒,不呼叫 AI', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U3', '可以印貼紙嗎'));
    assert.equal(f.llmCalls().length, 0);
    assert.equal(f.replies()[0], OFF_SCOPE_REPLY);
  } finally { f.restore(); }
});

test('AI 自己說沒把握(sentinel)→ 轉人工', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: ESCALATE_SENTINEL });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U4', '三色單面大概幾個工作天'));
    assert.equal(f.replies()[0], ESCALATE_REPLY);
    assert.equal(await state.isMuted(env, 'U4'), true);
  } finally { f.restore(); }
});

test('認主 → 指令通道啟用,錯密語則當一般客人', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');

    // 錯密語:不動聲色(走客服流程 → 查無資料轉人工)
    await handleEvent(env, msg('U-hacker', '認主 亂猜的'));
    assert.equal(await state.getAdminId(env), null);

    // 正確密語
    await handleEvent(env, msg('U-mumu', '認主 孔版之心'));
    assert.equal(await state.getAdminId(env), 'U-mumu');
    assert.ok(f.replies().at(-1).includes('認主成功'));

    // 下指令:上班 → 靜默
    await handleEvent(env, msg('U-mumu', '上班'));
    assert.equal(await state.getMode(env), 'force_on_duty');

    // 客人訊息 → 沉默;穆穆的「狀態」→ 有回應
    const before = f.calls.length;
    await handleEvent(env, msg('U5', '可以用什麼格式'));
    assert.equal(f.calls.length, before);
    await handleEvent(env, msg('U-mumu', '狀態'));
    assert.ok(f.replies().at(-1).includes('模式'));
  } finally { f.restore(); }
});

test('接手/放行單一聊天室', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '好的喲' });
  try {
    await state.setMode(env, 'force_off_duty');
    await state.setAdminId(env, 'U-mumu');
    const sid = await state.indexRoom(env, 'U6');

    await handleEvent(env, msg('U-mumu', `接手 #${sid}`));
    assert.equal(await state.isMuted(env, 'U6'), true);

    const before = f.llmCalls().length;
    await handleEvent(env, msg('U6', '可以用什麼格式'));
    assert.equal(f.llmCalls().length, before, '被接手的房間不呼叫 AI');

    await handleEvent(env, msg('U-mumu', `放行 #${sid}`));
    assert.equal(await state.isMuted(env, 'U6'), false);
    await handleEvent(env, msg('U6', '可以用什麼格式'));
    assert.equal(f.llmCalls().length, before + 1, '放行後恢復服務');
  } finally { f.restore(); }
});
