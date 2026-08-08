// HMAC-SHA256 簽章 + base64url — 給 Discord link button 用的 URL 上簽名,
// 讓穆穆從 Discord 按按鈕直接接手/放行,worker 收到 GET 才知道這是真的授權過。
// 沒有這層,任何知道 URL 格式的人都可以按接手,擾亂客服流程。

function b64urlEncode(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64urlEncode(sig);
}

// 對「action:sid」字串簽名。action 只有 't'(takeover) / 'r'(release) 兩種,
// 加上 sid 一起簽,可以避免有人拿 A 房的接手 sig 去換 B 房的接手。
export async function signAction(secret, action, sid) {
  return hmac(secret, `${action}:${sid}`);
}

// 常數時間比對(即使長度不同也視為不符)
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyAction(secret, action, sid, sig) {
  const expected = await signAction(secret, action, sid);
  return timingSafeEqual(expected, sig);
}
