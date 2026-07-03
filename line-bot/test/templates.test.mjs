// 文案模板守衛:穆穆的規矩 — 對客中文一律全形標點(時間的半形冒號除外)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GREETING, FOOTER, ESCALATE_REPLY, OFF_SCOPE_REPLY, RATE_LIMIT_REPLY, CIRCUIT_REPLY,
} from '../src/reply.js';

const TEMPLATES = { GREETING, FOOTER, ESCALATE_REPLY, OFF_SCOPE_REPLY, RATE_LIMIT_REPLY, CIRCUIT_REPLY };
// 不允許出現的半形標點(冒號不在內:10:00～19:00 是穆穆核定寫法)
const HALFWIDTH = /[,;()!?]/;

for (const [name, text] of Object.entries(TEMPLATES)) {
  test(`${name} 無半形標點`, () => {
    const hit = text.match(HALFWIDTH);
    assert.equal(hit, null, `發現半形「${hit?.[0]}」於:${text.slice(Math.max(0, (hit?.index ?? 0) - 12), (hit?.index ?? 0) + 12)}`);
  });
}

test('每一則罐頭都掛完整模板(開頭+結尾)', () => {
  for (const t of [ESCALATE_REPLY, OFF_SCOPE_REPLY, RATE_LIMIT_REPLY, CIRCUIT_REPLY]) {
    assert.ok(t.startsWith(GREETING), '要有開頭問候');
    assert.ok(t.endsWith(FOOTER), '要有結尾說明');
  }
});
