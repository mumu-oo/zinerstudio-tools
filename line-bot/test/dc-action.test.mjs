// Discord 按鈕遙控:通知帶按鈕、簽章驗證、GET /dc-action 觸發接手/放行
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleEvent } from '../src/handler.js';
import { signAction, verifyAction, timingSafeEqual } from '../src/hmac.js';
import { escalationButtons, notifyEscalation } from '../src/notify.js';
import * as state from '../src/state.js';
import { mockEnv, stubFetch } from './helpers.mjs';

const SECRET = 'test-action-secret-32-bytes-long-random-blob';
const BASE = 'https://example.workers.dev';

const buttonEnv = (extra = {}) => mockEnv({
  ACTION_SECRET: SECRET,
  PUBLIC_BASE_URL: BASE,
  DISCORD_WEBHOOK_URL: 'https://discord.example/hook',
  ...extra,
});

test('HMAC:同輸入穩定、換一個位元就不同、常數時間比對正確', async () => {
  const a1 = await signAction(SECRET, 't', 'sb9z');
  const a2 = await signAction(SECRET, 't', 'sb9z');
  const b = await signAction(SECRET, 'r', 'sb9z');
  const c = await signAction(SECRET, 't', 'sb9y');
  const d = await signAction('other-secret', 't', 'sb9z');
  assert.equal(a1, a2, '同輸入要穩定');
  assert.notEqual(a1, b, 'action 換就不一樣');
  assert.notEqual(a1, c, 'sid 換就不一樣');
  assert.notEqual(a1, d, '換 secret 就不一樣');
  assert.ok(await verifyAction(SECRET, 't', 'sb9z', a1));
  assert.ok(!(await verifyAction(SECRET, 't', 'sb9z', b)));
  assert.ok(timingSafeEqual('abc', 'abc'));
  assert.ok(!timingSafeEqual('abc', 'abd'));
  assert.ok(!timingSafeEqual('abc', 'abcd'));
});

test('escalationButtons:兩顆按鈕、URL 正確、有簽章;沒 secret/URL 就 undefined', async () => {
  const env = buttonEnv();
  const btns = await escalationButtons(env, 'sb9z');
  assert.equal(btns.length, 1);
  assert.equal(btns[0].components.length, 2);
  const [take, release] = btns[0].components;
  assert.ok(take.url.startsWith(`${BASE}/dc-action?a=t&s=sb9z&sig=`));
  assert.ok(release.url.startsWith(`${BASE}/dc-action?a=r&s=sb9z&sig=`));
  assert.ok(take.label.includes('接手'));
  assert.ok(release.label.includes('放行'));
  assert.equal(take.style, 5, 'link button style');

  const noSecret = mockEnv({ PUBLIC_BASE_URL: BASE });
  assert.equal(await escalationButtons(noSecret, 'x'), undefined);
  const noBase = mockEnv({ ACTION_SECRET: SECRET });
  assert.equal(await escalationButtons(noBase, 'x'), undefined);
});

test('通知附按鈕:客人事件 Discord payload 帶 components(舊 systemNoteCard 無按鈕)', async () => {
  const env = buttonEnv();
  const f = stubFetch();
  try {
    const sid = await state.indexRoom(env, 'U-btn-1');
    await notifyEscalation(env, { sid, name: null, question: '想估價', kind: 'llm_quote' });
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc.body.components, '客人事件通知要帶按鈕');
    assert.equal(dc.body.components[0].components.length, 2);
    assert.ok(dc.body.components[0].components[0].url.includes(sid));
  } finally { f.restore(); }
});

test('GET /dc-action:合法簽章 → 接手、原房被靜音、回 HTML 200', async () => {
  const env = buttonEnv();
  const f = stubFetch();
  try {
    const sid = await state.indexRoom(env, 'U-btn-2');
    const sig = await signAction(SECRET, 't', sid);
    const res = await worker.fetch(
      new Request(`${BASE}/dc-action?a=t&s=${sid}&sig=${sig}`),
      env,
      { waitUntil: (p) => p },
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('已接手'), '頁面要顯示已接手');
    assert.equal(await state.isMuted(env, 'U-btn-2'), true, '該房要被靜音');
    // 有 Discord 通知(systemNoteCard「接手房間」)
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc.body.content.includes('接手房間'));
  } finally { f.restore(); }
});

test('GET /dc-action:放行 → 解除靜音', async () => {
  const env = buttonEnv();
  const f = stubFetch();
  try {
    const sid = await state.indexRoom(env, 'U-btn-3');
    await state.muteRoom(env, 'U-btn-3', 7 * 24 * 3600);
    const sig = await signAction(SECRET, 'r', sid);
    const res = await worker.fetch(
      new Request(`${BASE}/dc-action?a=r&s=${sid}&sig=${sig}`),
      env,
      { waitUntil: (p) => p },
    );
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes('已放行'));
    assert.equal(await state.isMuted(env, 'U-btn-3'), false);
  } finally { f.restore(); }
});

test('GET /dc-action:壞簽章 → 403、不動狀態', async () => {
  const env = buttonEnv();
  const f = stubFetch();
  try {
    const sid = await state.indexRoom(env, 'U-btn-4');
    const res = await worker.fetch(
      new Request(`${BASE}/dc-action?a=t&s=${sid}&sig=wrong-sig`),
      env,
      { waitUntil: (p) => p },
    );
    assert.equal(res.status, 403);
    assert.equal(await state.isMuted(env, 'U-btn-4'), false, '簽章錯不能動狀態');
  } finally { f.restore(); }
});

test('GET /dc-action:別的 sid 的簽章不能替換用(sid 綁進簽章)', async () => {
  const env = buttonEnv();
  const f = stubFetch();
  try {
    const sidA = await state.indexRoom(env, 'U-btn-5A');
    const sidB = await state.indexRoom(env, 'U-btn-5B');
    const sigA = await signAction(SECRET, 't', sidA);
    // 拿 A 的簽章配 B 的 sid → 應該被拒
    const res = await worker.fetch(
      new Request(`${BASE}/dc-action?a=t&s=${sidB}&sig=${sigA}`),
      env,
      { waitUntil: (p) => p },
    );
    assert.equal(res.status, 403);
    assert.equal(await state.isMuted(env, 'U-btn-5B'), false);
  } finally { f.restore(); }
});

test('GET /dc-action:sid 已過期 → 404、不報錯', async () => {
  const env = buttonEnv();
  const sig = await signAction(SECRET, 't', 'ghos');
  const res = await worker.fetch(
    new Request(`${BASE}/dc-action?a=t&s=ghos&sig=${sig}`),
    env,
    { waitUntil: (p) => p },
  );
  assert.equal(res.status, 404);
});

test('GET /dc-action:未設 ACTION_SECRET → 503,不 crash', async () => {
  const env = mockEnv();
  const res = await worker.fetch(
    new Request(`${BASE}/dc-action?a=t&s=xxx&sig=yyy`),
    env,
    { waitUntil: (p) => p },
  );
  assert.equal(res.status, 503);
});

test('端到端:客人觸發轉人工 → Discord 通知帶按鈕 → 穆穆按接手 → 該房靜音', async () => {
  const env = buttonEnv();
  const f = stubFetch({ llmAnswer: '[[轉人工]]' });
  try {
    await state.setMode(env, 'force_off_duty');
    // 客人來一題,AI 說沒把握 → Discord 通知
    await handleEvent(env, {
      type: 'message',
      replyToken: 'rt-1',
      source: { type: 'user', userId: 'U-cust-e2e' },
      message: { type: 'text', text: '請問可以贊助我們嗎' },
    });
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc.body.components, '通知要帶按鈕');
    const takeUrl = dc.body.components[0].components[0].url;
    // 穆穆按接手按鈕
    const res = await worker.fetch(new Request(takeUrl), env, { waitUntil: (p) => p });
    assert.equal(res.status, 200);
    assert.equal(await state.isMuted(env, 'U-cust-e2e'), true, '按了接手 → 該房靜音');
  } finally { f.restore(); }
});
