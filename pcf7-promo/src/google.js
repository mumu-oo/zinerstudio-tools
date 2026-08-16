// Google Sheets / Drive 存取 — service account JWT，Web Crypto 手刻，Worker 可跑

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cached = { token: null, exp: 0 };

/** 拿 access token（記憶體快取到期前 60 秒） */
export async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;

  const sa = JSON.parse(env.GOOGLE_SA_JSON);
  const header = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  }));
  const signInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signInput));
  const jwt = `${signInput}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`google token 失敗: ${JSON.stringify(json)}`);
  cached = { token: json.access_token, exp: now + (json.expires_in || 3600) };
  return cached.token;
}

/** 讀整張表（含標頭），回 { header: [...], rows: [{ _row: n, 欄名: 值 }] } */
export async function readSheet(env) {
  const token = await getAccessToken(env);
  const range = encodeURIComponent(`${env.SHEET_TAB}!A1:Z`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = await res.json();
  if (json.error) throw new Error(`readSheet: ${JSON.stringify(json.error)}`);
  const [header = [], ...data] = json.values || [];
  const rows = data.map((r, i) => {
    const o = { _row: i + 2 }; // Sheet 列號（1-based，第 1 列是標頭）
    header.forEach((h, j) => { o[h] = r[j] ?? ''; });
    return o;
  });
  return { header, rows };
}

/** 依欄名寫單格。找不到欄名 → 在標頭最右邊新增該欄再寫 */
export async function writeCell(env, header, rowNum, colName, value) {
  const token = await getAccessToken(env);
  let colIdx = header.indexOf(colName);
  if (colIdx === -1) {
    colIdx = header.length;
    header.push(colName);
    await putRange(env, token, `${env.SHEET_TAB}!${colLetter(colIdx)}1`, [[colName]]);
  }
  await putRange(env, token, `${env.SHEET_TAB}!${colLetter(colIdx)}${rowNum}`, [[value]]);
}

async function putRange(env, token, a1, values) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(a1)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  const json = await res.json();
  if (json.error) throw new Error(`putRange ${a1}: ${JSON.stringify(json.error)}`);
}

export function colLetter(idx) {
  let s = '';
  idx += 1;
  while (idx > 0) { const m = (idx - 1) % 26; s = String.fromCharCode(65 + m) + s; idx = Math.floor((idx - 1) / 26); }
  return s;
}

/** 從 Drive 分享連結抽 file id；支援 open?id= / file/d/ / uc?id= 三種 */
export function driveIdFromUrl(url) {
  const m = url.match(/[?&]id=([\w-]+)/) || url.match(/\/file\/d\/([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  return m ? m[1] : null;
}

/** 下載 Drive 圖檔，回 { bytes: ArrayBuffer, mime: string } */
export async function downloadDriveFile(env, fileId) {
  const token = await getAccessToken(env);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`drive download ${fileId}: HTTP ${res.status}`);
  return { bytes: await res.arrayBuffer(), mime: res.headers.get('content-type') || 'application/octet-stream' };
}
