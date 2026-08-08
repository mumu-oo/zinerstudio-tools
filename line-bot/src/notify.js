// 通知穆穆:Discord webhook(選配)。沒設定 DISCORD_WEBHOOK_URL 就靜靜略過,紀錄仍在 KV。
// 2026-08-09 加 link button:客人事件通知帶「接手 / 放行」兩顆按鈕,
// 穆穆按下去打開簽過名的 worker URL、直接完成動作,不用回 LINE 打指令。

import { signAction } from './hmac.js';

// payload 可以是純字串(舊呼叫者)或 { content, components } 物件(新的按鈕版)
export async function notify(env, payload) {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const body = typeof payload === 'string'
    ? { content: payload.slice(0, 1900) }
    : {
        content: (payload.content ?? '').slice(0, 1900),
        components: payload.components,
      };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // 通知失敗不影響客服主流程
  }
}

// 系統事件通知(模式切換、接手、放行 等 — 跟客人轉人工的 escalationCard 分開)
export function systemNoteCard(title, lines) {
  return [`🔧 **系統|${title}**`, ...lines].join('\n');
}

export function escalationCard({ sid, name, question, kind }) {
  const who = name ? `${name}（#${sid}）` : `#${sid}`;
  const label = {
    no_kb: '查無資料轉人工',
    llm_escalate: 'AI助手沒把握轉人工',
    llm_quote: '📋 七項齊全的估價單（客人已收到暖回覆）',
    llm_error: 'AI 呼叫失敗',
    burst: '⚠️ 熔斷：短時間訊息爆量',
    off_scope: '業務範圍外詢問',
    boopos: '📱 BOO-POS 詢問（已導流 Feedback／信箱）',
  }[kind] || kind;
  return [
    `🤖 **AI助手留言板｜${label}**`,
    `客人：${who}`,
    `訊息：${question}`,
    `（按下方按鈕直接處理；或在 LINE 對助手說「接手 #${sid}」「放行 #${sid}」）`,
  ].join('\n');
}

// Discord link button — 不需要 bot、不需要 Application、不需要 interactions endpoint。
// 按下去只是打開 worker 上的簽名 URL,GET /dc-action 驗簽後執行對應動作。
// 兩顆按鈕都放,不做「已接手才顯示放行」的狀態切換(link button 沒有互動生命週期)。
export async function escalationButtons(env, sid) {
  if (!env.ACTION_SECRET || !env.PUBLIC_BASE_URL) return undefined; // 沒設就自動退回純文字通知
  const [tSig, rSig] = await Promise.all([
    signAction(env.ACTION_SECRET, 't', sid),
    signAction(env.ACTION_SECRET, 'r', sid),
  ]);
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const encSid = encodeURIComponent(sid);
  return [{
    type: 1,
    components: [
      { type: 2, style: 5, label: `✋ 接手 #${sid}`, url: `${base}/dc-action?a=t&s=${encSid}&sig=${tSig}` },
      { type: 2, style: 5, label: `✅ 放行 #${sid}`, url: `${base}/dc-action?a=r&s=${encSid}&sig=${rSig}` },
    ],
  }];
}

// 客人事件通知的一站式:算出按鈕、送出。handler 用這個,不必自己組 components。
export async function notifyEscalation(env, { sid, name, question, kind }) {
  await notify(env, {
    content: escalationCard({ sid, name, question, kind }),
    components: await escalationButtons(env, sid),
  });
}
