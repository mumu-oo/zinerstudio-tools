// 客服主流程:一則客人訊息進來之後的完整決策鏈。
// 原則:每一步都先想「這一步要不要花錢、會不會亂講」,能用規則擋的不進 AI。

import * as state from './state.js';
import * as guard from './guard.js';
import { LIMITS } from './config.js';
import { retrieve } from './kb.js';
import { chatComplete } from './llm.js';
import { reply, showLoading, getDisplayName } from './line.js';
import { notify, escalationCard } from './notify.js';
import { handleAdminMessage } from './commands.js';
import {
  ESCALATE_SENTINEL, ESCALATE_REPLY, OFF_SCOPE_REPLY,
  RATE_LIMIT_REPLY, CIRCUIT_REPLY, buildSystemPrompt, composeReply,
} from './reply.js';

export async function handleEvent(env, event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return; // 貼圖/圖片等 v1 不處理
  if (event.source?.type !== 'user') return; // 群組訊息不介入
  const uid = event.source.userId;
  const text = event.message.text || '';
  const replyToken = event.replyToken;

  // 1) 穆穆的指令通道(認主後,她的訊息永遠不走客服流程)
  const adminReply = await handleAdminMessage(env, uid, text);
  if (adminReply !== null) {
    if (typeof adminReply === 'object' && adminReply.simulate) {
      // 「測試 <訊息>」:用客人視角走完整流程。狀態隔離在 sim: 開頭的假聊天室,
      // 回覆借用這一次的 replyToken(所以答案會出現在穆穆自己的聊天視窗)
      await customerFlow(env, {
        uid: `sim:${uid}`,
        text: adminReply.simulate,
        replyToken,
        simulated: true, // 跳過值班/靜音判斷:永遠展示「小精靈值班時會說什麼」
      });
      return;
    }
    await reply(env, replyToken, adminReply);
    return;
  }

  await customerFlow(env, { uid, text, replyToken });
}

// 客服決策鏈本體(真客人與「測試」模擬共用)
async function customerFlow(env, { uid, text, replyToken, simulated = false }) {
  // 2) 登記聊天室代號(通知穆穆時用)
  const sid = await state.indexRoom(env, uid);

  if (!simulated) {
    // 3) 穆穆值班中 → 小精靈完全靜默,只留紀錄
    if (!(await state.isBotActive(env))) {
      await state.logExchange(env, uid, 'silent_on_duty', text, '');
      return;
    }

    // 4) 這間被接手/已轉人工 → 靜默
    if (await state.isMuted(env, uid)) {
      await state.logExchange(env, uid, 'silent_muted', text, '');
      return;
    }
  }

  const hist = await state.getHistory(env, uid);

  // 5) 明確範圍外的業務 → 罐頭婉拒(免費)
  if (guard.isOffScope(text)) {
    await reply(env, replyToken, OFF_SCOPE_REPLY);
    await state.logExchange(env, uid, 'off_scope', text, OFF_SCOPE_REPLY);
    await notify(env, escalationCard({ sid, name: null, question: text, kind: 'off_scope' }));
    return;
  }

  // 6) 超長訊息 → 直接轉人工(不送 AI)
  if (guard.isTooLong(text)) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'no_kb' });
    return;
  }

  // 7) 額度與熔斷
  const budget = await guard.checkBudget(env, uid);
  if (!budget.ok) {
    const msg = budget.reason === 'user_daily' ? RATE_LIMIT_REPLY : CIRCUIT_REPLY;
    await reply(env, replyToken, msg);
    await state.logExchange(env, uid, `limited_${budget.reason}`, text, '');
    if (budget.reason === 'burst' && budget.burst === LIMITS.burstPer10Min + 1) {
      // 剛跨過門檻的那一則才警報,避免洗版 Discord
      await notify(env, escalationCard({ sid, name: null, question: `10分鐘內第 ${budget.burst} 則訊息,已熔斷`, kind: 'burst' }));
    }
    return;
  }

  // 8) 檢索知識庫:查無資料 → 轉人工,AI 一毛不花
  const kbHits = retrieve(text);
  if (kbHits.length === 0) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'no_kb' });
    return;
  }

  // 9) 呼叫 AI(只能引用檢索到的條目)
  await showLoading(env, uid);
  let answer;
  try {
    answer = await chatComplete(env, {
      system: buildSystemPrompt(kbHits),
      messages: [...hist, { role: 'user', content: text }],
    });
  } catch (err) {
    console.error('LLM error:', err.message);
    await escalate(env, { uid, sid, replyToken, text, kind: 'llm_error' });
    return;
  }

  // 10) 小精靈自己說沒把握 → 轉人工
  if (!answer || answer.includes(ESCALATE_SENTINEL)) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'llm_escalate' });
    return;
  }

  // 11) 先記錄、後投遞(就算 LINE 回覆失敗,紀錄也不會丟)
  await state.logExchange(env, uid, 'answered', text, answer);
  await reply(env, replyToken, composeReply(answer));
  await state.pushHistory(env, uid, 'user', text);
  await state.pushHistory(env, uid, 'assistant', answer);
}

// 轉人工:靜音、記錄、通知穆穆都先做,最後才回罐頭留言
// (順序保證:就算 LINE 回覆失敗,穆穆也一定會知道有客人在等)
async function escalate(env, { uid, sid, replyToken, text, kind }) {
  await state.muteRoom(env, uid);
  await state.logExchange(env, uid, `escalated_${kind}`, text, ESCALATE_REPLY);
  const name = await getDisplayName(env, uid);
  await notify(env, escalationCard({ sid, name, question: text, kind }));
  await reply(env, replyToken, ESCALATE_REPLY);
}
