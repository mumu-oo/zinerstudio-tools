// 誌造所 LINE 客服小精靈 — Cloudflare Worker 入口
// 路由:POST /webhook(LINE 平台打進來)、GET /health(活著嗎)

import { verifySignature } from './line.js';
import { handleEvent } from './handler.js';
import * as state from './state.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    // 診斷:雲端此刻對「營業時間」的判斷(2026-07-16 排 schedule bug 用)
    if (request.method === 'GET' && url.pathname === '/diag/time') {
      const now = new Date();
      const tp = state.taipeiNow(now);
      const bh = state.isBusinessHours(now);
      const mode = await state.getMode(env);
      const active = await state.isBotActive(env, now);
      return Response.json({
        utcNow: now.toISOString(),
        taipeiHour: tp.hour, taipeiDay: tp.day, taipeiDateKey: tp.dateKey,
        isBusinessHours: bh, mode, isBotActive: active,
        expected: `week=${tp.day}(1-5=平日) hour=${tp.hour}(10-18=營業) → bot 應該 ${bh ? '閉嘴' : '值班'}`,
      });
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
