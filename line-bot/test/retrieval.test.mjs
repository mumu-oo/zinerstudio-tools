// 檢索測試:題目全部來自 data/source/孔版客服QA.md 的真實客人訊息
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrieve, kbSize } from '../src/kb.js';

test('知識庫有料', () => {
  assert.ok(kbSize() >= 20, `知識庫只有 ${kbSize()} 條`);
});

const EXPECT_HIT = [
  ['可以用什麼格式', '檔案格式'],
  ['怎麼準備檔案', '檔案格式'],
  ['請問若要白色是留白嗎謝謝', '白墨'],
  ['三色單面大概幾個工作天 一張', '工作天數'],
  ['可以拿外面的紙', '紙材規格'],
  ['什麼樣的紙可以印', '紙材規格'],
  ['請問可以燙金嗎', '金墨問題'],
  ['請問你們有在印小說的部分嗎', '裝訂'],
  ['我想印A3滿版可以嗎', '印刷範圍'],
  ['出血要留多少', '出血設定'],
  ['想了解單、雙色兩者的價格', '報價參考'],
  ['想問3/23有機會開工作坊嗎', '工作坊'],
  ['我想找您印製喜帖', '其他'],
  ['你們有哪些墨色顏色', '孔版油墨'],
];

for (const [q, topic] of EXPECT_HIT) {
  test(`「${q}」→ ${topic}`, () => {
    const topics = retrieve(q).map((e) => e.topic);
    assert.ok(topics.includes(topic), `命中的是 ${JSON.stringify(topics)}`);
  });
}

// 這些應該「查無資料」→ 轉人工,不呼叫 AI
// (訂單個案類的問題,如「我填的表單收到了嗎」,會命中知識庫但由第二道防線
//  ——system prompt 的訂單狀態轉人工鐵則——擋下,屬 LLM 層職責,不在此測)
const EXPECT_MISS = [
  '我這個圖可以印嗎',
  '請問可以贊助我們嗎',
  '哈囉',
];

for (const q of EXPECT_MISS) {
  test(`「${q}」→ 查無資料(轉人工)`, () => {
    const hits = retrieve(q);
    assert.equal(hits.length, 0, `不該命中卻命中:${JSON.stringify(hits.map((e) => e.topic))}`);
  });
}
