// 真題實測:用真實客問走「檢索 → system prompt → 模型」的完整流水線,
// 直接打模型 API(不經 LINE),看小精靈的實際回答與成本。
// 用法:LLM_API_KEY=sk-xxx node tools/live-eval.mjs [model]
// 注意:會花真錢(每題約 NT$0.01–0.1),調 prompt 或換模型時跑。

import { retrieve } from '../src/kb.js';
import { buildSystemPrompt, ESCALATE_SENTINEL } from '../src/reply.js';

const MODEL = process.argv[2] || 'gpt-5-mini';
const KEY = process.env.LLM_API_KEY;
if (!KEY) { console.error('請帶 LLM_API_KEY 環境變數'); process.exit(1); }

// gpt-5 / o 系列是推理模型:用 max_completion_tokens、reasoning_effort,不吃自訂 temperature
const isReasoning = /^(gpt-5|o\d)/.test(MODEL) && !MODEL.includes('-chat');

const QUESTIONS = [
  { q: '可以用什麼格式', expect: 'jpg / psd / ai' },
  { q: '什麼樣的紙可以印', expect: '60-250g、可代印' },
  { q: '三色單面大概幾個工作天 一張', expect: '一天兩色/越多色越多天,不可自己編天數' },
  { q: '請問可以燙金嗎', expect: '金墨不是燙金' },
  { q: '請問若要白色是留白嗎', expect: '沒有白墨 + riso-ink 連結' },
  { q: '我上週下單的打樣收到了嗎', expect: `訂單個案 → ${ESCALATE_SENTINEL}` },
];

let totalIn = 0, totalOut = 0;
for (const { q, expect } of QUESTIONS) {
  const hits = retrieve(q);
  console.log(`\n━━ 客問:「${q}」`);
  console.log(`   期待:${expect}`);
  console.log(`   檢索:${hits.length ? hits.map((h) => h.topic).join('、') : '(無 → 免AI直接轉人工)'}`);
  if (!hits.length) continue;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(hits) },
      { role: 'user', content: q },
    ],
  };
  if (isReasoning) {
    body.max_completion_tokens = 800;
    body.reasoning_effort = 'minimal';
  } else {
    body.max_tokens = 500;
    body.temperature = 0.3;
  }

  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.log(`   ❌ API ${res.status}:${(await res.text()).slice(0, 300)}`);
    continue;
  }
  const data = await res.json();
  const ans = data.choices?.[0]?.message?.content?.trim() || '(空白)';
  totalIn += data.usage?.prompt_tokens || 0;
  totalOut += data.usage?.completion_tokens || 0;
  console.log(`   ⏱  ${Date.now() - t0}ms|in ${data.usage?.prompt_tokens} / out ${data.usage?.completion_tokens} tokens`);
  console.log(`   🧚 ${ans.replace(/\n/g, '\n      ')}`);
}
console.log(`\n═══ ${MODEL} 總用量:in ${totalIn} / out ${totalOut} tokens`);
