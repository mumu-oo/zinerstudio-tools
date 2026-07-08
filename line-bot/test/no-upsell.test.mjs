// 禁止 upsell:純技術/規格問題不准附「還缺三項」尾巴
// 穆穆 2026-07-08 抓包:問「怎麼做漸層」被追問尺寸/紙張/雙面——與問題無關
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../src/reply.js';

test('system prompt 明文禁止對純技術問題追問下單資訊', () => {
  const sys = buildSystemPrompt([{ topic: '色彩設定', text: '灰階模式，K 值決定濃度' }]);
  assert.ok(sys.includes('不要主動追問下單資訊'), 'prompt 要有禁 upsell 的明文條款');
  assert.ok(sys.includes('答完就停'), 'prompt 要明講純技術題答完就停');
});
