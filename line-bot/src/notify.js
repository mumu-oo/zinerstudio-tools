// 通知穆穆:Discord webhook(選配)。沒設定 DISCORD_WEBHOOK_URL 就靜靜略過,紀錄仍在 KV。
// 2026-08-09 加接手/放行 markdown 連結:客人事件通知內含兩個可點的簽名 URL,
// 穆穆按下去在瀏覽器完成動作、不用回 LINE 打指令。
// (原本想用 Discord button component,但頻道自建的 webhook 不接 components——
//  只有 bot 建的 application-owned webhook 才行,所以改走 embed 內嵌 markdown 連結。)

import { signAction } from './hmac.js';

// payload 可以是純字串(舊呼叫者)或 { content, embeds, components } 物件
export async function notify(env, payload) {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const body = typeof payload === 'string'
    ? { content: payload.slice(0, 1900) }
    : {
        content: (payload.content ?? '').slice(0, 1900),
        embeds: payload.embeds,
        components: payload.components,
      };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.log(`discord notify ${res.status}: ${txt.slice(0, 300)}`);
    }
  } catch (err) {
    console.log('discord notify throw:', err.message);
    // 通知失敗不影響客服主流程
  }
}

// 系統事件通知(模式切換、接手、放行 等 — 跟客人轉人工的 escalationCard 分開)
export function systemNoteCard(title, lines) {
  return [`🔧 **系統｜${title}**`, ...lines].join('\n');
}

// 產出接手/放行的 markdown 連結。沒設 ACTION_SECRET/PUBLIC_BASE_URL → 回 null,
// 通知會退回「請在 LINE 打接手 #xxx」的舊指引。
export async function actionLinks(env, sid) {
  if (!env.ACTION_SECRET || !env.PUBLIC_BASE_URL) return null;
  const [tSig, rSig] = await Promise.all([
    signAction(env.ACTION_SECRET, 't', sid),
    signAction(env.ACTION_SECRET, 'r', sid),
  ]);
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const encSid = encodeURIComponent(sid);
  return {
    takeover: `[🍆 接手 #${sid}](${base}/dc-action?a=t&s=${encSid}&sig=${tSig})`,
    release: `[🤖 放行 #${sid}](${base}/dc-action?a=r&s=${encSid}&sig=${rSig})`,
  };
}

const KIND_LABEL = {
  no_kb: '查無資料轉人工',
  llm_escalate: 'AI助手沒把握轉人工',
  llm_quote: '📋 七項齊全的估價單（客人已收到暖回覆）',
  llm_error: 'AI 呼叫失敗',
  burst: '⚠️ 熔斷：短時間訊息爆量',
  off_scope: '業務範圍外詢問',
  boopos: '📱 BOO-POS 詢問（已導流 Feedback／信箱）',
  call_owner: '🔔 客人呼叫老闆',
};

// 客人事件通知的完整卡片(embed:訊息用 code block 隔離 markdown、操作放獨立 field)
// 2026-08-09 修:客人訊息裡的 * 字元(如「100*148」)會觸發 Discord embed 斜體、
// 把後續 markdown 連結解析壞掉;code block 內字元一律不 render markdown。
// 三反引號要用替換法防客人自己貼 ``` 破環包裝(把客人的 ``` 換掉)。
export async function escalationCard(env, { sid, name, question, kind }) {
  const who = name ? `${name}（#${sid}）` : `#${sid}`;
  const label = KIND_LABEL[kind] || kind;
  const links = await actionLinks(env, sid);
  const q = String(question).slice(0, 500).replace(/```/g, '\'\'\'');
  const description = [
    `**🤖 AI助手留言板｜${label}**`,
    `客人：${who}`,
    '訊息：',
    '```',
    q,
    '```',
  ].join('\n');
  const embed = { description, color: 0xd4a373 };
  if (links) {
    embed.fields = [{
      name: '⚡ 操作',
      value: `${links.takeover}　｜　${links.release}`,
    }];
  } else {
    embed.footer = { text: `在 LINE 對助手說「接手 #${sid}」「放行 #${sid}」` };
  }
  return { content: '', embeds: [embed] };
}

// 客人事件通知的一站式:算好內容、送出。handler 用這個。
export async function notifyEscalation(env, args) {
  await notify(env, await escalationCard(env, args));
}
