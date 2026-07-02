// 全域設定 — 數字都可以直接改,改完重新部署即可

export const BUSINESS_HOURS = {
  // 穆穆的上班時間(此時段內小精靈靜默):週一~五 10:00–19:00 台北時間
  utcOffset: 8,
  days: [1, 2, 3, 4, 5], // 週一=1 … 週五=5
  startHour: 10,
  endHour: 19, // 不含 19:00 整,19:00 起算下班
};

export const LIMITS = {
  perUserDaily: 10,   // 每位客人每天最多幾次 AI 回覆,超過改罐頭訊息
  globalDaily: 100,   // 全帳號每天 AI 呼叫上限(成本封頂)
  burstPer10Min: 30,  // 10 分鐘內全帳號訊息數超過此值 → 熔斷(只回罐頭)+ Discord 警報
  maxMsgLen: 800,     // 超長訊息不送 AI
  historyTurns: 6,    // 每個聊天室保留幾則上下文
  historyTtlSec: 2 * 60 * 60,  // 對話記憶保留 2 小時(也是「同一次會話」的定義)
  muteTtlSec: 24 * 60 * 60,    // 轉人工後該聊天室靜音 24 小時(或等穆穆「放行」)
  logTtlSec: 14 * 24 * 60 * 60,
};

export const LLM_DEFAULTS = {
  provider: 'openai',        // 'openai'(相容 OpenAI/DeepSeek/…) 或 'anthropic'
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',      // 用 LLM_MODEL 環境變數覆蓋
  maxTokens: 500,
  temperature: 0.3,
};

// 明確不做的業務 → 不呼叫 AI,直接用罐頭婉拒(燙金不在此列:知識庫會解釋金墨)
export const OFF_SCOPE_PATTERNS = ['貼紙', '紙盒', '盒子', '雷雕', 'UV印', 'uv印', '打凸', '打凹', '數位印刷', '雷射印'];
