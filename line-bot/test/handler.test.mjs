// 端對端決策鏈:一則 LINE 訊息進來後,小精靈的每一種反應
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from '../src/handler.js';
import { ESCALATE_BODY, OFF_SCOPE_BODY, BOOPOS_BODY, GREETING, ESCALATE_SENTINEL, composeReply } from '../src/reply.js';
import * as state from '../src/state.js';
import * as guard from '../src/guard.js';
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
    assert.ok(r[0].includes('孔版助手 AI 自動回覆'), '首次回覆要有結尾說明');
  } finally { f.restore(); }
});

test('第二輪對話 → 問候語不再掛(2026-07-11 穆穆拍板:開場限定),結尾照掛', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '出血留 3mm 喔' });
  try {
    await state.setMode(env, 'force_off_duty');
    await state.pushHistory(env, 'U1', 'user', '前一題');
    await state.pushHistory(env, 'U1', 'assistant', '前一答');
    await handleEvent(env, msg('U1', '出血要留多少'));
    const r = f.replies();
    assert.ok(!r[0].startsWith(GREETING), '第二輪不掛問候語(實測 15 分鐘轟炸客人八次的教訓)');
    assert.ok(r[0].includes('孔版助手 AI 自動回覆'), '結尾每則照掛');
    // 對話記憶要進到模型
    const sent = f.llmCalls()[0].body.messages;
    assert.ok(sent.some((m) => m.content === '前一題'), '要帶上下文');
  } finally { f.restore(); }
});

test('退休詞「上班/下班」→ 教新詞,不動任何設定', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setAdminId(env, 'U-mumu');
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U-mumu', '下班'));
    assert.ok(f.replies().at(-1).includes('退休'), '要回覆教學訊息');
    assert.equal(await state.getMode(env), 'force_off_duty', '模式不可被改動');
    await handleEvent(env, msg('U-mumu', '上班'));
    assert.equal(await state.getMode(env), 'force_off_duty', '模式不可被改動');
  } finally { f.restore(); }
});

test('查無資料 → AI 看全表判斷、沒把握轉人工、通知 Discord,但不再封房', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch({ llmAnswer: '[[轉人工]]' });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U2', '請問可以贊助我們嗎'));
    assert.equal(f.llmCalls().length, 1, '0 命中要交給 AI 看全表判斷,不再直接罐頭');
    assert.equal(f.replies()[0], composeReply(ESCALATE_BODY, { sessionStart: true }).text);
    assert.equal(await state.isMuted(env, 'U2'), false, '2026-07-11 起轉人工不再自動靜音(一題答不了不封整間房)');
    assert.ok(f.calls.some((c) => c.url.includes('discord')), '要通知穆穆');

    // 轉人工後下一題 → 照常服務(實錄教訓:第八題轉人工害工作坊題被無視)
    const beforeLlm = f.llmCalls().length;
    await handleEvent(env, msg('U2', '最近有工作坊或活動嗎'));
    assert.equal(f.llmCalls().length, beforeLlm + 1, '轉人工後的下一題要照常回答');
  } finally { f.restore(); }
});

test('BOO-POS 詢問 → 不分上下班直接導流,不呼叫 AI、不掛問候結尾(2026-08-09 穆穆裁定)', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    // 上班模式(平常小精靈全靜默)也要回——唯一突破值班靜默的罐頭
    await state.setMode(env, 'force_on_duty');
    await handleEvent(env, msg('U-bp1', '請問 BOO-POS 可以匯出報表嗎'));
    assert.equal(f.llmCalls().length, 0, '不呼叫 AI');
    assert.equal(f.replies()[0], BOOPOS_BODY, '單獨一則導流:不掛標準問候與結尾');
    assert.ok(f.replies()[0].includes('booposapp@gmail.com'), '要含信箱');
    assert.ok(f.replies()[0].includes('孔版印刷相關問題'), '要有導回孔版印刷的邀請(2026-08-09 穆穆:別讓客人以為沒真人)');
    assert.ok(f.replies()[0].includes('孔版AI助手自動回覆'), '要有 AI 識別尾(上班時段客人不會誤以為 MUMU 親手打了句「去看 Feedback」)');
    assert.ok(!f.replies()[0].includes('目前不在'), '不出現「MUMU 目前不在」這類把她 out 掉的話');
    assert.ok(f.calls.some((c) => c.url.includes('discord')), '要在留言板知會穆穆一聲');

    // 下班模式照樣導流,同樣不進 AI
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U-bp2', 'boo pos 的帳目怪怪的怎麼回報'));
    assert.equal(f.replies().length, 2);
    assert.equal(f.replies()[1], BOOPOS_BODY);
    assert.equal(f.llmCalls().length, 0);
  } finally { f.restore(); }
});

test('被接手的房間問 BOO-POS → 仍然靜默(穆穆在跟客人說話,機器不插嘴)', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    await state.setAdminId(env, 'U-mumu');
    const sid = await state.indexRoom(env, 'U-bp3');
    await handleEvent(env, msg('U-mumu', `接手 #${sid}`));
    const before = f.replies().length;
    await handleEvent(env, msg('U-bp3', 'BOO-POS 一直閃退'));
    assert.equal(f.replies().length, before, '接手中的房間連導流罐頭也不發');
  } finally { f.restore(); }
});

test('BOO-POS 偵測:常見寫法都命中,一般含 pos/boo 字樣不誤觸', () => {
  for (const t of ['BOO-POS', 'boopos 怎麼用', 'Boo Pos 匯出', '我想問boo-pos的事', 'BOO_POS']) {
    assert.ok(guard.isBooPos(t), `該命中:${t}`);
  }
  for (const t of ['可以印 poster 嗎', '報價 position 怎麼算', 'boo 是什麼', '有 pos 機收據紙嗎', '可以印海報嗎']) {
    assert.ok(!guard.isBooPos(t), `不該命中:${t}`);
  }
});

test('範圍外業務(貼紙)→ 罐頭婉拒,不呼叫 AI', async () => {
  const env = mockEnv();
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U3', '可以印貼紙嗎'));
    assert.equal(f.llmCalls().length, 0);
    assert.equal(f.replies()[0], composeReply(OFF_SCOPE_BODY, { sessionStart: true }).text);
  } finally { f.restore(); }
});

test('客人呼叫老闆 → 程式硬擋、必轉人工必通知,不進 AI(2026-08-09 穆穆令)', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    for (const t of ['我想找老闆', '找 MUMU 談', '要跟真人講', '呼叫老闆來', '請幫我叫老闆']) {
      f.calls.length = 0;
      await handleEvent(env, msg(`U-call-${t}`, t));
      assert.equal(f.llmCalls().length, 0, `「${t}」不該進 AI`);
      const dc = f.calls.find((c) => c.url.includes('discord'));
      assert.ok(dc, `「${t}」要通知穆穆`);
      assert.ok(dc.body.embeds[0].description.includes('呼叫老闆'), `「${t}」DC 卡片標籤要對`);
    }
  } finally { f.restore(); }
});

test('呼叫辨識邊界:一般問題不誤觸(找誰、叫報價、我可以自己來)', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '好喔～' });
  try {
    await state.setMode(env, 'force_off_duty');
    for (const t of ['我可以找誰處理', '請問可以叫報價嗎', '我要自己來']) {
      f.calls.length = 0;
      await handleEvent(env, msg(`U-normal-${t}`, t));
      assert.ok(f.llmCalls().length === 1, `「${t}」不該被呼叫規則誤觸,要正常走 AI`);
    }
  } finally { f.restore(); }
});

test('保險網:AI 沒吐暗號卻說「無法回答」→ 程式攔下轉人工＋通知穆穆(2026-08-09 實錄洞)', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch({ llmAnswer: 'A4 最大印刷範圍資料沒寫，無法回答。' });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U-cannot', '請問A4最大的印刷範圍？'));
    const r = f.replies()[0];
    assert.ok(!r.includes('無法回答'), '「無法回答」不准送到客人眼前');
    assert.ok(r.includes(ESCALATE_BODY.slice(0, 10)), '要改走轉人工暖罐頭');
    assert.ok(f.calls.some((c) => c.url.includes('discord')), '穆穆一定要收到通知');
  } finally { f.restore(); }
});

test('AI 自己說沒把握(sentinel)→ 轉人工,不封房', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: ESCALATE_SENTINEL });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, msg('U4', '三色單面大概幾個工作天'));
    assert.equal(f.replies()[0], composeReply(ESCALATE_BODY, { sessionStart: true }).text);
    assert.equal(await state.isMuted(env, 'U4'), false, '轉人工不再自動靜音');
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

    // 下指令:收工 → 靜默
    await handleEvent(env, msg('U-mumu', '收工'));
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
