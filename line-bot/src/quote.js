// 計價引擎:七項表格 → 程式算總額。規格=PRICING_RULES.md(權威來源 Ziner Invoice 桌面版)。
// 鐵律:錢的計算永遠在程式、不在 LLM(2026-07-03 實測 LLM 心算翻車後定案)。
// 客人貼回填好的 ►表格 → handler 先交給這裡,算得出來就直接回總額,AI 全程不碰數字。

// ---- 墨色表(同 ziner-invoice INKS,金 2026-08-08 漲價 220) ----
const INKS = [
  { name: '黑', tier: '一般', price: 110, aliases: ['黑', '黑色'] },
  { name: '青藍', tier: '一般', price: 110, aliases: ['青藍', '藍', '藍色'] },
  { name: '綠', tier: '一般', price: 110, aliases: ['綠', '綠色'] },
  { name: '黃', tier: '一般', price: 110, aliases: ['黃', '黃色'] },
  { name: '赤紅', tier: '一般', price: 110, aliases: ['赤紅', '紅', '紅色'] },
  { name: '紫堇', tier: '一般', price: 110, aliases: ['紫堇', '紫', '紫色'] },
  { name: '螢粉', tier: '螢光', price: 130, aliases: ['螢粉', '螢光粉', '粉', '粉紅'] },
  { name: '螢橘', tier: '螢光', price: 130, aliases: ['螢橘', '螢光橘', '橘', '橘色'] },
  { name: '天空', tier: '高級', price: 170, aliases: ['天空', '天空藍'] },
  { name: '薄荷', tier: '高級', price: 170, aliases: ['薄荷', '薄荷綠'] },
  { name: '金', tier: '特殊', price: 220, aliases: ['金', '金色', '金墨'] },
];

// ---- 紙材表(同 ziner-invoice DEFAULT_PAPER_CATALOG) ----
const PAPERS = [
  { name: '白尺紙 220g', price: 6, lining: true, aliases: ['白尺220', '白尺紙220'] },
  { name: '米牙紙 220g', price: 6, lining: true, aliases: ['米牙220', '米牙紙220'] },
  { name: '白尺紙 100g', price: 3, lining: false, aliases: ['白尺100', '白尺紙100'] },
  { name: '米牙紙 100g', price: 3, lining: false, aliases: ['米牙100', '米牙紙100'] },
  { name: '柳橙紙 89g', price: 7, lining: false, aliases: ['柳橙', '柳橙紙'] },
  { name: '寶藍紙 89g', price: 7, lining: false, aliases: ['寶藍', '寶藍紙'] },
  { name: '紅葉紙 100g', price: 6, lining: false, aliases: ['紅葉', '紅葉紙'] },
  { name: '赤銀河 120g', price: 8, lining: false, aliases: ['赤銀河'] },
  { name: '胭脂紙 240g', price: 10, lining: false, aliases: ['胭脂', '胭脂紙'] },
  { name: '蓮紫紙 116g', price: 10, lining: false, aliases: ['蓮紫', '蓮紫紙'] },
  { name: '鴨綠紙 116g', price: 10, lining: false, aliases: ['鴨綠', '鴨綠紙'] },
  { name: '可可紙 116g', price: 10, lining: false, aliases: ['可可', '可可紙'] },
];
// 「米牙」「白尺」沒寫克數 → 預設 220g(常用款),回覆會標明這個假設
const PAPER_DEFAULT_HINT = { 米牙: '米牙紙 220g', 白尺: '白尺紙 220g' };

// ---- 尺寸表(mm;B 系為 JIS,台灣印刷通行) ----
const SIZES = {
  A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148], A7: [74, 105],
  B4: [257, 364], B5: [182, 257], B6: [128, 182], B7: [91, 128],
};

// ---- 落版(PRICING_RULES §3:A3 全版 297×420、出血+6、版間距 15、紙邊留白 5、允許整批旋轉) ----
export function imposition(w, h) {
  const usableW = 297 - 10, usableH = 420 - 10, gap = 15;
  const fit = (pw, ph) =>
    Math.floor((usableW + gap) / (pw + gap)) * Math.floor((usableH + gap) / (ph + gap));
  const bw = w + 6, bh = h + 6;
  return Math.max(fit(bw, bh), fit(bh, bw));
}

// ---- 裁切分類(PRICING_RULES §2/已決 2:名片 300、明信片(≤190×120)250、特殊=4刀×落版×50) ----
function cutFee(w, h, layout, qty) {
  const fitsIn = (bw, bh) => (w <= bw && h <= bh) || (h <= bw && w <= bh);
  if (fitsIn(95, 60)) return { fee: 300 * Math.ceil(qty / 500), label: '名片規格' };
  if (fitsIn(190, 120)) return { fee: 250 * Math.ceil(qty / 200), label: '明信片規格' };
  const knives = 4 * layout;
  return { fee: knives * 50, label: `特殊尺寸 ${knives} 刀`, adjustable: true };
}

// ---- 備量(PRICING_RULES §4,她自承「變動很大」→只當粗略預設值) ----
function wasteSheets(frontCount, backCount) {
  const doubleSided = backCount > 0;
  if (doubleSided) return frontCount <= 1 && backCount <= 1 ? 5 : 10;
  return frontCount <= 2 ? 5 : 10;
}

function findInk(token) {
  const t = token.trim();
  return INKS.find((i) => i.aliases.includes(t)) || null;
}
function findPaper(raw) {
  const t = raw.replace(/\s+/g, '');
  for (const p of PAPERS) {
    if (p.aliases.some((a) => t === a || t === a + 'g') || t === p.name.replace(/\s+/g, '')) return p;
  }
  // 沒寫克數的常用款 → 預設 220g
  for (const [prefix, full] of Object.entries(PAPER_DEFAULT_HINT)) {
    if (t.startsWith(prefix)) return { ...PAPERS.find((p) => p.name === full), assumed220: true };
  }
  return null;
}
function parseSize(raw) {
  const t = raw.replace(/\s+/g, '').toUpperCase();
  if (SIZES[t]) return { w: SIZES[t][0], h: SIZES[t][1], label: t };
  // 支援小數(29.7×21)與 cm 單位(29.7×21cm→297×210mm);沒寫單位當 mm
  const m = t.match(/^(\d{1,4}(?:\.\d+)?)[X×*](\d{1,4}(?:\.\d+)?)(MM|CM)?$/);
  if (m) {
    const unit = m[3] === 'CM' ? 10 : 1;
    return { w: +m[1] * unit, h: +m[2] * unit, label: `${m[1]}×${m[2]}${(m[3] || 'mm').toLowerCase()}` };
  }
  return null;
}

// ---- ►表格解析:回 { fields, missing } ----
// 寬容:全半形冒號、有無 ►、yes/no/要/不要、墨色分隔(｜/、+空白)
export function parseQuoteForm(text) {
  const t = String(text || '')
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':');
  const grab = (label) => {
    const m = t.match(new RegExp(`${label}\\s*:\\s*([^\\n►]*)`));
    return m ? m[1].trim() : null;
  };
  const yesNo = (s) => {
    if (s == null) return null;
    if (/yes|要|需要|是|有/i.test(s)) return true;
    if (/no|不要|不需|否|免|無/i.test(s)) return false;
    return null;
  };
  // 分隔:半形＋、全形＋、逗號、頓號、｜|、斜線、空白;過濾掉空 marker(—/-/–/無)
  const splitInks = (s) => s.split(/[｜|、,+＋\/\s]+/).filter((t) => t && !/^[—–\-無]+$/.test(t));

  const fields = {};
  const missing = [];

  const sheetsRaw = grab('印刷張數');
  const sheets = sheetsRaw ? parseInt(sheetsRaw.replace(/[^\d]/g, ''), 10) : NaN;
  if (sheets > 0) fields.sheets = sheets; else missing.push('印刷張數');

  const inkRaw = grab('使用墨色');
  if (inkRaw && !/[?？]/.test(inkRaw)) {
    const sideOf = (side) => {
      const m = inkRaw.match(new RegExp(`${side}\\s*([^｜|]*)`));
      return m ? splitInks(m[1]) : [];
    };
    let front = sideOf('正面'), back = sideOf('反面');
    if (!front.length && !back.length) { front = splitInks(inkRaw); }
    const frontInks = front.map(findInk), backInks = back.map(findInk);
    if (frontInks.length && frontInks.every(Boolean) && backInks.every(Boolean)) {
      fields.front = frontInks; fields.back = backInks.filter(Boolean);
    } else missing.push('使用墨色(需為誌造所色名:黑/青藍/綠/黃/赤紅/紫堇/螢粉/螢橘/天空/薄荷/金)');
  } else missing.push('使用墨色');

  const sizeRaw = grab('完成尺寸');
  const size = sizeRaw ? parseSize(sizeRaw) : null;
  if (size) fields.size = size; else missing.push('完成尺寸');

  const paperRaw = grab('使用紙材');
  const paper = paperRaw ? findPaper(paperRaw) : null;
  if (paper) fields.paper = paper; else missing.push('使用紙材');

  const lining = yesNo(grab('襯紙需求'));
  if (lining !== null) fields.lining = lining; else missing.push('襯紙需求');

  const cutting = yesNo(grab('裁切需求'));
  if (cutting !== null) fields.cutting = cutting; else missing.push('裁切需求');

  return { fields, missing };
}

// 訊息像不像在填表:至少 3 個欄位標籤才嘗試(避免一般聊天誤觸)
export function looksLikeQuoteForm(text) {
  const labels = ['印刷張數', '印刷色數', '使用墨色', '完成尺寸', '使用紙材', '襯紙需求', '裁切需求'];
  const hits = labels.filter((l) => String(text || '').includes(l)).length;
  return hits >= 3;
}

// ---- 可疑值檢查:引擎判定「這值超過預設、可能是筆誤」→ 交給程式反問 ----
// (AI 腦子留給語言判斷,數值範圍檢查該給程式;2026-08-09 Elsa Cheng 案例:
//  29.7×21mm 明顯是想寫 A4 的 cm 版本、漏了 c 字元,程式該反問而不是照小算。)
export function sanityCheck(fields) {
  const issues = [];
  const s = fields.size;
  if (s.w < 30 || s.h < 30) {
    const cmVer = `${+(s.w * 10).toFixed(1)}×${+(s.h * 10).toFixed(1)}mm`;
    issues.push({
      field: '完成尺寸', value: s.label,
      hint: '比一般名片（90×54mm）還小',
      guess: `會不會是想寫 cm、實際是 ${cmVer}？`,
    });
  }
  if (s.w > 297 || s.h > 297) {
    issues.push({
      field: '完成尺寸', value: s.label,
      hint: '超過 A3 印刷範圍（最大 297×420mm）',
      guess: null,
    });
  }
  if (fields.sheets > 5000) {
    issues.push({
      field: '印刷張數', value: `${fields.sheets} 張`,
      hint: '數量偏大（一般案子多在幾百張以內）',
      guess: null,
    });
  }
  const inkTotal = fields.front.length + fields.back.length;
  if (inkTotal > 8) {
    issues.push({
      field: '使用墨色', value: `正反共 ${inkTotal} 種`,
      hint: '色數偏多（誌造所色墨共 11 種、單案通常 2〜4 種）',
      guess: null,
    });
  }
  return issues.length ? issues : null;
}

export function sanityReplyBody(issues) {
  const lines = ['貼的表格裡有一個地方需要再確認一下唷～', ''];
  for (const it of issues) {
    lines.push(`・${it.field}「${it.value}」${it.hint}${it.guess ? '——' + it.guess : ''}`);
  }
  lines.push('', '麻煩再確認一下，把七項表格重新貼一次～');
  return lines.join('\n');
}

// ---- 主計算:fields → { total, items, meta } ----
export function calcQuote({ sheets, front, back, size, paper, lining, cutting }) {
  const items = [];
  const notes = [];

  // 拼版與 A3 張數
  const isA3Direct = size.label === 'A3';
  const layout = isA3Direct ? 1 : imposition(size.w, size.h);
  if (layout < 1) return { ok: false, reason: `尺寸 ${size.label} 超過 A3 可印範圍` };
  const baseA3 = Math.ceil(sheets / layout);
  const waste = wasteSheets(front.length, back.length);
  const totalA3 = baseA3 + waste;

  // 製版費:每色每版(正反面各自計)
  for (const ink of [...front, ...back]) {
    items.push({ name: `製版費(${ink.name})`, price: ink.price, qty: 1 });
  }
  // 印刷基本費
  items.push({ name: '印刷基本費', price: 250, qty: 1 });
  // 印刷費(含備量)
  items.push({ name: '印刷費', price: 5.5, qty: totalA3 });
  // 紙材費(含備量)
  items.push({ name: `紙材費(${paper.name})`, price: paper.price, qty: totalA3 });
  // 襯紙
  if (lining) {
    if (paper.lining) items.push({ name: '襯紙', price: 1.5, qty: totalA3 });
    else notes.push(`${paper.name} 非 220g 系,不需襯紙,未計襯紙費`);
  }
  // 裁切
  if (cutting && !isA3Direct) {
    const cut = cutFee(size.w, size.h, layout, sheets);
    items.push({ name: `裁切費(${cut.label})`, price: cut.fee, qty: 1 });
    if (cut.adjustable) notes.push('特殊尺寸裁切照落版計刀,實際金額可能酌調');
  } else if (cutting && isA3Direct) {
    items.push({ name: '裁切費(指定裁切)', price: 200, qty: 1 });
  }
  if (paper.assumed220) notes.push('紙材未註克數,以 220g 計');

  const total = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0));
  return {
    ok: true, total, items, notes,
    meta: { layout, baseA3, waste, totalA3, sizeLabel: size.label },
  };
}

// ---- 給客人看的回覆(她 2026-07-03 拍板:報價不列細項、總額即可) ----
export function quoteReplyBody(fields, result) {
  const sides = fields.back.length
    ? `正面 ${fields.front.map((i) => i.name).join('、')}｜反面 ${fields.back.map((i) => i.name).join('、')}`
    : `單面 ${fields.front.map((i) => i.name).join('、')}`;
  const lines = [
    '收到你的報價表格，先幫你試算囉～',
    `・${fields.size.label}｜${fields.sheets} 張｜${fields.paper.name}`,
    `・墨色：${sides}`,
    `・襯紙：${fields.lining ? '要' : '不用'}｜裁切：${fields.cutting ? '要' : '不用'}`,
    '',
    `金額試算：${result.total.toLocaleString('en-US')} 元`,
    '（未含運費；已含粗略備量抓法，實際以 MUMU 檢稿後回覆為準）',
  ];
  if (result.notes.length) lines.push(...result.notes.map((n) => `※ ${n}`));
  lines.push('', '想自己調整條件試試，也可以用線上試算機：https://www.zinerstudio.com/quote');
  return lines.join('\n');
}

// ---- 給穆穆看的 Discord 明細(她要能對帳) ----
export function quoteDetailForMumu(fields, result) {
  const rows = result.items.map((it) =>
    it.qty === 1 ? `${it.name} ${it.price}` : `${it.name} ${it.price}×${it.qty}=${Math.round(it.price * it.qty)}`,
  );
  return [
    `拼版：${fields.size.label} 一張 A3 落 ${result.meta.layout} 版 → ${result.meta.baseA3} 張＋備量 ${result.meta.waste} 張`,
    ...rows,
    `合計 ${result.total.toLocaleString('en-US')} 元`,
  ].join('\n');
}
