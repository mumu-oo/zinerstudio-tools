// 通知穆穆:Discord webhook(選配)。沒設定 DISCORD_WEBHOOK_URL 就靜靜略過,紀錄仍在 KV。

export async function notify(env, text) {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.slice(0, 1900) }),
    });
  } catch {
    // 通知失敗不影響客服主流程
  }
}

export function escalationCard({ sid, name, question, kind }) {
  const who = name ? `${name}(#${sid})` : `#${sid}`;
  const label = {
    no_kb: '查無資料轉人工',
    llm_escalate: '小精靈沒把握轉人工',
    llm_error: 'AI 呼叫失敗',
    burst: '⚠️ 熔斷:短時間訊息爆量',
    off_scope: '業務範圍外詢問',
  }[kind] || kind;
  return [
    `🧚 **小精靈留言板|${label}**`,
    `客人:${who}`,
    `訊息:${question}`,
    `(回覆客人請開 LINE 官方帳號後台;要接手這間請對小精靈說「接手 #${sid}」)`,
  ].join('\n');
}
