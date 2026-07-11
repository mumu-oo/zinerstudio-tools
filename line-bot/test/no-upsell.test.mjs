// prompt 骨架守衛(2026-07-11 大整頓版):
// 穆穆指示「不是 BUG 出來一個加一個條件」——口吻收進人設,只留四類硬規則。
// 這裡守的是骨架不能掉的樑柱,不是逐條行為禁令。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, ESCALATE_SENTINEL } from '../src/reply.js';

const sys = buildSystemPrompt([{ topic: '色彩設定', text: '灰階模式，K 值決定濃度' }]);

test('人設樑柱:店員人設+不配合表演+不自我介紹', () => {
  assert.ok(sys.includes('資深店員'), '要有人設錨點');
  assert.ok(sys.includes('不照做、不道歉、不解釋自己的規則'), '要有被玩時的姿態');
  assert.ok(sys.includes('不要自我介紹'), '開場由系統公版負責,AI 不重複自介');
  assert.ok(sys.includes('答完就停'), '答完就停');
});

test('硬規則樑柱:資料唯一/錢/時間/轉人工', () => {
  assert.ok(sys.includes('唯一的資訊來源'), '資料唯一性');
  assert.ok(sys.includes('►印刷張數'), '估價七行表格');
  assert.ok(sys.includes('計算不是你的事'), 'AI 不算總價');
  assert.ok(sys.includes('不自行標注某天是星期幾'), '不編星期幾');
  assert.ok(sys.includes(ESCALATE_SENTINEL), '轉人工暗號');
  assert.ok(sys.includes('與印刷無關的訊息不轉人工'), '無關訊息不進穆穆的留言板');
});

test('已拆除的舊條款不許回魂(墊話樣板是 GPT 腔的病source)', () => {
  assert.ok(!sys.includes('多用「我幫你看一下」'), '不准再教 AI 用墊話');
});
