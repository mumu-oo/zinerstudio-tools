// 噗浪 API 2.0 — OAuth 1.0a HMAC-SHA1，Web Crypto 手刻
// 反洪水錯誤：anti-flood-same-content / anti-flood-spam-domain / anti-flood-too-many-new

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmacSha1Base64(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** 簽好一個請求並送出；params 是 body 參數（會一起參與簽名，非 multipart 時） */
async function signedFetch(env, url, method, params = {}, { multipart = null } = {}) {
  const oauth = {
    oauth_consumer_key: env.PLURK_APP_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env.PLURK_TOKEN,
    oauth_version: '1.0',
  };
  // multipart 時 body 參數不參與簽名（OAuth 1.0a 規範）
  const signParams = multipart ? oauth : { ...oauth, ...params };
  const paramStr = Object.keys(signParams).sort().map((k) => `${enc(k)}=${enc(signParams[k])}`).join('&');
  const base = [method, enc(url), enc(paramStr)].join('&');
  const signingKey = `${enc(env.PLURK_APP_SECRET)}&${enc(env.PLURK_TOKEN_SECRET)}`;
  const signature = await hmacSha1Base64(signingKey, base);
  const authHeader = 'OAuth ' + Object.entries({ ...oauth, oauth_signature: signature })
    .map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');

  const init = { method, headers: { Authorization: authHeader } };
  if (multipart) {
    init.body = multipart;
  } else if (method === 'POST') {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`plurk ${url.split('/APP/')[1]}: HTTP ${res.status} ${json.error_text || text}`);
    err.plurkError = json.error_text; err.status = res.status;
    throw err;
  }
  return json;
}

/** 上傳圖片到噗浪 CDN，回 { full, thumbnail } */
export async function uploadPicture(env, bytes, mime, filename = 'image.jpg') {
  const fd = new FormData();
  fd.append('image', new Blob([bytes], { type: mime }), filename);
  return signedFetch(env, 'https://www.plurk.com/APP/Timeline/uploadPicture', 'POST', {}, { multipart: fd });
}

/** 發一則噗；回整包 plurk 物件（含 plurk_id） */
export async function plurkAdd(env, content, { qualifier = 'shares', lang = 'tr_ch' } = {}) {
  return signedFetch(env, 'https://www.plurk.com/APP/Timeline/plurkAdd', 'POST', { content, qualifier, lang });
}

/** 在某噗底下留言（自介超字時接續用） */
export async function responseAdd(env, plurkId, content, { qualifier = 'says' } = {}) {
  return signedFetch(env, 'https://www.plurk.com/APP/Responses/responseAdd', 'POST', { plurk_id: String(plurkId), content, qualifier });
}

/** 噗浪 plurk_id → 公開網址（base36） */
export function plurkUrl(plurkId) {
  return `https://www.plurk.com/p/${Number(plurkId).toString(36)}`;
}

/** 反洪水錯誤判定（要 retry 的） */
export function isAntiFlood(err) {
  return typeof err?.plurkError === 'string' && err.plurkError.startsWith('anti-flood');
}
