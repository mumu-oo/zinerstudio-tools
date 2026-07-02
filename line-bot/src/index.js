// 誌造所 LINE 客服小精靈 — Cloudflare Worker 入口
// 路由:POST /webhook(LINE 平台打進來)、GET /health(活著嗎)

import { verifySignature } from './line.js';
import { handleEvent } from './handler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      const rawBody = await request.text();
      const ok = await verifySignature(
        env.LINE_CHANNEL_SECRET,
        rawBody,
        request.headers.get('x-line-signature'),
      );
      if (!ok) return new Response('bad signature', { status: 403 });

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return new Response('bad json', { status: 400 });
      }

      // 先回 200 讓 LINE 安心,事件在背景處理(reply token 有效期內完成即可)
      for (const event of body.events || []) {
        ctx.waitUntil(
          handleEvent(env, event).catch((err) => console.error('handleEvent:', err)),
        );
      }
      return new Response('ok', { status: 200 });
    }

    return new Response('not found', { status: 404 });
  },
};
