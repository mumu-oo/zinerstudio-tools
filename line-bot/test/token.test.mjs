// LINE stateless token:用 Channel ID + secret 現換通行證,並且會快取
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reply } from '../src/line.js';
import { mockEnv, stubFetch } from './helpers.mjs';

test('沒有長期 token 時,自動換 stateless token 並快取', async () => {
  const env = mockEnv({ LINE_CHANNEL_ACCESS_TOKEN: undefined, LINE_CHANNEL_ID: '2007766255' });
  delete env.LINE_CHANNEL_ACCESS_TOKEN;
  const f = stubFetch();
  try {
    await reply(env, 'rt-1', '第一則');
    await reply(env, 'rt-2', '第二則');
    const tokenCalls = f.calls.filter((c) => c.url.includes('oauth2/v3/token'));
    assert.equal(tokenCalls.length, 1, '第二次應該用快取,不再換證');
    const replies = f.calls.filter((c) => c.url.includes('/message/reply'));
    assert.equal(replies.length, 2);
  } finally { f.restore(); }
});

test('設了長期 token 就直接用,不打 oauth', async () => {
  const env = mockEnv(); // 內含 LINE_CHANNEL_ACCESS_TOKEN
  const f = stubFetch();
  try {
    await reply(env, 'rt-1', '哈囉');
    assert.equal(f.calls.filter((c) => c.url.includes('oauth2')).length, 0);
  } finally { f.restore(); }
});
