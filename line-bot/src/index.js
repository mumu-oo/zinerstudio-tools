// 誌造所 LINE 客服小精靈 — Cloudflare Worker 入口
// 路由:POST /webhook(LINE 平台打進來)、GET /health(活著嗎)

import { verifySignature } from './line.js';
import { handleEvent } from './handler.js';
import { verifyAction } from './hmac.js';
import { notify, systemNoteCard } from './notify.js';
import * as state from './state.js';

// Discord 按鈕按下去打開的簡單狀態頁(手機 in-app browser 也 render 得漂亮)
function htmlPage(title, body, status = 200) {
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f7f5f2">
<title>${title}｜孔版AI助手</title>
<style>
  html,body { margin:0; padding:0; background:#f7f5f2; font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif; color:#222; }
  main { max-width:420px; margin:20vh auto 0; padding:0 24px; text-align:center; }
  h1 { font-size:32px; margin:0 0 16px; letter-spacing:.02em; }
  p { font-size:15px; line-height:1.75; color:#555; margin:0 0 8px; }
  .hint { margin-top:32px; font-size:13px; color:#a0a0a0; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>${body}</p>
  <p class="hint">關掉此頁即可 · 動作已完成</p>
</main>
</body>
</html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

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

    // Discord 按鈕遙控:接手 / 放行(link button 打開這個 URL,不走 Discord Interactions)
    // URL 帶 HMAC 簽名(見 hmac.js),來自 escalationButtons 的按鈕才過得了簽章驗證
    if (request.method === 'GET' && url.pathname === '/dc-action') {
      const a = url.searchParams.get('a');
      const s = url.searchParams.get('s');
      const sig = url.searchParams.get('sig');
      if (!env.ACTION_SECRET) {
        return htmlPage('尚未啟用', '這個 worker 還沒設定 ACTION_SECRET,按鈕功能停用。', 503);
      }
      if (!sig || !s || (a !== 't' && a !== 'r')) {
        return htmlPage('參數錯誤', '這個連結格式不對,可能不是我發的。', 400);
      }
      const ok = await verifyAction(env.ACTION_SECRET, a, s, sig);
      if (!ok) {
        return htmlPage('簽章錯誤', '這個連結沒有正確簽名,拒絕執行。', 403);
      }
      const uid = await state.resolveRoom(env, s);
      if (!uid) {
        return htmlPage('找不到房間', `代號 #${s} 已過期或不存在(客人聊天室代號保留 30 天)。`, 404);
      }
      if (a === 't') {
        await state.muteRoom(env, uid, 7 * 24 * 3600);
        ctx.waitUntil(notify(env, systemNoteCard('接手房間（Discord 按鈕）', [
          `代號：#${s}`,
          'AI 已在該房閉嘴（7 天後自動解除，或按同則通知的「✅ 放行」）。',
        ])));
        return htmlPage('✋ 已接手', `#${s} 那間妳來，AI 助手不插嘴。`);
      }
      // a === 'r'
      await state.unmuteRoom(env, uid);
      ctx.waitUntil(notify(env, systemNoteCard('放行房間（Discord 按鈕）', [
        `代號：#${s}`,
        'AI 恢復服務這間。',
      ])));
      return htmlPage('✅ 已放行', `#${s} 已放行，AI 助手恢復服務這間。`);
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
