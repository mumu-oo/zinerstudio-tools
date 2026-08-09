// Discord 接手/放行連結:通知含簽名的可點連結、簽章驗證、GET /dc-action 執行動作
// (原設計是 button component,但頻道自建的 webhook 不接 components,已改走 embed 內嵌 markdown link)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { handleEvent } from '../src/handler.js';
import { signAction, verifyAction, timingSafeEqual } from '../src/hmac.js';
import { actionLinks, notifyEscalation } from '../src/notify.js';
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

test('actionLinks:產出兩個 markdown link 帶簽章;沒 secret/URL → null', async () => {
  const env = buttonEnv();
  const links = await actionLinks(env, 'sb9z');
  assert.match(links.takeover, /^\[🍆 接手 #sb9z\]\(https:.+\/dc-action\?a=t&s=sb9z&sig=[^)]+\)$/);
  assert.match(links.release, /^\[🤖 放行 #sb9z\]\(https:.+\/dc-action\?a=r&s=sb9z&sig=[^)]+\)$/);

  const noSecret = mockEnv({ PUBLIC_BASE_URL: BASE });
  assert.equal(await actionLinks(noSecret, 'x'), null);
  const noBase = mockEnv({ ACTION_SECRET: SECRET });
  assert.equal(await actionLinks(noBase, 'x'), null);
});

test('通知附連結:客人事件 Discord payload 用 embed、內含兩個簽名 URL', async () => {
  const env = buttonEnv();
  const f = stubFetch();
  try {
    const sid = await state.indexRoom(env, 'U-btn-1');
    await notifyEscalation(env, { sid, name: null, question: '想估價', kind: 'llm_quote' });
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc.body.embeds && dc.body.embeds[0], '要用 embed(頻道自建 webhook 不接 components)');
    const desc = dc.body.embeds[0].description;
    assert.ok(desc.includes(sid), 'embed 要含代號');
    assert.ok(desc.includes('接手'), 'embed 要含接手連結');
    assert.ok(desc.includes('放行'), 'embed 要含放行連結');
    assert.ok(desc.includes(`s=${sid}&sig=`), 'URL 要含簽章');
    assert.equal(dc.body.components, undefined, '不再用 components(避免踩到 webhook 限制)');
  } finally { f.restore(); }
});

test('沒設 ACTION_SECRET:通知退回舊指引文字、不 crash', async () => {
  const env = mockEnv({ DISCORD_WEBHOOK_URL: 'https://discord.example/hook' });
  const f = stubFetch();
  try {
    const sid = await state.indexRoom(env, 'U-btn-fb');
    await notifyEscalation(env, { sid, name: null, question: '想估價', kind: 'llm_quote' });
    const dc = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(dc.body.embeds[0].description.includes('在 LINE 對助手說'), '要有舊指引');
    assert.ok(!dc.body.embeds[0].description.includes('/dc-action'), '沒 secret 就不該有連結');
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
    // 有 Discord 系統通知(systemNoteCard「接手房間」)
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

test('端到端:客人觸發轉人工 → Discord embed 含連結 → 穆穆按連結 → 該房靜音', async () => {
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
    const desc = dc.body.embeds[0].description;
    // 從 markdown link 解析出接手 URL
    const takeUrl = desc.match(/\((https:[^)]+\?a=t[^)]+)\)/)[1];
    // 穆穆按接手連結
    const res = await worker.fetch(new Request(takeUrl), env, { waitUntil: (p) => p });
    assert.equal(res.status, 200);
    assert.equal(await state.isMuted(env, 'U-cust-e2e'), true, '按了接手 → 該房靜音');
  } finally { f.restore(); }
});
