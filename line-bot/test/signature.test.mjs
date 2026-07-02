// LINE webhook 簽章驗證
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../src/line.js';

const SECRET = 'my-channel-secret';
const sign = (body) => createHmac('sha256', SECRET).update(body).digest('base64');

test('正確簽章 → 通過', async () => {
  const body = JSON.stringify({ events: [{ type: 'message' }] });
  assert.equal(await verifySignature(SECRET, body, sign(body)), true);
});

test('竄改內文 → 拒絕', async () => {
  const body = '{"events":[]}';
  assert.equal(await verifySignature(SECRET, body + ' ', sign(body)), false);
});

test('沒有簽章/錯密鑰 → 拒絕', async () => {
  const body = '{"events":[]}';
  assert.equal(await verifySignature(SECRET, body, null), false);
  assert.equal(await verifySignature('wrong-secret', body, sign(body)), false);
});
