// 把穆穆的「孔版客服QA」CSV 轉成 data/kb.json
// 用法:node tools/convert-kb.mjs
// 關鍵字表(aliases)是檢索用的:客人訊息裡出現這些字 → 命中該條目。
// 新增/修改 QA 時:改 CSV 或直接改這裡的 aliases,重跑本腳本。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(ROOT, 'data/source/孔版客服QA - 工作表1.csv');
const OUT = join(ROOT, 'data/kb.json');

// ---- 陽春但正確的 CSV 解析(支援引號內換行)----
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cell += c;
    } else if (c === '"') inQuote = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---- 每個分組的檢索關鍵字(對照真實客問手工整理)----
const ALIASES = {
  '解析度': ['解析度', 'dpi', 'DPI', '畫質', '模糊', '解析'],
  '檔案格式': ['格式', 'jpg', 'jpeg', 'psd', 'ai檔', 'AI檔', 'pdf', 'png', '什麼檔', '檔案類型', '準備檔案', '檔案準備', '給檔', '交檔', '檔案要求'],
  '色彩設定': ['灰階', '色階', '黑白', '彩稿', '彩色', 'CMYK', 'cmyk', '濃度', 'K值', 'k值', '轉灰', '色彩', '漸層', '網點', '深淺', '過渡', '調色', '調濃度'],
  '紙張尺寸': ['尺寸', 'A3', 'a3', 'A4', 'a4', 'A5', 'a5', '大小', '最大', 'B4', 'b4', 'B5', 'b5', 'B6', 'b6', '開本'],
  '印刷範圍': ['滿版', '印刷範圍', '白邊', '邊界', '印到邊', '400', '277'],
  '可指定長寬': ['排版', '長寬', '自訂尺寸', '特殊尺寸', '自己排'],
  '出血設定': ['出血', '裁切線', 'bleed', '3mm', '6mm'],
  '檔案內容': ['一色一版', '一色一檔', '幾個檔', '分版', '圖層', '分開存'],
  '紙材規格': ['紙材', '磅數', '磅', '自帶紙', '帶紙', '寄紙', '的紙', '什麼紙', '選紙', '挑紙', '影印紙', '代印', '自備紙', '牛皮紙', '美術紙'],
  '白墨': ['白墨', '白色', '印白', '留白嗎', '白字'],
  '下單方式': ['下單', '訂購', '怎麼買', '委託', '填單', '訂單', '表單', '購買'],
  '金墨問題': ['金墨', '燙金', '金色', '金箔'],
  '印刷品項': ['貼紙', '紙盒', '盒子', '名片', '明信片', '海報', '品項', '可以印什麼'],
  '起印數量': ['起印', '最少', '幾張起', '最低', '一張可以', '單張'],
  '工作天數': ['工作天', '幾天', '交期', '多久', '天數', '什麼時候好', '來得及', '趕', '急件', '禮拜幾拿', '星期幾拿', '收到', '截稿', '交稿', '拿到', '出貨', '寄達', '回推', '雙色', '三色', '四色', '色數'],
  '協助完稿': ['完稿', '幫我做檔', '不會做檔', '代做', '分色服務', '幫忙調', '協助檢查', '幫看檔'],
  '取件方式': ['取件', '自取', '面交', '超取', '宅配', '寄送', '運費', '到貨', 'lalamove', 'LALAMOVE', 'Lalamove', '黑貓', '7-11', '711', '快遞'],
  '孔版用紙': ['版紙', '製版', '留版', '保留版', '版可以留'],
  '報價參考': ['報價', '價格', '多少錢', '費用', '估價', '試算', '價錢', '收費', '怎麼算'],
  '印製張數': ['耗損', '備量', '損耗', '多印'],
  '工作坊': ['工作坊', '體驗', '課程', '開課', '報名', '上課', '教學'],
  '裝訂': ['裝訂', '線裝', '製本', '騎馬釘', '訂書', '成冊', '小說', '書籍', '漫畫', '同人誌', '本子', '頁'],
  '孔版油墨': ['墨色', '油墨', '顏色', '色號', '幾種顏色', '螢光', '特別色', '螢粉', '螢橘', '什麼顏色'],
};
// 「其他」列依內容給關鍵字
const OTHER_ALIASES = [
  { match: '作品集', aliases: ['作品集', '一本', 'zine', 'ZINE', 'Zine'] },
  { match: '喜帖', aliases: ['喜帖', '結婚', '婚禮', '書約', '囍帖'] },
];

const rows = parseCsv(readFileSync(CSV, 'utf8'));
const entries = [];
for (const r of rows.slice(1)) {
  const topic = (r[1] || '').trim();
  const text = (r[2] || '').trim();
  if (!topic || !text) continue;
  let aliases = ALIASES[topic] || [];
  if (topic === '其他') {
    const hit = OTHER_ALIASES.find((o) => text.includes(o.match));
    if (hit) aliases = hit.aliases;
  }
  entries.push({
    id: `kb-${String(entries.length + 1).padStart(2, '0')}`,
    topic,
    aliases,
    text,
  });
}

// 補充知識源:瑞蘇(Discord bot,價目表等,兩邊改要同步)+ 穆穆口述(報價表格等)
const EXTRA_SOURCES = [
  { file: 'data/source/瑞蘇補充.json', prefix: 'rs' },
  { file: 'data/source/穆穆補充.json', prefix: 'mm' },
  { file: 'data/source/invoice補充.json', prefix: 'zi' }, // Ziner Invoice app=現行權威價格源
];
for (const { file, prefix } of EXTRA_SOURCES) {
  const extra = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  for (const e of extra.entries) {
    entries.push({ id: `${prefix}-${String(entries.length + 1).padStart(2, '0')}`, ...e });
  }
}

writeFileSync(OUT, JSON.stringify({ updated: '2026-07-03', source: '孔版客服QA - 工作表1.csv', entries }, null, 2));
console.log(`寫入 ${OUT}:共 ${entries.length} 條`);
for (const e of entries) console.log(`  ${e.id} ${e.topic} (關鍵字 ${e.aliases.length} 個)`);
