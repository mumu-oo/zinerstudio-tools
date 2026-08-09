# 誌造所 LINE 客服 bot 操作手冊

> 這份是給穆穆日常操作用的。技術架構細節在 `README.md`、計價鐵律在 `PRICING_RULES.md`、變更紀錄看 `git log`。

---

## 平常怎麼跟 AI 助手講話（在 LINE 對誌造所官方帳號打字）

| 想做什麼 | 打這句 |
|---|---|
| 讓 AI 上工（幫妳看 LINE） | `上工` |
| 讓 AI 收工（妳自己回） | `收工` |
| 交給時間表（平日 10:00～19:00 妳值班，其餘 AI 值班） | `交給排程` |
| 看目前模式＋今日 AI 用量 | `狀態` |
| 列最近 10 位互動客人 | `查帳`（或 `最近`） |
| 看某位客人最近幾則對話 | `看 #代號`（例：`看 #sb9z`） |
| 妳接手某聊天室（AI 閉嘴 24 小時，或到妳說放行為止） | `接手 #代號` |
| 讓 AI 恢復服務某聊天室 | `放行 #代號` |
| 用客人視角試跑一句（不佔額度） | `測試 <問題>`（例：`測試 A3雙色印50張多少`） |

---

## Discord 通知留言板（快速接手／放行）

**留言板頻道**：Discord `1522284851825213531`（她另建的 webhook 頻道）。

**每次 AI 遇到轉人工、範圍外、BOO-POS 詢問、熔斷等事件**，留言板都會來一則卡片：

```
🤖 AI助手留言板｜📋 七項齊全的估價單（客人已收到暖回覆）
客人：#sb9z
訊息：想估價，B6 雙色 300 張……
（按下方按鈕直接處理；或在 LINE 對助手說「接手 #sb9z」「放行 #sb9z」）

[🍆 接手 #sb9z]  [🤖 放行 #sb9z]
```

**兩顆按鈕的行為**：

- **🍆 接手 #代號** → 該聊天室靜音 24 小時，AI 在那間房完全不出聲；妳直接開 LINE 手動回。24 小時到會自動放行（防妳忘記解除）。
- **🤖 放行 #代號** → 解除該聊天室靜音，AI 恢復服務。

**按下去會發生什麼**：Discord 打開一個小網頁（手機是 in-app browser、桌面是新分頁）「🍆 已接手 #sb9z」／「🤖 已放行 #sb9z」，關掉就好。動作已完成、Discord 也會同時再送一則系統通知確認。

**注意**：Link button 不會變狀態（Discord 這種按鈕的技術限制），所以妳按了接手，那顆按鈕還是長那樣——這是正常的，動作已經生效。

---

## 常見狀況

**Q. 我在留言板按了按鈕，跳一個「找不到房間」怎麼辦？**
A. 該客人的聊天室代號超過 30 天沒動就會過期。這時候該聊天室的 mute 狀態已經自然消失，妳直接開 LINE 回覆就好。

**Q. 「簽章錯誤」？**
A. URL 被改過或按鈕來源不明。留言板裡自動產生的按鈕都不會出這個錯，如果出了就是妳從其他地方複製貼上的連結。

**Q. 我想全部放行怎麼辦？**
A. 目前沒做「全部放行」按鈕。靜音的房間 24 小時後自動解除；如果要提前放行，回 LINE 一個個打「放行 #代號」。

**Q. 按了接手，但客人沒繼續問怎麼辦？**
A. 沒關係，24 小時到會自動解除；期間妳直接開 LINE 手動回覆。

---

## 環境變數（Cloudflare Worker 端）

| 名字 | 存放方式 | 用途 | 出事時怎麼辦 |
|---|---|---|---|
| `LINE_CHANNEL_ID` | wrangler.toml `[vars]` | LINE 官方帳號 Channel ID | 換帳號才改 |
| `LLM_MODEL` | wrangler.toml `[vars]` | 目前 `gpt-5-mini` | 想換模型改這裡 |
| `PUBLIC_BASE_URL` | wrangler.toml `[vars]` | Discord 按鈕的 base URL；`https://zinerstudio-line-bot.zinerstudio.workers.dev` | 換域名／換 worker 名字才改 |
| `LINE_CHANNEL_SECRET` | wrangler secret | LINE webhook 驗簽 | LINE Developers 後台重生後 `npx wrangler secret put LINE_CHANNEL_SECRET` |
| `LLM_API_KEY` | wrangler secret | OpenAI API key | key 輪換後 `npx wrangler secret put LLM_API_KEY` |
| `ADMIN_SECRET` | wrangler secret | 妳「認主」用的通關密語（目前=油墨11色） | 想換 `npx wrangler secret put ADMIN_SECRET` 後在 LINE 重新「認主」 |
| `DISCORD_WEBHOOK_URL` | wrangler secret | 留言板通知（選配，沒設就靜靜略過） | 換頻道 `npx wrangler secret put DISCORD_WEBHOOK_URL` |
| `ACTION_SECRET` | wrangler secret | Discord 按鈕 URL 的 HMAC 簽章金鑰（選配） | 想重生 `openssl rand -base64 48 \| npx wrangler secret put ACTION_SECRET` |

**沒設 `ACTION_SECRET` 或 `PUBLIC_BASE_URL` 會怎樣**：Discord 通知自動退回純文字版（沒按鈕），其他功能不受影響。

---

## 部署 & 檢查

```bash
# 部署最新 code
cd line-bot && npx wrangler deploy

# 看 worker 有沒有活著
curl https://zinerstudio-line-bot.zinerstudio.workers.dev/health

# 診斷雲端「此刻在不在營業時間」（排 schedule bug 用）
curl https://zinerstudio-line-bot.zinerstudio.workers.dev/diag/time

# 看即時 log（客人來訊、AI 回覆、按鈕事件都會印）
npx wrangler tail

# 跑測試
node --test test/*.test.mjs
```

---

## 版本／檔案指南

- `src/index.js` — worker 入口，路由：`/webhook`（LINE）、`/dc-action`（Discord 按鈕）、`/health`、`/diag/time`
- `src/handler.js` — 客人訊息的決策鏈（靜音→BOO-POS→值班→範圍外→額度→檢索→AI→sentinel）
- `src/reply.js` — 所有話術（開頭、結尾、罐頭）＋ system prompt
- `src/commands.js` — 妳的指令（上工／收工／接手／放行／查帳／看）
- `src/notify.js` — Discord 留言板通知（含按鈕產生器）
- `src/hmac.js` — 按鈕 URL 的簽章
- `src/state.js` — 狀態機（KV 讀寫）
- `src/kb.js` — 知識庫檢索
- `src/llm.js` — LLM 呼叫（模型可插拔）
- `src/line.js` — LINE API 簽章驗證與 reply
- `src/config.js` — 設定值（額度、TTL、營業時間、BOO-POS 偵測、範圍外詞）
- `data/source/` — 知識庫原始資料；改完跑 `node tools/convert-kb.mjs`
