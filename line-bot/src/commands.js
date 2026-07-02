// 穆穆專用指令:從她自己的 LINE 對官方帳號講話就是下指令。
// 綁定方式:她傳「認主 <通關密語>」(密語 = ADMIN_SECRET 環境變數)。

import * as state from './state.js';
import { LIMITS } from './config.js';

const HELP = [
  '🧚 小精靈聽得懂的話:',
  '・「下班」→ 小精靈接手回覆',
  '・「上班」→ 小精靈完全靜默',
  '・「交給排程」→ 依時間表自動切(週一~五 10:00-19:00 你值班)',
  '・「狀態」→ 看目前模式與今日用量',
  '・「接手 #代號」→ 那間聊天室你自己回,小精靈閉嘴',
  '・「放行 #代號」/「放行 全部」→ 解除靜音',
].join('\n');

export async function isAdmin(env, uid) {
  return (await state.getAdminId(env)) === uid;
}

// 回傳要回給穆穆的文字;非指令時回 null(表示這不是給我的話)
export async function handleAdminMessage(env, uid, text) {
  const t = String(text || '').trim();

  // 認主(任何人都可嘗試,但要有密語;成功後才擁有其他指令)
  const claim = t.match(/^認主\s*(.+)$/);
  if (claim) {
    if (!env.ADMIN_SECRET) return '尚未設定通關密語(ADMIN_SECRET),請先在部署設定裡加上。';
    if (claim[1].trim() !== env.ADMIN_SECRET) return null; // 密語錯誤:不動聲色,當一般客人
    await state.setAdminId(env, uid);
    return `認主成功!穆穆你好 🧚\n\n${HELP}`;
  }

  if (!(await isAdmin(env, uid))) return null;

  if (t === '下班') {
    await state.setMode(env, 'force_off_duty');
    return '收到,小精靈值班中 🧚 客人訊息由我接手,答不了的會留言給你。';
  }
  if (t === '上班') {
    await state.setMode(env, 'force_on_duty');
    return '收到,小精靈靜默 🤐 所有訊息都留給你親自回。';
  }
  if (t === '交給排程') {
    await state.setMode(env, 'schedule');
    return '收到,改依時間表:週一~五 10:00-19:00 你值班,其餘時間我值班。';
  }
  if (t === '狀態') {
    const mode = await state.getMode(env);
    const active = await state.isBotActive(env);
    const { globalDaily } = await state.getCounters(env);
    const modeName = { schedule: '排程自動切', force_on_duty: '強制你值班', force_off_duty: '強制小精靈值班' }[mode];
    return [
      `模式:${modeName}`,
      `此刻:${active ? '小精靈值班中 🧚' : '你值班中(小精靈靜默)'}`,
      `今日 AI 回覆:${globalDaily} / ${LIMITS.globalDaily}`,
    ].join('\n');
  }

  const take = t.match(/^接手\s*#?(\w+)$/);
  if (take) {
    const target = await state.resolveRoom(env, take[1]);
    if (!target) return `找不到代號 #${take[1]} 的聊天室(代號會出現在 Discord 通知裡)。`;
    await state.muteRoom(env, target, 7 * 24 * 3600);
    return `好,#${take[1]} 那間你來,小精靈不插嘴(7 天後自動解除,或對我說「放行 #${take[1]}」)。`;
  }

  const release = t.match(/^放行\s*#?(\w+|全部)$/);
  if (release) {
    if (release[1] === '全部') {
      // KV 沒有便宜的「列出所有 mute」,逐間放行請用代號;「全部」放行改用模式切換語意
      return '放行單間請說「放行 #代號」;若要小精靈全面接手,說「下班」即可(靜音的房間也會在期限後自動解除)。';
    }
    const target = await state.resolveRoom(env, release[1]);
    if (!target) return `找不到代號 #${release[1]} 的聊天室。`;
    await state.unmuteRoom(env, target);
    return `#${release[1]} 已放行,小精靈恢復服務這間。`;
  }

  return HELP;
}
