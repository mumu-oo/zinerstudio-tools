// LINE Messaging API 封裝:簽章驗證、回覆、輸入中動畫、取暱稱。
// 只用「回覆(reply)」不用「推播(push)」→ 不占官方帳號的訊息額度。

const API = 'https://api.line.me/v2/bot';

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
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LINE API ${path} ${res.status}: ${text}`);
  }
  return res;
}

export async function reply(env, replyToken, texts) {
  const list = (Array.isArray(texts) ? texts : [texts]).filter(Boolean);
  if (!list.length) return;
  await call(env, '/message/reply', {
    replyToken,
    messages: list.slice(0, 5).map((t) => ({ type: 'text', text: String(t).slice(0, 4900) })),
  });
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
      headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const p = await res.json();
    return p.displayName || null;
  } catch {
    return null;
  }
}
