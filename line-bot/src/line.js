// LINE Messaging API 封裝:簽章驗證、回覆、輸入中動畫、取暱稱。
// 只用「回覆(reply)」不用「推播(push)」→ 不占官方帳號的訊息額度。

const API = 'https://api.line.me/v2/bot';

// 通行證:優先用「無狀態 token」(拿 Channel ID + secret 現場換,效期 15 分鐘,
// 沒有長期金鑰可外洩);若設了 LINE_CHANNEL_ACCESS_TOKEN 則直接沿用。
// 參考:https://developers.line.biz/en/reference/messaging-api/#issue-stateless-channel-access-token
async function getToken(env) {
  if (env.LINE_CHANNEL_ACCESS_TOKEN) return env.LINE_CHANNEL_ACCESS_TOKEN;
  const cached = await env.STATE.get('line_token');
  if (cached) return cached;
  const res = await fetch('https://api.line.me/oauth2/v3/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.LINE_CHANNEL_ID,
      client_secret: env.LINE_CHANNEL_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`LINE token ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  // 提前 2 分鐘視為過期,KV TTL 下限 60 秒
  const ttl = Math.max(60, (data.expires_in || 900) - 120);
  await env.STATE.put('line_token', data.access_token, { expirationTtl: ttl });
  return data.access_token;
}

// x-line-signature 驗證:HMAC-SHA256(channel secret, raw body) 的 base64
export async function verifySignature(secret, rawBody, signature) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // 常數時間比較
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function call(env, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getToken(env)}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LINE API ${path} ${res.status}: ${text}`);
  }
  return res;
}

// payload 可以是純字串(舊呼叫者)或 { text, emojis } 物件(帶 LINE 官方 emoji 的新版)
export async function reply(env, replyToken, payloads) {
  const list = (Array.isArray(payloads) ? payloads : [payloads]).filter(Boolean);
  if (!list.length) return;
  const messages = list.slice(0, 5).map((p) => {
    if (typeof p === 'string') return { type: 'text', text: p.slice(0, 4900) };
    const m = { type: 'text', text: String(p.text ?? '').slice(0, 4900) };
    if (p.emojis && p.emojis.length) m.emojis = p.emojis;
    return m;
  });
  await call(env, '/message/reply', { replyToken, messages });
}

// 聊天室顯示「輸入中…」動畫(免費,最長 60 秒,AI 思考時的禮貌)
export async function showLoading(env, chatId, seconds = 20) {
  try {
    await call(env, '/chat/loading/start', { chatId, loadingSeconds: seconds });
  } catch {
    // 動畫失敗不影響正事
  }
}

export async function getDisplayName(env, uid) {
  try {
    const res = await fetch(`${API}/profile/${uid}`, {
      headers: { Authorization: `Bearer ${await getToken(env)}` },
    });
    if (!res.ok) return null;
    const p = await res.json();
    return p.displayName || null;
  } catch {
    return null;
  }
}
