// 保命三件+查帳的核心行為(2026-07-21):
// ① 七項齊全走暖罐頭 ESCALATE_QUOTE_BODY;
// ② 模式切換/接手/放行都推 Discord;
// ③ 查帳/看指令能運作
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from '../src/handler.js';
import { handleAdminMessage } from '../src/commands.js';
import { ESCALATE_QUOTE_BODY, ESCALATE_QUOTE_SENTINEL, composeReply } from '../src/reply.js';
import * as state from '../src/state.js';
import { mockEnv, stubFetch } from './helpers.mjs';

const msg = (uid, text) => ({
  type: 'message',
  replyToken: 'rt-1',
  source: { type: 'user', userId: uid },
  message: { type: 'text', text },
});

test('①七項齊全 → AI 吐估價暗號 → 客人收到暖罐頭(不是冷「等聯繫」)', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch({ llmAnswer: ESCALATE_QUOTE_SENTINEL });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U-quote', '想估價 完整表格...'));
    const r = f.replies()[0];
    assert.equal(r, composeReply(ESCALATE_QUOTE_BODY, { sessionStart: true }).text);
    assert.ok(!r.includes('MUMU 上班後會依序與您聯繫'), '不該是冷版通用罐頭');
    assert.ok(r.includes('www.zinerstudio.com/quote'), '暖罐頭要附試算機(2026-08-09 引擎退場後改導網)');
    assert.ok(r.includes('www.zinerstudio.com/order'), '暖罐頭要附官網下單頁');
    const dc = f.calls.filter((c) => c.url.includes('discord'));
    assert.ok(dc.length >= 1, '要通知 Discord');
    assert.ok(dc[0].body.embeds[0].description.includes('估價單'), 'Discord 卡片要標明是估價');
  } finally { f.restore(); }
});

test('②模式切換三種都推 Discord', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    await state.setAdminId(env, 'U-mumu');
    for (const cmd of ['上工', '收工', '交給排程']) {
      await handleAdminMessage(env, 'U-mumu', cmd);
    }
    const dc = f.calls.filter((c) => c.url.includes('discord'));
    assert.equal(dc.length, 3, '三次切換要有三則通知');
    assert.ok(dc.every((c) => c.body.content.includes('模式切換')), '每則都要標「模式切換」');
  } finally { f.restore(); }
});

test('②接手/放行都推 Discord', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    await state.setAdminId(env, 'U-mumu');
    const sid = await state.indexRoom(env, 'U-cust');
    await handleAdminMessage(env, 'U-mumu', `接手 #${sid}`);
    await handleAdminMessage(env, 'U-mumu', `放行 #${sid}`);
    const dc = f.calls.filter((c) => c.url.includes('discord'));
    assert.equal(dc.length, 2, '接手 + 放行 = 兩則');
    assert.ok(dc[0].body.content.includes('接手'));
    assert.ok(dc[1].body.content.includes('放行'));
  } finally { f.restore(); }
});

test('④查帳列最近客人、去重代號', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setAdminId(env, 'U-mumu');
    // 造三位客人的紀錄,其中 A 有兩則(查帳要去重、只顯示最新)
    await state.logExchange(env, 'UA', 'answered', 'A 舊題', '');
    await new Promise((r) => setTimeout(r, 5));
    await state.logExchange(env, 'UB', 'answered', 'B 的題', '');
    await new Promise((r) => setTimeout(r, 5));
    await state.logExchange(env, 'UA', 'answered', 'A 新題', '');
    await new Promise((r) => setTimeout(r, 5));
    await state.logExchange(env, 'UC', 'escalated_llm_quote', 'C 估價', '');

    const reply = await handleAdminMessage(env, 'U-mumu', '查帳');
    assert.ok(reply.includes('C 估價'), '最新的要在');
    assert.ok(reply.includes('A 新題'), 'A 只顯示最新那則');
    assert.ok(!reply.includes('A 舊題'), 'A 的舊題不該重複列');
    assert.ok(reply.includes('B 的題'));
    assert.ok(reply.includes('📋 估價待妳'), '估價 kind 要有中文標籤');
  } finally { f.restore(); }
});

test('④看 #代號 給該客人最近幾則', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setAdminId(env, 'U-mumu');
    const sid = await state.indexRoom(env, 'UD');
    await state.logExchange(env, 'UD', 'answered', '出血怎麼設?', '長寬 +6mm');
    await new Promise((r) => setTimeout(r, 5));
    await state.logExchange(env, 'UD', 'answered', '那尺寸呢?', 'A3 最大 420x297');

    const reply = await handleAdminMessage(env, 'U-mumu', `看 #${sid}`);
    assert.ok(reply.includes('那尺寸呢'), '最新在最上');
    assert.ok(reply.includes('出血怎麼設'), '舊的也在');
    assert.ok(reply.includes('AI：長寬 +6mm'));
  } finally { f.restore(); }
});
