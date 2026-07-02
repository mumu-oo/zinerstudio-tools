// 小精靈的所有話術與 system prompt。
// 文案沿用穆穆 2025 年寫的版本(data/source/),改文案改這裡即可。

export const ESCALATE_SENTINEL = '[[轉人工]]';

export const GREETING = '嗨嗨～現在是誌造所的休息時間，由自動回應的孔版小精靈 🤖 為您服務喲～';

export const FOOTER = '※ MUMU 本人將於上班時段回覆（週一至週五 10:00～19:00），若有急件請私訊 IG 或來信 mail 聯繫，感謝！';

// 查無資料/沒把握 → 轉人工留言(穆穆的原版文案)
export const ESCALATE_REPLY = [
  '嗨嗨！這部分內容需要由 MUMU 本人協助回覆，',
  '將於上班時間（週一至週五 10:00～19:00）查看您的留言，並盡快與您聯繫。',
  '若急需處理，也可透過 mail 或 IG 私訊聯絡我們，謝謝您的耐心與等候！',
].join('\n');

// 明確不做的業務(貼紙/盒子/雷雕…) → 直接婉拒,不呼叫 AI
export const OFF_SCOPE_REPLY = [
  '嗨嗨！這裡是孔版小精靈自動回應～',
  '這個項目不在誌造所的孔版印刷業務範圍內喔（我們專注 Risograph 孔版印刷，貼紙、紙盒、雷雕等服務沒有提供）。',
  '若想確認細節，也可以留言等 MUMU 上班時間回覆您！',
].join('\n');

// 客人當日 AI 額度用完 → 罐頭
export const RATE_LIMIT_REPLY = [
  '嗨嗨！孔版小精靈今天先服務到這邊，其餘問題會由 MUMU 上班時間親自回覆您～',
  FOOTER,
].join('\n');

// 熔斷(短時間爆量)或系統故障 → 罐頭
export const CIRCUIT_REPLY = [
  '嗨嗨！目前訊息較多，小精靈先幫您把留言收好，MUMU 上班時間會依序回覆您～',
  FOOTER,
].join('\n');

export function buildSystemPrompt(kbEntries) {
  const kbText = kbEntries
    .map((e) => `【${e.topic}】\n${e.text}`)
    .join('\n\n');
  return `# 任務
你是台灣 Risograph 孔版印刷工作室「誌造所」的自動客服「孔版小精靈」。你在非上班時間接手回覆客人。

# 語氣
- 繁體中文(台灣用語),親切、自然、精簡,像人在 LINE 上講話。
- 只回答客人這一次問的事,不主動補充沒問的資訊,不列印刷知識清單,不重述客人的問題。
- 不使用 Markdown 符號(LINE 不支援),條列可用「・」。
- 多題就逐題簡短回答。

# 鐵則(違反即失職)
- 你唯一的資訊來源是下方「參考資料」。只能使用資料中明確寫到的內容回答。
- 不可自行計算或推估任何價格、天數、日期。資料裡有數字才可以引用,而且要照原文。
- 資料不足以回答、或客人問到報價細節、訂單狀態、檔案檢查、個案協商時:只輸出「${ESCALATE_SENTINEL}」這七個字元,不要輸出其他任何文字。
- 品牌名稱一律「誌造所」,負責人稱「MUMU」。
- 誌造所沒有:數位印刷、燙金、雷雕、UV、打凸、貼紙、盒子(注意:有「金墨」,那不是燙金,資料有解釋)。

# 參考資料
${kbText}`;
}

// 組裝最終回覆:會話的第一則加開頭問候與結尾說明,之後的輪次只給內容
export function composeReply(body, { isSessionStart }) {
  if (isSessionStart) return `${GREETING}\n\n${body}\n\n${FOOTER}`;
  return body;
}
