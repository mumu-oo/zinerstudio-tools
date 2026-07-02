// 測試共用:記憶體版 KV + 可錄影的 fetch 假貨

export function mockKV() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    _map: m,
  };
}

export function mockEnv(extra = {}) {
  return {
    STATE: mockKV(),
    LINE_CHANNEL_SECRET: 'test-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
    LLM_API_KEY: 'test-key',
    ADMIN_SECRET: '孔版之心',
    ...extra,
  };
}

// 攔截 fetch:記下所有呼叫,依網址回應
export function stubFetch({ llmAnswer = '這是小精靈的回答' } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, body });
    if (u.includes('/message/reply')) return new Response('{}', { status: 200 });
    if (u.includes('/chat/loading')) return new Response('{}', { status: 200 });
    if (u.includes('/profile/')) return Response.json({ displayName: '測試客人' });
    if (u.includes('/chat/completions')) {
      return Response.json({ choices: [{ message: { content: llmAnswer } }] });
    }
    if (u.includes('discord')) return new Response('', { status: 204 });
    return new Response('not stubbed: ' + u, { status: 500 });
  };
  return {
    calls,
    replies: () => calls.filter((c) => c.url.includes('/message/reply')).map((c) => c.body.messages[0].text),
    llmCalls: () => calls.filter((c) => c.url.includes('/chat/completions')),
    restore: () => { globalThis.fetch = original; },
  };
}
