// 模型轉接頭:一個介面吃兩種 API 形狀。
//   provider = 'openai'    → OpenAI 相容端點(OpenAI / DeepSeek / Groq / Ollama…都長這樣)
//   provider = 'anthropic' → Claude
// 用環境變數切換:LLM_PROVIDER / LLM_BASE_URL / LLM_MODEL / LLM_API_KEY

import { LLM_DEFAULTS } from './config.js';

function cfg(env) {
  return {
    provider: env.LLM_PROVIDER || LLM_DEFAULTS.provider,
    baseUrl: (env.LLM_BASE_URL || LLM_DEFAULTS.baseUrl).replace(/\/$/, ''),
    model: env.LLM_MODEL || LLM_DEFAULTS.model,
    apiKey: env.LLM_API_KEY,
    maxTokens: LLM_DEFAULTS.maxTokens,
    temperature: LLM_DEFAULTS.temperature,
  };
}

export async function chatComplete(env, { system, messages }) {
  const c = cfg(env);
  if (!c.apiKey) throw new Error('LLM_API_KEY 未設定');
  if (c.provider === 'anthropic') {
    const res = await fetch(`${c.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: c.model,
        max_tokens: c.maxTokens,
        temperature: c.temperature,
        system,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  }
  // OpenAI 相容
  const res = await fetch(`${c.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.apiKey}`,
    },
    body: JSON.stringify({
      model: c.model,
      max_tokens: c.maxTokens,
      temperature: c.temperature,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}
