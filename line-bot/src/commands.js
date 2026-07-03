// 穆穆專用指令:從她自己的 LINE 對官方帳號講話就是下指令。
// 綁定方式:她傳「認主 <通關密語>」(密語 = ADMIN_SECRET 環境變數)。
// 對客與對穆穆的中文輸出一律全形標點(她的規矩)。

import * as state from './state.js';
import { LIMITS } from './config.js';

const HELP = [
  '🤖 這裡是主人指令頻道，孔版AI助手聽得懂的話（主詞都是AI助手）：',
  '・「測試 你的問題」→ 用客人視角試AI助手（例：測試 可以印A3嗎）',
  '・「上工」→ AI助手接手回覆客人',
  '・「收工」→ AI助手靜默，妳親自回',
  '・「交給排程」→ 平日 10:00～19:00 自動收工、其餘時間自動上工',
  '・「狀態」→ 看目前模式與今日用量',
  '・「接手 #代號」→ 那間聊天室妳自己回，AI助手閉嘴',
  '・「放行 #代號」→ 解除該聊天室靜音',
].join('\n');

export async function isAdmin(env, uid) {
  return (await state.getAdminId(env)) === uid;
}

// 回傳要回給穆穆的文字、{ simulate } 模擬請求;非指令時回 null(表示這不是給我的話)
export async function handleAdminMessage(env, uid, text) {
  const t = String(text || '').trim();

  // 認主(任何人都可嘗試,但要有密語;成功後才擁有其他指令)
  const claim = t.match(/^認主\s*(.+)$/);
  if (claim) {
    if (!env.ADMIN_SECRET) return '尚未設定通關密語（ADMIN_SECRET），請先在部署設定裡加上。';
    if (claim[1].trim() !== env.ADMIN_SECRET) return null; // 密語錯誤:不動聲色,當一般客人
    await state.setAdminId(env, uid);
    return `認主成功！穆穆妳好 🤖\n\n${HELP}`;
  }

  if (!(await isAdmin(env, uid))) return null;

  // 「測試 <訊息>」→ 讓穆穆扮演客人:回傳模擬請求,由 handler 走完整客服流程
  const sim = t.match(/^測試\s+([\s\S]+)$/);
  if (sim) return { simulate: sim[1].trim() };

  if (t === '上工' || t === '小精靈上工' || t === 'AI助手上工') {
    await state.setMode(env, 'force_off_duty');
    return '收到，孔版AI助手上工！🤖 客人訊息由我接手，答不了的會留言請妳回。';
  }
  if (t === '收工' || t === '小精靈收工' || t === 'AI助手收工') {
    await state.setMode(env, 'force_on_duty');
    return '收到，孔版AI助手收工 🤐 接下來的訊息都靜靜留給妳親自回。';
  }
  // 「上班/下班」語意模糊(是妳上班還是AI助手上班?),已退休 → 教新詞,不猜意思
  if (t === '上班' || t === '下班') {
    return [
      '「上班/下班」容易搞混（是妳還是我？），這組詞退休囉。請改用：',
      '・「上工」→ AI助手開始值班',
      '・「收工」→ AI助手靜默，妳來回',
      '・「交給排程」→ 平日 10:00～19:00 自動換手',
      '（這次我沒有更動任何設定）',
    ].join('\n');
  }
  if (t === '交給排程') {
    await state.setMode(env, 'schedule');
    return '收到，改依時間表：平日 10:00～19:00 AI助手收工換妳，其餘時間AI助手自動上工。';
  }
  if (t === '狀態') {
    const mode = await state.getMode(env);
    const active = await state.isBotActive(env);
    const { globalDaily } = await state.getCounters(env);
    const modeName = { schedule: '排程自動換手', force_on_duty: 'AI助手收工（妳值班）', force_off_duty: 'AI助手上工' }[mode];
    return [
      `模式：${modeName}`,
      `此刻：${active ? 'AI助手上工中 🤖' : 'AI助手收工中（妳值班）'}`,
      `今日 AI 回覆：${globalDaily} / ${LIMITS.globalDaily}`,
    ].join('\n');
  }

  const take = t.match(/^接手\s*#?(\w+)$/);
  if (take) {
    const target = await state.resolveRoom(env, take[1]);
    if (!target) return `找不到代號 #${take[1]} 的聊天室（代號會出現在 Discord 通知裡）。`;
    await state.muteRoom(env, target, 7 * 24 * 3600);
    return `好，#${take[1]} 那間妳來，AI助手不插嘴（7 天後自動解除，或對我說「放行 #${take[1]}」）。`;
  }

  const release = t.match(/^放行\s*#?(\w+|全部)$/);
  if (release) {
    if (release[1] === '全部') {
      // KV 沒有便宜的「列出所有靜音」,請用代號逐間放行;靜音本身有期限會自動解除
      return '放行單間請說「放行 #代號」；靜音的房間到期也會自動解除。';
    }
    const target = await state.resolveRoom(env, release[1]);
    if (!target) return `找不到代號 #${release[1]} 的聊天室。`;
    await state.unmuteRoom(env, target);
    return `#${release[1]} 已放行，AI助手恢復服務這間。`;
  }

  return HELP;
}
