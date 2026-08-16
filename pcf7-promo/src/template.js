// 貼文範本 — 照 2025 噗浪格式 Doc，footer 換 2026 台創祭 7 資訊
// 欄名對應 2026 Sheet：攤位名稱 Booth Name / IG帳號 Instagram Account / 分享網站 / 攤位號碼 Booth Number / 自我介紹 Self-Introduction

export const LIMITS = { plurk: 360, threads: 500, ig: 2200 };

// 2026 台創祭 7 固定 footer（噗浪 bio 撈的；票券連結待補）
export const FOOTER_PLURK = `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏
𓊼 台創祭7 Publishing Creatively Fair 𓊼

2026.10.31-11.01
📍松山文創園區 3+4+5號倉庫
主辦｜誌造所 x GJ工作室`;

export const FOOTER_THREADS = `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏
𓊼 台創祭7 𓊼
2026.10.31-11.01
📍松山文創園區 3+4+5號倉庫
主辦｜@zinerstudio + @gjs.tw`;

export const FOOTER_IG = `﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏
𓊼 台創祭7 Publishing Creatively Fair 𓊼

2026.10.31-11.01  11:00-17:30
📍松山文創園區 3+4+5號倉庫
主辦｜@zinerstudio x @gjs.tw

#台創祭7 #台創祭 #PCF7 #獨立出版 #松山文創 #創作市集`;

/** IG 欄位清成 @handle（容忍「@xxx」「xxx」「https://instagram.com/xxx」「無」等） */
export function igHandle(raw) {
  const s = (raw || '').trim();
  if (!s || /^(無|沒有|none|n\/a|-)$/i.test(s)) return '';
  const m = s.match(/instagram\.com\/([\w.]+)/i);
  const h = m ? m[1] : s.replace(/^@/, '').split(/[\s/]/)[0];
  return h ? `@${h}` : '';
}

/** 攤位號碼正規化：去多餘空白，「E16 / --」→「E16 / --」保留原意 */
export function boothNo(raw) {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

/** 抽 Sheet 一列 → 統一欄位物件 */
export function pickFields(row) {
  return {
    name: (row['攤位名稱 Booth Name'] || '').trim(),
    ig: igHandle(row['IG帳號 Instagram Account']),
    site: (row['分享網站'] || '').trim(),
    booth: boothNo(row['攤位號碼 Booth Number']),
    intro: (row['自我介紹 Self-Introduction'] || '').trim(),
    imgRaw: (row['分享圖片'] || '').trim(),
  };
}

/** 主體（不含 footer） */
function body(f, { withHashtagHead = true } = {}) {
  const head = withHashtagHead ? '｜ #台創祭7 攤位介紹｜' : '｜ 台創祭7 攤位介紹｜';
  const lines = [head, `⚑ ${f.name}`];
  if (f.ig) lines.push(f.ig);
  if (f.site) lines.push(f.site);
  lines.push('', `出攤情報 ⚑ ${f.booth}`);
  return lines.join('\n');
}

/**
 * 組噗浪：主噗 = 主體 + 自介 + footer；超 360 → 自介移到留言
 * 回 { main, reply|null }
 */
export function renderPlurk(f) {
  const b = body(f);
  const full = `${b}\n${f.intro}\n\n${FOOTER_PLURK}`;
  if (full.length <= LIMITS.plurk) return { main: full, reply: null };
  // 主噗放不下：主噗只留主體+footer，自介整段進留言
  return { main: `${b}\n\n${FOOTER_PLURK}`, reply: f.intro };
}

/** Threads：主文 = 主體 + 自介 + footer；超 500 → 自介移到 reply */
export function renderThreads(f) {
  const b = body(f);
  const full = `${b}\n${f.intro}\n\n${FOOTER_THREADS}`;
  if (full.length <= LIMITS.threads) return { main: full, reply: null };
  return { main: `${b}\n\n${FOOTER_THREADS}`, reply: f.intro };
}

/** IG caption：一則塞完（2200 幾乎不會爆） */
export function renderIG(f) {
  const b = body(f, { withHashtagHead: false });
  const full = `${b}\n${f.intro}\n\n${FOOTER_IG}`;
  return { main: full.slice(0, LIMITS.ig), reply: null };
}

/** 抽圖片連結陣列（Sheet 欄可能是「url, url , url」逗號分隔） */
export function imageUrls(raw) {
  return (raw || '').split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
}
