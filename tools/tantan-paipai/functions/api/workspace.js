// POST /api/workspace — 建 workspace
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || '未命名').slice(0, 60);
  const initialData = body.data || { cards: [], assignments: { 1: {}, 2: {} }, unlinked: null };
  const id = generateId();
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO workspaces (id, name, data, updated_at, updated_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, name, JSON.stringify(initialData), now, body.updated_by || null, now).run();
  return json({ id, name, data: initialData, updated_at: now });
}

function generateId() {
  // 8 字元亂碼 URL-safe、避開容易誤認的 0/O/1/l/I
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[arr[i] % chars.length];
  return out;
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
