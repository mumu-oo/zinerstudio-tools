// 客服主流程:一則客人訊息進來之後的完整決策鏈。
// 原則:每一步都先想「這一步要不要花錢、會不會亂講」,能用規則擋的不進 AI。

import * as state from './state.js';
import * as guard from './guard.js';
import { LIMITS } from './config.js';
import { retrieve, allEntries } from './kb.js';
import { looksLikeQuoteForm, parseQuoteForm, calcQuote, quoteReplyBody, quoteDetailForMumu } from './quote.js';
import { chatComplete } from './llm.js';
import { reply, showLoading, getDisplayName } from './line.js';
import { notify, notifyEscalation, systemNoteCard } from './notify.js';
import { handleAdminMessage } from './commands.js';
import {
  ESCALATE_SENTINEL, ESCALATE_QUOTE_SENTINEL, ESCALATE_BODY, ESCALATE_QUOTE_BODY,
  OFF_SCOPE_BODY, RATE_LIMIT_BODY, CIRCUIT_BODY, BOOPOS_BODY, buildSystemPrompt, composeReply,
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
    // 3) 這間被穆穆接手 → 全面靜默(人在跟客人說話,連導流罐頭也不插嘴)
    if (await state.isMuted(env, uid)) {
      await state.logExchange(env, uid, 'silent_muted', text, '');
      return;
    }
  }

  // 3.5) 客人主動呼叫老闆 → 一律轉人工、繞開 AI 判斷(2026-08-09 穆穆令:
  //      「有需要可向助手呼叫老闆來」是給客人的真出口,不能指望 gpt-5-mini
  //      每次都選對 sentinel;程式硬擋保證 Discord 一定響。)
  if (/(找|叫|呼叫)[^\n。！？，、]{0,10}(老闆|MUMU|真人)|(老闆|MUMU|真人)[^\n。！？，、]{0,5}(在嗎|在不在|在\?|在？|有空|請出來|上線了嗎)|要跟[^\n。！？，、]{0,3}(真人|人|MUMU|老闆)/i.test(text)) {
    const hist0 = await state.getHistory(env, uid);
    await escalate(env, { uid, sid, replyToken, text, kind: 'call_owner', sessionStart: hist0.length === 0 });
    return;
  }

  // 4) BOO-POS APP 的詢問 → 不分上下班直接導流(2026-08-09 穆穆裁定:
  //    唯一突破「值班靜默」的罐頭;單獨投遞、不掛問候結尾,不談 MUMU 在不在位子)
  if (guard.isBooPos(text)) {
    await state.logExchange(env, uid, 'boopos_redirect', text, BOOPOS_BODY);
    await notifyEscalation(env, { sid, name: null, question: text, kind: 'boopos' });
    await reply(env, replyToken, BOOPOS_BODY);
    await state.pushHistory(env, uid, 'user', text);
    await state.pushHistory(env, uid, 'assistant', BOOPOS_BODY);
    return;
  }

  if (!simulated) {
    // 5) 穆穆值班中 → 小精靈完全靜默,只留紀錄
    if (!(await state.isBotActive(env))) {
      await state.logExchange(env, uid, 'silent_on_duty', text, '');
      return;
    }
  }

  const hist = await state.getHistory(env, uid);
  // 開場判斷:這間房 2 小時內沒有對話記憶=新會話,問候語只在開場那一則出現
  const sessionStart = hist.length === 0;

  // 6) 明確範圍外的業務 → 罐頭婉拒(免費)
  if (guard.isOffScope(text)) {
    const msg = composeReply(OFF_SCOPE_BODY, { sessionStart });
    await reply(env, replyToken, msg);
    await state.logExchange(env, uid, 'off_scope', text, msg);
    await notifyEscalation(env, { sid, name: null, question: text, kind: 'off_scope' });
    return;
  }

  // 7) 超長訊息 → 直接轉人工(不送 AI)
  if (guard.isTooLong(text)) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'no_kb', sessionStart });
    return;
  }

  // 7.5) 客人貼回填好的 ►報價表格 → 計價引擎直接算,AI 全程不碰數字
  //      (2026-08-09 穆穆抓包:七項填齊 AI 還轉人工投降。錢的事交程式,不再指望 LLM 選對暗號)
  if (looksLikeQuoteForm(text)) {
    const { fields, missing } = parseQuoteForm(text);
    if (missing.length === 0) {
      const result = calcQuote(fields);
      if (result.ok) {
        const body = quoteReplyBody(fields, result);
        await state.logExchange(env, uid, 'quoted_engine', text, body);
        await notify(env, systemNoteCard(`💰 引擎試算已回覆（#${sid}）`, [quoteDetailForMumu(fields, result)]));
        await reply(env, replyToken, composeReply(body, { sessionStart }));
        await state.pushHistory(env, uid, 'user', text);
        await state.pushHistory(env, uid, 'assistant', body);
        return;
      }
      // 算不出來(尺寸超範圍等)→ 走人工,原因附進通知
      await escalate(env, { uid, sid, replyToken, text: `${text}\n(引擎:${result.reason})`, kind: 'llm_quote', sessionStart });
      return;
    }
    // 表格有缺 → 交給 AI 追問缺項(它看得到表格內容與缺什麼)
  }

  // 8) 額度與熔斷(「測試」模擬不佔額度——老闆娘測試不該被自家保險絲電到)
  if (!simulated) {
    const budget = await guard.checkBudget(env, uid);
    if (!budget.ok) {
      const msg = composeReply(budget.reason === 'user_daily' ? RATE_LIMIT_BODY : CIRCUIT_BODY, { sessionStart });
      await reply(env, replyToken, msg);
      await state.logExchange(env, uid, `limited_${budget.reason}`, text, '');
      if (budget.reason === 'burst' && budget.burst === LIMITS.burstPer10Min + 1) {
        // 剛跨過門檻的那一則才警報,避免洗版 Discord
        await notifyEscalation(env, { sid, name: null, question: `10 分鐘內第 ${budget.burst} 則訊息，已熔斷`, kind: 'burst' });
      }
      return;
    }
  }

  // 9) 檢索知識庫:
  //    命中 → 只餵命中的條目(精準、省 token);
  //    完全沒命中 → 把全表交給 AI 判斷「這題我們有沒有答案」,
  //    有 → 依資料答,沒有 → 由 AI 吐 sentinel 讓程式轉人工。
  //    有對話脈絡時把近幾輪一起餵給檢索器,接住「那要幾天?」這類追問。
  let kbHits = retrieve(text);
  if (kbHits.length === 0 && hist.length > 0) {
    kbHits = retrieve([...hist.slice(-4).map((h) => h.content), text].join('\n'), { topN: 4 });
  }
  if (kbHits.length === 0) {
    // 降級成全表判斷,不再直接罐頭。GPT-5-mini 全表判斷成本約每次台幣 0.02
    kbHits = allEntries();
  }

  // 10) 呼叫 AI(只能引用檢索到的條目;附今天日期供交期推算)
  await showLoading(env, uid);
  let answer;
  try {
    answer = await chatComplete(env, {
      system: buildSystemPrompt(kbHits, { today: state.taipeiDateLabel() }),
      messages: [...hist, { role: 'user', content: text }],
    });
  } catch (err) {
    console.error('LLM error:', err.message);
    await escalate(env, { uid, sid, replyToken, text, kind: 'llm_error', sessionStart });
    return;
  }

  // 11) 小精靈自己說沒把握 → 轉人工(估價暗號優先判,兩個都用 includes 而不是相等)
  if (!answer || answer.includes(ESCALATE_QUOTE_SENTINEL)) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'llm_quote', sessionStart });
    return;
  }
  if (answer.includes(ESCALATE_SENTINEL)) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'llm_escalate', sessionStart });
    return;
  }

  // 10.5) 保險網:AI 沒吐暗號、卻對客人說「無法回答」這族句子 → 程式攔下改走轉人工。
  //       實錄 2026-08-09 09:48:「A4 最大印刷範圍資料沒寫,無法回答」——客人吃閉門羹、
  //       Discord 零通知、題目蒸發。prompt 已勸,這裡是勸不聽時的硬擋。
  if (/無法回答|沒辦法回答|資料沒|資料未|資料裡沒|資料中沒|沒有相關資料/.test(answer)) {
    await escalate(env, { uid, sid, replyToken, text, kind: 'llm_escalate', sessionStart });
    return;
  }

  // 12) 先記錄、後投遞(就算 LINE 回覆失敗,紀錄也不會丟)
  await state.logExchange(env, uid, 'answered', text, answer);
  await reply(env, replyToken, composeReply(answer, { sessionStart }));
  await state.pushHistory(env, uid, 'user', text);
  await state.pushHistory(env, uid, 'assistant', answer);
}

// 轉人工:記錄、通知穆穆先做,最後才回罐頭留言
// (順序保證:就算 LINE 回覆失敗,穆穆也一定會知道有客人在等)
// 2026-07-11 拆掉「轉人工=自動靜音」:一題答不了不再封整間房 24 小時
// (實錄:客人連問七題都答得好,第八題轉人工後,連「工作坊資訊」這種
//  資料庫有的題都被無視——客人體感是 bot 消失)。要 AI 閉嘴的房間,
// 穆穆用「接手 #代號」手動靜音。
async function escalate(env, { uid, sid, replyToken, text, kind, sessionStart = false }) {
  const isQuote = kind === 'llm_quote';
  const body = isQuote ? ESCALATE_QUOTE_BODY : ESCALATE_BODY;
  const msg = composeReply(body, { sessionStart });
  await state.logExchange(env, uid, `escalated_${kind}`, text, msg);
  const name = await getDisplayName(env, uid);
  await notifyEscalation(env, { sid, name, question: text, kind });
  await reply(env, replyToken, msg);
  // 轉人工的那一題也記入對話脈絡,讓 AI 記得「這題我說過要等 MUMU」
  await state.pushHistory(env, uid, 'user', text);
  await state.pushHistory(env, uid, 'assistant', body);
}
