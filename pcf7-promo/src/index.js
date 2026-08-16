// PCF 7 宣傳自動化 — Worker 入口
//   cron（15 分）→ runOnce()：讀 Sheet → 挑到期列 → 發三平台 → 回寫狀態
//   GET /            健康檢查
//   GET /preview?row=N   看第 N 列套出來的三平台文案（不發）
//   GET /run?key=..  手動觸發一輪（key = ADMIN_KEY secret；沒設就開放，開發期用）
//   GET /status      今天排程總覽

import { readSheet, writeCell } from './google.js';
import { pickFields, renderPlurk, renderThreads, renderIG, imageUrls } from './template.js';
import { pickDue, nowTaipei, slots } from './schedule.js';
import { postPlurk } from './post-plurk.js';

const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const text = (t, s = 200) => new Response(t, { status: s, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export default {
  async scheduled(_ctrl, env, ctx) {
    ctx.waitUntil(runOnce(env).catch((e) => console.error('cron 失敗', e)));
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return text(`pcf7-promo ok · ${nowTaipei().dateKey} ${nowTaipei().hm} Taipei · DRY_RUN=${env.DRY_RUN}`);

    if (url.pathname === '/preview') {
      const n = Number(url.searchParams.get('row'));
      if (!n) return text('用法：/preview?row=2', 400);
      const { rows } = await readSheet(env);
      const row = rows.find((r) => r._row === n);
      if (!row) return text(`第 ${n} 列不存在`, 404);
      const f = pickFields(row);
      return json({ row: n, fields: f, images: imageUrls(f.imgRaw), plurk: renderPlurk(f), threads: renderThreads(f), ig: renderIG(f) });
    }

    if (url.pathname === '/status') {
      const { rows } = await readSheet(env);
      const { all, overflow } = pickDue(rows, env);
      return json({
        now: nowTaipei(), slots: slots(env), dry_run: env.DRY_RUN,
        today: all.map((x) => ({ row: x.r._row, name: x.r['攤位名稱 Booth Name'], slot: x.hm, status: x.r['發文狀態'] || 'pending' })),
        overflow: overflow.map((x) => x.r._row),
      });
    }

    if (url.pathname === '/run') {
      if (env.ADMIN_KEY && url.searchParams.get('key') !== env.ADMIN_KEY) return text('forbidden', 403);
      const report = await runOnce(env);
      return json(report);
    }

    return text('not found', 404);
  },
};

/** 一輪：讀表 → 挑到期 → 逐列發 → 回寫 */
export async function runOnce(env) {
  const { header, rows } = await readSheet(env);
  const { due, overflow } = pickDue(rows, env);
  const now = nowTaipei();
  const report = { at: `${now.dateKey} ${now.hm}`, dry_run: env.DRY_RUN === 'true', due: due.length, overflow: overflow.map((x) => x.r._row), results: [] };

  for (const { r, hm } of due) {
    const f = pickFields(r);
    const res = { row: r._row, name: f.name, slot: hm };
    try {
      const out = await postPlurk(env, f);
      res.plurk = out;
      const status = out.dry_run ? 'posted(dry)' : 'posted';
      await writeCell(env, header, r._row, '發文狀態', `${status} ${now.dateKey} ${now.hm}`);
      if (out.url) await writeCell(env, header, r._row, '噗浪連結', out.url);
    } catch (e) {
      res.error = String(e.message || e);
      const prev = (r['發文狀態'] || '').match(/^retry:(\d+)/);
      const n = prev ? Number(prev[1]) + 1 : 1;
      const status = n >= 3 ? `failed ${res.error.slice(0, 80)}` : `retry:${n} ${res.error.slice(0, 60)}`;
      await writeCell(env, header, r._row, '發文狀態', status);
    }
    report.results.push(res);
  }
  console.log(JSON.stringify(report));
  return report;
}
