// 密碼檢查 helper
async function checkPassword(env, id, request) {
  const row = await env.DB.prepare('SELECT password_hash FROM workspaces WHERE id = ?').bind(id).first();
  if (!row) return { ok: false, status: 404 };
  if (!row.password_hash) return { ok: true };  // 沒設密碼、放行
  const provided = request.headers.get('x-ws-password-hash') || '';
  if (provided !== row.password_hash) return { ok: false, status: 401 };
  return { ok: true };
}

// GET /api/workspace/[id] — 讀 workspace
export async function onRequestGet({ params, request, env }) {
  const chk = await checkPassword(env, params.id, request);
  if (!chk.ok) return json({ error: chk.status === 401 ? 'auth' : 'not found' }, chk.status);
  const row = await env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(params.id).first();
  if (!row) return json({ error: 'not found' }, 404);
  return json({
    id: row.id,
    name: row.name,
    data: JSON.parse(row.data),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    has_password: !!row.password_hash,
  });
}

// PUT /api/workspace/[id] — 寫 workspace（帶 base_updated_at 做衝突偵測）
export async function onRequestPut({ params, request, env }) {
  const chk = await checkPassword(env, params.id, request);
  if (!chk.ok) return json({ error: chk.status === 401 ? 'auth' : 'not found' }, chk.status);
  const body = await request.json().catch(() => null);
  if (!body || !body.data) return json({ error: 'bad body' }, 400);
  const current = await env.DB.prepare('SELECT updated_at FROM workspaces WHERE id = ?').bind(params.id).first();
  if (!current) return json({ error: 'not found' }, 404);

  // 樂觀鎖：若 base_updated_at 對不上目前的 updated_at → 衝突
  if (typeof body.base_updated_at === 'number' && body.base_updated_at !== current.updated_at) {
    return json({ error: 'conflict', current_updated_at: current.updated_at }, 409);
  }

  const now = Date.now();
  await env.DB.prepare('UPDATE workspaces SET data = ?, updated_at = ?, updated_by = ? WHERE id = ?')
    .bind(JSON.stringify(body.data), now, body.updated_by || null, params.id).run();
  return json({ updated_at: now });
}

// PATCH /api/workspace/[id] — 改名 / 設密碼
export async function onRequestPatch({ params, request, env }) {
  const chk = await checkPassword(env, params.id, request);
  if (!chk.ok) return json({ error: chk.status === 401 ? 'auth' : 'not found' }, chk.status);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'bad body' }, 400);
  const updates = [];
  const binds = [];
  if (typeof body.name === 'string') {
    updates.push('name = ?');
    binds.push(body.name.slice(0, 60));
  }
  if (typeof body.set_password_hash === 'string') {
    updates.push('password_hash = ?');
    binds.push(body.set_password_hash || null);
  }
  if (updates.length === 0) return json({ error: 'nothing to update' }, 400);
  binds.push(params.id);
  const r = await env.DB.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
  if (!r.meta.changes) return json({ error: 'not found' }, 404);
  return json({ ok: true });
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
