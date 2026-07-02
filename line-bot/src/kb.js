// 知識庫檢索:比對客人訊息與各條目的關鍵字,回傳最相關的幾條。
// 查不到 → 上層直接走「轉人工」,不會呼叫 AI(這就是成本與幻覺的第一道閘門)。

import KB from '../data/kb.json' with { type: 'json' };

const TOPIC_WEIGHT = 3;
const ALIAS_WEIGHT = 2;
const MIN_SCORE = 2; // 至少命中一個關鍵字才算數

export function retrieve(message, { topN = 3 } = {}) {
  const text = String(message || '');
  const scored = [];
  for (const e of KB.entries) {
    let score = 0;
    if (e.topic && text.includes(e.topic)) score += TOPIC_WEIGHT;
    for (const a of e.aliases) {
      if (a && text.includes(a)) score += ALIAS_WEIGHT;
    }
    if (score >= MIN_SCORE) scored.push({ entry: e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((s) => s.entry);
}

export function kbSize() {
  return KB.entries.length;
}
