// 發噗浪一則：抓圖 → 上傳 CDN → plurkAdd → 超字接 responseAdd
import { driveIdFromUrl, downloadDriveFile } from './google.js';
import { uploadPicture, plurkAdd, responseAdd, plurkUrl } from './plurk.js';
import { renderPlurk, imageUrls, LIMITS } from './template.js';

const MAX_IMAGES = 5;

export async function postPlurk(env, f) {
  const dry = env.DRY_RUN === 'true';
  const { main, reply } = renderPlurk(f);

  // 1. 圖片：Drive → 噗浪 CDN
  const urls = imageUrls(f.imgRaw).slice(0, MAX_IMAGES);
  const cdn = [];
  for (const u of urls) {
    const id = driveIdFromUrl(u);
    if (!id) { cdn.push({ src: u, skipped: 'not-drive' }); continue; }
    if (dry) { cdn.push({ src: u, dry: true }); continue; }
    try {
      const { bytes, mime } = await downloadDriveFile(env, id);
      const up = await uploadPicture(env, bytes, mime, `${id}.jpg`);
      cdn.push({ src: u, full: up.full });
    } catch (e) {
      cdn.push({ src: u, error: String(e.message || e) });
    }
  }
  const imgLine = cdn.filter((c) => c.full).map((c) => c.full).join(' ');

  // 2. 圖片網址接在主噗尾巴（噗浪會自動展開）；若超字就往留言放
  let content = imgLine ? `${main}\n${imgLine}` : main;
  let replyContent = reply;
  if (content.length > LIMITS.plurk && imgLine) {
    content = main;
    replyContent = replyContent ? `${replyContent}\n${imgLine}` : imgLine;
  }

  if (dry) return { dry_run: true, content, reply: replyContent, images: cdn };

  // 3. 發
  const p = await plurkAdd(env, content, { qualifier: 'shares', lang: 'tr_ch' });
  const out = { plurk_id: p.plurk_id, url: plurkUrl(p.plurk_id), images: cdn };
  if (replyContent) {
    try { const r = await responseAdd(env, p.plurk_id, replyContent); out.reply_id = r.id; }
    catch (e) { out.reply_error = String(e.message || e); }
  }
  return out;
}
