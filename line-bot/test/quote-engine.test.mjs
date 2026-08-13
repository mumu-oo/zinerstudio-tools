// 計價引擎:落版、表格解析、計價、端對端(貼表格→程式算→AI 不碰)
// 基準案例=穆穆 2026-08-09 的真實測試(A6 100張 正赤紅反金 米牙 襯紙yes 裁切yes)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imposition, parseQuoteForm, looksLikeQuoteForm, calcQuote, quoteReplyBody, sanityCheck, sanityReplyBody } from '../src/quote.js';
import { handleEvent } from '../src/handler.js';
import * as state from '../src/state.js';
import { mockEnv, stubFetch } from './helpers.mjs';

const FORM = [
  '►印刷張數：100',
  '►印刷色數：正面1色｜反面1色',
  '►使用墨色：正面 紅｜反面 金',
  '►完成尺寸：A6',
  '►使用紙材：米牙',
  '►襯紙需求：yes',
  '►裁切需求：yes',
].join('\n');

test('尺寸解析:支援小數、cm 單位、常見寫法(2026-08-09 Elsa Cheng 實錄:29.7x21mm 漏抓)', () => {
  const cases = [
    { raw: '29.7x21mm', w: 29.7, h: 21 },       // 客人漏寫 c 的字面案例
    { raw: '29.7x21cm', w: 297, h: 210 },       // 客人寫 cm 就自動轉 mm
    { raw: '140x280', w: 140, h: 280 },         // 沒寫單位=mm
    { raw: 'A4', w: 210, h: 297 },              // 標準尺寸
    { raw: '297×210mm', w: 297, h: 210 },       // 全形×
  ];
  for (const c of cases) {
    const p = parseQuoteForm(`►印刷張數：50\n►印刷色數：正面1色\n►使用墨色：正面 黑\n►完成尺寸：${c.raw}\n►使用紙材：白尺\n►襯紙需求：no\n►裁切需求：no`);
    assert.deepEqual(p.missing, [], `「${c.raw}」不該缺尺寸`);
    assert.equal(p.fields.size.w, c.w, `「${c.raw}」寬 ${p.fields.size.w} 應=${c.w}`);
    assert.equal(p.fields.size.h, c.h, `「${c.raw}」高 ${p.fields.size.h} 應=${c.h}`);
  }
});

test('落版:規格書驗收案例', () => {
  assert.equal(imposition(140, 280), 2, '140×280 → 2 版(2026-07-03 她驗收過)');
  assert.equal(imposition(105, 148), 4, 'A6 → 4 版');
  assert.equal(imposition(148, 210), 2, 'A5 → 2 版');
  assert.equal(imposition(90, 54), 12, '名片 90×54(含出血 96×60 → 4×3)');
});

test('表格解析:穆穆的真實測試表格全欄位過', () => {
  assert.ok(looksLikeQuoteForm(FORM));
  const { fields, missing } = parseQuoteForm(FORM);
  assert.deepEqual(missing, [], `不該有缺項:${missing.join('/')}`);
  assert.equal(fields.sheets, 100);
  assert.equal(fields.front[0].name, '赤紅', '紅 → 赤紅');
  assert.equal(fields.back[0].name, '金');
  assert.equal(fields.size.label, 'A6');
  assert.equal(fields.paper.name, '米牙紙 220g', '沒寫克數 → 預設 220g');
  assert.equal(fields.lining, true);
  assert.equal(fields.cutting, true);
});

test('計價:基準案例=1220 元(手算驗證)', () => {
  const { fields } = parseQuoteForm(FORM);
  const r = calcQuote(fields);
  assert.ok(r.ok);
  // A6 落4版:100/4=25 張+備量5(雙面單色)=30
  assert.equal(r.meta.layout, 4);
  assert.equal(r.meta.totalA3, 30);
  // 製版 110+220=330、基本 250、印刷 5.5×30=165、紙材 6×30=180、襯紙 1.5×30=45、裁切(明信片類)250
  assert.equal(r.total, 330 + 250 + 165 + 180 + 45 + 250);
  assert.equal(r.total, 1220);
});

test('計價:墨色未填(?保留)→ 缺項,不硬算', () => {
  const bad = FORM.replace('正面 紅｜反面 金', '正面?｜反面?');
  const { missing } = parseQuoteForm(bad);
  assert.ok(missing.some((m) => m.includes('墨色')), '墨色要列缺項');
});

test('計價:薄紙不能襯紙 → 不計費附備註;特殊尺寸裁切照刀計', () => {
  const thin = parseQuoteForm(FORM.replace('米牙', '柳橙').replace('正面 紅｜反面 金', '正面 黑')).fields;
  const r1 = calcQuote(thin);
  assert.ok(r1.ok);
  assert.ok(!r1.items.some((i) => i.name === '襯紙'), '89g 不該收襯紙費');
  assert.ok(r1.notes.some((n) => n.includes('不需襯紙')));

  const special = parseQuoteForm(FORM.replace('A6', '140×280')).fields;
  const r2 = calcQuote(special);
  // 140×280 → 2 版 → 8 刀 → 400
  assert.ok(r2.items.some((i) => i.name.includes('特殊尺寸 8 刀') && i.price === 400));
});

test('回覆文案:只給總額不列細項(2026-07-03 她拍板)、附試算機、帶但書', () => {
  const { fields } = parseQuoteForm(FORM);
  const r = calcQuote(fields);
  const body = quoteReplyBody(fields, r);
  assert.ok(body.includes('1,220 元'));
  assert.ok(body.includes('MUMU 檢稿後回覆為準'));
  assert.ok(body.includes('zinerstudio.com/quote'), '要附試算機');
  assert.ok(!body.includes('製版費'), '不列細項');
  assert.ok(!body.includes('印刷基本費'), '不列細項');
});

test('端對端:客人貼齊表格 → 引擎直接回總額,AI 一次都不呼叫、通知穆穆含明細', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, {
      type: 'message', replyToken: 'rt-1',
      source: { type: 'user', userId: 'U-quote-e2e' },
      message: { type: 'text', text: FORM },
    });
    assert.equal(f.llmCalls().length, 0, '錢的事不進 AI');
    const r = f.replies()[0];
    assert.ok(r.includes('1,220 元'), `回覆要含總額:${r}`);
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc.body.content.includes('引擎試算已回覆'));
    assert.ok(dc.body.content.includes('合計 1,220 元'), '穆穆的通知要有明細可對帳');
    assert.ok(dc.body.content.includes('製版費(赤紅) 110'), '明細含製版');
  } finally { f.restore(); }
});

test('墨色解析:全形＋、反面「—」empty marker(2026-08-09 #11kf 實錄)', () => {
  const form = [
    '►印刷張數：10',
    '►印刷色數：正面3色｜反面0色',
    '►使用墨色：正面 黑＋青藍＋赤紅｜反面 —',
    '►完成尺寸：120x142mm',
    '►使用紙材：白尺紙',
    '►襯紙需求：yes',
    '►裁切需求：yes',
  ].join('\n');
  const { fields, missing } = parseQuoteForm(form);
  assert.deepEqual(missing, [], `不該缺項:${missing.join('/')}`);
  assert.equal(fields.front.length, 3, '正面 3 色');
  assert.deepEqual(fields.front.map((i) => i.name), ['黑', '青藍', '赤紅']);
  assert.equal(fields.back.length, 0, '反面 — 要視為空');

  const r = calcQuote(fields);
  assert.ok(r.ok);
  // 120x142 mm → 落 4 版 → ceil(10/4)=3 A3 + 備量 10(單面3色) = 13 張
  assert.equal(r.meta.layout, 4);
  assert.equal(r.meta.totalA3, 13);
  // 製版 110×3 + 基本 250 + 印刷 5.5×13 + 紙材 6×13 + 襯紙 1.5×13 + 裁切 250(明信片規格)
  // = 330 + 250 + 71.5 + 78 + 19.5 + 250 = 999
  assert.equal(r.total, 999);
});

test('sanityCheck:尺寸太小/太大、張數/色數異常都抓、正常值放行', () => {
  // 小尺寸(29.7x21mm,Elsa Cheng 實錄)
  const small = parseQuoteForm('►印刷張數：50\n►印刷色數：正面1色\n►使用墨色：正面 黑\n►完成尺寸：29.7x21mm\n►使用紙材：白尺\n►襯紙需求：no\n►裁切需求：no').fields;
  const susp1 = sanityCheck(small);
  assert.ok(susp1, '29.7x21mm 要抓');
  assert.ok(susp1[0].guess.includes('297×210mm'), '要提示 cm 換算');

  // 大尺寸
  const big = parseQuoteForm('►印刷張數：50\n►印刷色數：正面1色\n►使用墨色：正面 黑\n►完成尺寸：500x400mm\n►使用紙材：白尺\n►襯紙需求：no\n►裁切需求：no').fields;
  assert.ok(sanityCheck(big), '超過 A3 要抓');

  // 大張數
  const many = parseQuoteForm('►印刷張數：99999\n►印刷色數：正面1色\n►使用墨色：正面 黑\n►完成尺寸：A6\n►使用紙材：白尺\n►襯紙需求：no\n►裁切需求：no').fields;
  assert.ok(sanityCheck(many), '99999 張要抓');

  // 正常值放行(基準案例)
  const { fields } = parseQuoteForm(FORM);
  assert.equal(sanityCheck(fields), null, '正常 A6 100 張不該被抓');
});

test('端對端:29.7x21mm 進來 → 引擎反問、不算價、不進 AI、通知穆穆(Elsa Cheng 實錄修法)', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    await state.setMode(env, 'force_off_duty');
    const form = FORM.replace('A6', '29.7x21mm');
    await handleEvent(env, {
      type: 'message', replyToken: 'rt-1',
      source: { type: 'user', userId: 'U-elsa' },
      message: { type: 'text', text: form },
    });
    assert.equal(f.llmCalls().length, 0, '可疑值不進 AI');
    const r = f.replies()[0];
    assert.ok(r.includes('297×210mm'), '要提示 cm 換算');
    assert.ok(!r.match(/\d{1,4} 元/), '反問時不該出現金額');
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc && dc.body.content.includes('引擎反問可疑值'), '要通知穆穆');
  } finally { f.restore(); }
});

test('端對端:表格有缺項 → 不擋、交給 AI 追問', async () => {
  const env = mockEnv();
  const f = stubFetch({ llmAnswer: '差墨色喔,正反面各要印什麼顏色?' });
  try {
    await state.setMode(env, 'force_off_duty');
    await handleEvent(env, {
      type: 'message', replyToken: 'rt-1',
      source: { type: 'user', userId: 'U-quote-part' },
      message: { type: 'text', text: FORM.replace('正面 紅｜反面 金', '正面?｜反面?') },
    });
    assert.equal(f.llmCalls().length, 1, '缺項表格要進 AI 讓它追問');
  } finally { f.restore(); }
});
