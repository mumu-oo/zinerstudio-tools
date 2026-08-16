import { test } from 'node:test';
import assert from 'node:assert/strict';
import { igHandle, pickFields, renderPlurk, renderThreads, renderIG, imageUrls, LIMITS } from '../src/template.js';
import { parseSchedule, pickDue, nowTaipei } from '../src/schedule.js';

const row = {
  '攤位名稱 Booth Name': '花徑',
  'IG帳號 Instagram Account': 'xiuxiu_0414',
  '分享網站': 'https://www.instagram.com/xiuxiu_0414/',
  '攤位號碼 Booth Number': 'H36 / --',
  '自我介紹 Self-Introduction': '我是繡繡，浪漫的情慾創作者！最喜歡沉浸在充滿粉紅泡泡的氛圍裡，也喜歡華麗可愛的插畫～一起來嘗嘗情慾解放的甜蜜滋味吧！',
  '分享圖片': 'https://drive.google.com/open?id=AAA , https://drive.google.com/open?id=BBB',
};

test('igHandle 各種寫法', () => {
  assert.equal(igHandle('xiuxiu_0414'), '@xiuxiu_0414');
  assert.equal(igHandle('@xiuxiu_0414'), '@xiuxiu_0414');
  assert.equal(igHandle('https://www.instagram.com/xiuxiu_0414/'), '@xiuxiu_0414');
  assert.equal(igHandle('無'), '');
  assert.equal(igHandle(''), '');
});

test('imageUrls 逗號分隔', () => {
  assert.deepEqual(imageUrls(row['分享圖片']), ['https://drive.google.com/open?id=AAA', 'https://drive.google.com/open?id=BBB']);
});

test('renderPlurk 短自介 → 單噗，含 footer', () => {
  const f = pickFields(row);
  const { main, reply } = renderPlurk(f);
  assert.equal(reply, null);
  assert.ok(main.length <= LIMITS.plurk, `len ${main.length}`);
  assert.match(main, /｜ #台創祭7 攤位介紹｜/);
  assert.match(main, /⚑ 花徑/);
  assert.match(main, /@xiuxiu_0414/);
  assert.match(main, /出攤情報 ⚑ H36 \/ --/);
  assert.match(main, /2026\.10\.31-11\.01/);
});

test('renderPlurk 長自介 → 自介進留言', () => {
  const f = pickFields({ ...row, '自我介紹 Self-Introduction': '很長'.repeat(200) });
  const { main, reply } = renderPlurk(f);
  assert.ok(main.length <= LIMITS.plurk);
  assert.ok(reply && reply.length > 300);
  assert.doesNotMatch(main, /很長/);
});

test('renderThreads / renderIG 都產出', () => {
  const f = pickFields(row);
  assert.ok(renderThreads(f).main.length <= LIMITS.threads);
  assert.match(renderThreads(f).main, /@zinerstudio/);
  assert.match(renderIG(f).main, /#台創祭7/);
});

test('parseSchedule 各格式', () => {
  assert.deepEqual(parseSchedule('9/18', 2026), { dateKey: '2026-09-18', slotHm: null, slotIdx: null });
  assert.deepEqual(parseSchedule('2026-09-18', 2026), { dateKey: '2026-09-18', slotHm: null, slotIdx: null });
  assert.deepEqual(parseSchedule('9/18 12:00', 2026), { dateKey: '2026-09-18', slotHm: '12:00', slotIdx: null });
  assert.deepEqual(parseSchedule('9/18 #3', 2026), { dateKey: '2026-09-18', slotHm: null, slotIdx: 2 });
  assert.equal(parseSchedule('', 2026), null);
  assert.equal(parseSchedule('亂寫', 2026), null);
});

test('pickDue 自動配 slot、只挑到期、跳過 posted', () => {
  const env = { POST_SLOTS: '09:00,12:00,15:00,18:00,21:00' };
  const now = { ...nowTaipei(), dateKey: '2026-09-18', hm: '12:30' };
  const rows = [
    { _row: 2, '排程時段': '9/18', '發文狀態': 'posted 2026-09-18 09:00' },
    { _row: 3, '排程時段': '9/18', '發文狀態': '' },
    { _row: 4, '排程時段': '9/18', '發文狀態': '' },
    { _row: 5, '排程時段': '9/19', '發文狀態': '' },
  ];
  const { due, all } = pickDue(rows, env, now);
  assert.deepEqual(all.map((x) => x.hm), ['09:00', '12:00', '15:00']);
  assert.deepEqual(due.map((x) => x.r._row), [3]); // row2 posted、row3 12:00 到期、row4 15:00 未到
});

test('nowTaipei 是台北時間', () => {
  const t = nowTaipei(new Date('2026-09-18T01:00:00Z')); // UTC 01:00 = 台北 09:00
  assert.equal(t.dateKey, '2026-09-18');
  assert.equal(t.hm, '09:00');
});
