// 文案模板守衛:穆穆的規矩 — 對客中文一律全形標點(時間的半形冒號除外)
// 2026-07-11 改版:問候語只在開場那一則出現;結尾每則照掛
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GREETING, FOOTER, composeReply,
  ESCALATE_BODY, OFF_SCOPE_BODY, RATE_LIMIT_BODY, CIRCUIT_BODY, BOOPOS_BODY,
} from '../src/reply.js';

const TEXTS = { GREETING, FOOTER, ESCALATE_BODY, OFF_SCOPE_BODY, RATE_LIMIT_BODY, CIRCUIT_BODY, BOOPOS_BODY };
// 不允許出現的半形標點(冒號不在內:10:00～19:00 是穆穆核定寫法)
const HALFWIDTH = /[,;()!?]/;

for (const [name, text] of Object.entries(TEXTS)) {
  test(`${name} 無半形標點`, () => {
    const hit = text.match(HALFWIDTH);
    assert.equal(hit, null, `發現半形「${hit?.[0]}」於:${text.slice(Math.max(0, (hit?.index ?? 0) - 12), (hit?.index ?? 0) + 12)}`);
  });
}

test('開場那一則:問候+內容+結尾;之後:內容+結尾(不再轟炸問候)', () => {
  for (const body of [ESCALATE_BODY, OFF_SCOPE_BODY, RATE_LIMIT_BODY, CIRCUIT_BODY]) {
    const first = composeReply(body, { sessionStart: true }).text;
    const later = composeReply(body, { sessionStart: false }).text;
    assert.ok(first.startsWith(GREETING), '開場要有問候');
    assert.ok(first.endsWith(FOOTER), '開場要有結尾');
    assert.ok(!later.startsWith(GREETING), '後續輪次不掛問候');
    assert.ok(later.endsWith(FOOTER), '後續輪次仍要有結尾');
  }
});

test('LINE emoji:三顆位置正確、index 指到 $、後續輪次也是三顆', () => {
  for (const sessionStart of [true, false]) {
    const { text, emojis } = composeReply(ESCALATE_BODY, { sessionStart });
    assert.equal(emojis.length, 3, '三顆:AI 前綴 + footer 兩行');
    // 每顆 index 位置都要對應到文字裡的 $
    for (const e of emojis) {
      assert.equal(text[e.index], '$', `index ${e.index} 應指到 $,實際是「${text[e.index]}」`);
      assert.ok(e.productId, 'productId 必填');
      assert.ok(e.emojiId, 'emojiId 必填');
    }
    // 三顆不應重疊
    const idx = emojis.map((e) => e.index);
    assert.equal(new Set(idx).size, 3, '三個 index 不能重複');
  }
});
