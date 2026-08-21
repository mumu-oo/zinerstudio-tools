# `zinerstudio_makesomething` 一房一客 整理計畫書（v2 — scope 收縮版）

> 寫給穆穆審閱、不是寫給歐歐執行。
> 看完幫忙拍板幾段拍板問題（最後一段彙整）、我們再開另一個視窗真的動手。

---

## 0. 這份是 v2、跟之前那份不一樣的地方

**之前那份 v1 把 Ziner Invoice 當主角**——4 個房客一次整、最大宗的 mv 都是 Ziner 的檔。

**這份 v2 不動 Ziner Invoice。** 因為現在還有另一條 session 正在跑 Ziner Invoice v1.9（BOO-POS 公版進 letter.html）、會動：

- `main.js` / `preload.js`
- `app/index.html` / `app/letter.html`
- `CHANGELOG.md` / `package.json` / `PROJECT_HANDOFF_CARD.md`
- `backup/`

兩條 session 同時動同一個檔會打架。所以這份 v2 **只整理三個非 Ziner 房客**（工作室帳本 / COIN LEDGER / 報價單網頁版）+ standalone HTML 工具 + 邊角資料夾。**房客 1 Ziner Invoice 留到 Phase 2 處理**（v1.9 收尾後另約時間做、見最後一段）。

---

## ✅ 已敲定的 Phase 1 規格（2026-05-21 穆穆決定）

執行階段照這份直接走、不用再回頭問：

1. **房號命名**：選項 A 英文短 — `studio-ledger/`、`coin-ledger-gb/`、`web-quote/`、`tools/`
2. **不加 `apps/` 前綴**
3. **整理力度**：方案 A 輕度（不開 `ziner-invoice/` 空房、留 Phase 2）
4. **共用 icon `coin-logo-app-80.png`**：方案 i 各複製一份到兩個 ledger 的 `icon/`
5. **兩個 ledger 不合併**（COIN LEDGER 跟工作室帳本保險起見分開、不整併）
6. **網頁版 `index.html`**：先留 `web-quote/` 房、不拉出去獨立 repo（之後想拉再拉、可逆）
7. **`qr-zinerstudio.png` + `zinerstudio_webicon.png`**：兩顆都進 `web-quote/`
   - ⚠️ 這條覆寫了第 3e 表（原本 webicon 進 `tools/`）— 七支 standalone HTML 引用 `zinerstudio_webicon.png` 的相對路徑會跨房、變成 `../web-quote/zinerstudio_webicon.png`、或在 `tools/` 也放一份副本。執行時看哪個簡單就哪個（傾向：tools/ 也放副本、不要跨房 reference）
8. **standalone HTML 七支**：先全部進 `tools/` 一房、不分 `_archive/`（之後想分再分、現在不卡）
9. **`docs/` 八份 BOO-POS 文件**：方案 ii 暫不動（之後 BOO-POS_2026 那邊自己接）
10. **`dist/` 裡的「工作室帳本-1.5.0」舊 dmg**：方案 iii 刪掉
11. **`PROJECT_HANDOFF_CARD.md` 加附錄段給 Codex**：加
12. **中文檔名**：`Riso印刷記帳本.html` 仍改成 `studio-ledger/index.html`（純為命名一致、不是工程考量；中文檔名其實沒事）

剩下的執行細節跟 v1.9 對齊 baseline、執行時跟另一條 session 喬。

---

## 1. 進來看了一圈、現況補充

我先誠實告訴穆穆兩件這次 scope 內會踩到的事：

1. **三桌「非 Ziner」客人從來沒進 git**——目前 `git status` 顯示 untracked：
   - `Riso印刷記帳本.html`（工作室帳本介面）
   - `coin-ledger-*.{js,html}` + `electron-builder-coin-ledger.json`
   - `ledger-*.js` + `electron-builder-ledger.json`
   - `dist-coin-ledger/`（打包輸出）
   - `docs/`（八份 BOO-POS 設計文件、放錯地方）
   - `memopaper/`（這份其實是 Ziner Invoice 用的、見 2g）
   - 七支 standalone HTML 工具

   過去七個月 git 真正在追的、其實**只有「網頁版報價單」**（root `index.html`）跟 `app/index.html`。等於：**這次要搬的東西、幾乎全部都是 git 沒記過的東西**。下面第 6 步會說怎麼補 baseline。

2. **`dist/` 同時住了房客 1 跟房客 2 的 .dmg**——`Ziner Invoice-1.0~1.8.1-arm64.dmg` 跟 `工作室帳本-1.5.0-arm64.dmg` 全擠在同一個 `dist/`。原因是 `electron-builder-ledger.json` 的 `output` 也設成 `"dist"`、跟 Ziner Invoice 的 `package.json` build 設定撞房。整理工作室帳本時要決定那兩顆「工作室帳本」.dmg 怎麼辦（見 6c 風險）。

3. **完全沒有跨 app 的 reference**。我把每個檔都 grep 過、特別確認：
   - 房客 1（main.js / preload.js / app/*.html）**沒有引用任何**我這次要動的檔
   - 我這次要動的檔（ledger / coin / 網頁版 / standalone）**沒有引用任何**房客 1 的檔
   - 兩條 session 不會打架 ✅

   唯一共用的東西：
   - `assets/coin-logo-app-80.png` 兩個 ledger 共用（Ziner 不用）
   - `zinerstudio_webicon.png` 七支 standalone HTML 共用（Ziner / 網頁版不用）
   - `cover-l.png` / `cover-r.png` 拼版類兩支共用（booklet + risograph-tool）

4. **`qr-zinerstudio.png` 是孤兒**——grep 整個 repo（除了這份計畫書本身）找不到任何引用。可能是穆穆手動拿去用的素材。歸屬待穆穆決定。

5. **`BOO-POS_2026/` 是 nested git repo**——它自己有 git、worktree、AGENTS.md，本身已經是一房一客。這次**完全不動它**（連 mv 都不要）。

---

## 2. 房號方案（這段穆穆要拍板）

這份 v2 雖然不搬 Ziner Invoice、但**房號命名要為 Phase 2 鋪路**——意思是這次決定的命名邏輯、之後 Ziner Invoice 進來也要對得起來、不會打架。

### 2a. 命名選項

| 房客 | 選項 A：英文短 | 選項 B：英文描述性 | 選項 C：中文 |
|---|---|---|---|
| 工作室帳本 | `studio-ledger/` | `studio-ledger-app/` | `工作室帳本/` |
| COIN LEDGER GB-style | `coin-ledger-gb/` | `coin-ledger-gb-app/` | `COIN-LEDGER/` |
| 報價單網頁版 | `web-quote/` | `web-quote-embed/` | `網頁版報價單/` |
| Standalone 工具 | `tools/` | `standalone-tools/` | `工具/` |
| （Phase 2：Ziner Invoice） | `ziner-invoice/` | `ziner-invoice-app/` | `誌造所報價單/` |

**我的傾向：選項 A。** 短、純英文、跟 Playground 那邊 `mini o-o` `siko` `lavi` 的命名節奏一致。中文資料夾名漂亮、但 electron-builder + npm 處理中文路徑曾經踩過坑（過去 `Riso印刷記帳本.html` build 沒爆掉是運氣好、現在搬走順手改英文比較安全）。

**第二個要拍板的事**：要不要加 `apps/` 前綴把桌面 app 收一群？

- 不加：`studio-ledger/`、`coin-ledger-gb/`、`web-quote/`、`tools/` 都在 root
- 加：`apps/studio-ledger/`、`apps/coin-ledger-gb/`、`web/web-quote/`、`tools/` 多一層

加 `apps/` 的好處是 root 看起來更乾淨；壞處是路徑深一階、改 `electron-builder.json` 的時候要寫 `apps/studio-ledger/**/*`。**我的傾向：不加**——目前只有兩三個 app、加分層划不來。

### 2b. 整理力度（這段也要拍板）

#### 方案 A 🪴「輕度整理」（推這個）

- 每個 app 的 main / preload / html / electron-builder.json 進自己的房
- `package.json` 留 root（Ziner Invoice 的、不動）
- `assets/` 留 root——但**把屬於 ledger / coin 的素材搬走**、剩下的 Ziner 還在用
- 各 app 的 icon 跟自己的房同層、放 `studio-ledger/icon/` 之類

**改動量**：mv ~15 個檔、改 6 個路徑、不動 Ziner 那邊的任何東西
**好處**：可逆性最高、跟 v1.9 那條 session 零衝突
**壞處**：root 還是會留 `assets/` `package.json` `main.js` 等（因為房客 1 還在）——半成品狀態。完整一房一客要等 Phase 2

#### 方案 B 🌳「中度整理」

- 同 A，外加**為 Phase 2 預留空房**——`mkdir -p ziner-invoice/`（先空著、不搬 Ziner 的檔）
- 之後 v1.9 結束、Phase 2 開工時、Ziner 直接 mv 進這個已開好的房

**好處**：visible 預告「之後 Ziner 也要分」、避免 Codex 看到三個房就以為 Ziner 永遠住 root
**壞處**：空房很怪、像佔位符。Codex 看到空資料夾可能會疑惑

#### 方案 C 🌑「縮到更小」

- 不動 `assets/` 拆分——`assets/` 整包留 root、所有 app 都繼續從 root `assets/` 抓 icon
- 只搬 main / preload / html / electron-builder.json
- 改的路徑更少（不用改 icon path、不用改 builder 的 buildResources）

**好處**：改動最少、第 7 步打包驗證最快過
**壞處**：「一房一客」沒做完——`coin-logo-app-80.png` 還是住 root、新房沒有自己的 icon 子資料夾

**我的傾向：方案 A**。穆穆設計 DC bot 那邊的原則是「一房一客、各帶各的東西」——assets 拆分是這原則的延伸。但**如果穆穆現在不想動太大、選 C 也 OK**、之後再補。

---

## 3. mv 對應表（以方案 A + 選項 A 命名為前提）

### 3a. 工作室帳本 → `studio-ledger/`

| 來源 | 去處 | 備註 |
|---|---|---|
| `ledger-main.js` | `studio-ledger/main.js` | 子資料夾已經區分、`ledger-` 前綴拿掉 |
| `ledger-preload.js` | `studio-ledger/preload.js` | 同上 |
| `Riso印刷記帳本.html` | `studio-ledger/index.html` | 中文檔名改英文較安全 |
| `electron-builder-ledger.json` | `studio-ledger/electron-builder.json` | |
| `assets/ledger-app-icon.png` | `studio-ledger/icon/ledger-app-icon.png` | |
| `assets/coin-logo-app-80.png` | `studio-ledger/icon/coin-logo-app-80.png`（複製） | 共用 icon、見 3c |
| `scripts/make_ledger_icon.swift` | `studio-ledger/scripts/make_ledger_icon.swift` | |

### 3b. COIN LEDGER GB-style → `coin-ledger-gb/`

| 來源 | 去處 | 備註 |
|---|---|---|
| `coin-ledger-main.js` | `coin-ledger-gb/main.js` | |
| `coin-ledger-preload.js` | `coin-ledger-gb/preload.js` | |
| `coin-ledger-gb-style.html` | `coin-ledger-gb/index.html` | |
| `electron-builder-coin-ledger.json` | `coin-ledger-gb/electron-builder.json` | |
| `assets/coin-logo-app-80.png` | `coin-ledger-gb/icon/coin-logo-app-80.png`（複製） | 見 3c |
| `assets/coin-logo-app.png` | `coin-ledger-gb/icon/coin-logo-app.png` | |
| `assets/coin-logo-app.ico` | `coin-ledger-gb/icon/coin-logo-app.ico` | Win 版用 |
| `assets/icon-drafts/` | `coin-ledger-gb/icon/drafts/` | 四份 coin-ledger 草稿 |
| `assets/icon-drafts-v2/` | `coin-ledger-gb/icon/drafts-v2/` | 同上 |
| `assets/icon-drafts-v3/` | `coin-ledger-gb/icon/drafts-v3/` | 同上 |
| `scripts/make_coin_ledger_icon_drafts.swift` | `coin-ledger-gb/scripts/make_coin_ledger_icon_drafts.swift` | |
| `scripts/make_coin_ledger_icon_drafts_v2.swift` | 同上 | |
| `scripts/make_coin_ledger_icon_drafts_v3.swift` | 同上 | |
| `dist-coin-ledger/` 整包 | `coin-ledger-gb/dist/` | 順手改名、由子資料夾區分 |

### 3c. 共用 icon `coin-logo-app-80.png` 怎麼處理（要拍板）

兩個 ledger app 目前**都用 `assets/coin-logo-app-80.png` 當 dock icon**。三種處理：

- **i. 各複製一份**：兩個 app 的 `icon/` 各放一份。**未來想換成各自的圖直接動、零耦合**。代價是檔案重複（一顆 80px 圖、可忽略）。
- **ii. 留共用**：例如保留在 root `assets/coin-logo-app-80.png`、兩個 app 寫 `'..','assets','coin-logo-app-80.png'`。**保留「兩個 ledger 是同源」的事實**、但跨房 reference 會踩 builder `buildResources` 的雷（每個房 builder json 要指向 root）。
- **iii. 確認兩個 ledger 是不是同一條進化線**——如果 COIN LEDGER 是工作室帳本的前身（或反過來）、可以順手整併。但這只有穆穆知道。

**我的傾向：i**。對應穆穆的「一房一客」精神、檔案重複的代價極小。3a / 3b 表都先按 i 寫了。

### 3d. 報價單網頁版 → `web-quote/`（或拉出獨立 repo？見第 4 段）

| 來源 | 去處 | 備註 |
|---|---|---|
| `index.html`（root、158 KB） | `web-quote/index.html` | self-contained、所有圖都 inline base64、零 cross-ref |

**就這一個檔。** 網頁版乾淨到不可思議——所有資產都 inline 在 HTML 裡面（圖片用 `data:image/png;base64` 寫死）。搬出去零負擔。

### 3e. Standalone HTML 工具 → `tools/`（細分方案見第 5 段）

| 來源 | 去處（提案 B、見第 5 段） | 備註 |
|---|---|---|
| `booklet-imposition-calculator.html` | `tools/booklet-imposition-calculator.html` | 用 `zinerstudio_webicon.png` + `cover-l/r.png` |
| `riso-quote.html` | `tools/riso-quote.html` | 現役、用 `zinerstudio_webicon.png` |
| `riso-rookie-village.html` | `tools/riso-rookie-village.html` | 用 `zinerstudio_webicon.png` |
| `risograph-tool.html` | `tools/risograph-tool.html` | 用 `zinerstudio_webicon.png` + `cover-l/r.png` |
| `separation-simulator.html` | `tools/separation-simulator.html` | 用 `zinerstudio_webicon.png` |
| `riso-quote-wireframe.html` | `tools/_archive/riso-quote-wireframe.html` | 過去設計稿、用 `zinerstudio_webicon.png` |
| `riso-quote-wireframe-clean.html` | `tools/_archive/riso-quote-wireframe-clean.html` | 同上 |
| `zinerstudio_webicon.png` | `tools/zinerstudio_webicon.png` | 七支 standalone 全用、跟著進 tools |
| `cover-l.png` | `tools/cover-l.png` | booklet + risograph-tool 用 |
| `cover-r.png` | `tools/cover-r.png` | 同上 |
| `cover-sample.ai` | `tools/cover-sample.ai` | cover-l/r 的 source、跟著一起 |

**搬完之後 root 上孤兒待決**：
- `qr-zinerstudio.png` — grep 整個 repo 沒人引用、見 3f
- `memopaper/` — 是 Ziner Invoice 的、不動、見 3g

### 3f. `qr-zinerstudio.png` 怎麼處理（要拍板）

grep 整個 repo（除了 v1 CLEANUP_PLAN.md 自己提到）**沒有任何 .html / .js / .json / .md 引用這顆 QR**。穆穆比較可能的用法：

- 手動拖到名片 / 海報設計裡（屬於 Ziner Studio 品牌素材）
- 預備之後 `index.html`（網頁版）或 `letter.html` 加進去
- 已經沒在用、忘了刪

提議三選一：
- **i. 留 root** — 當「品牌素材」、跟未來可能要加的 logo 一起住 root
- **ii. 進 `web-quote/`** — 當「網頁版可能會加 QR」的預備
- **iii. 進 Ziner Invoice**（Phase 2）— 當「letter.html 可能會加 QR」的預備

**我的傾向：i**。在不知道穆穆怎麼用它之前、不要替它選邊站。

### 3g. `memopaper/` 跟 cover-*

- `memopaper/_便條加工_誌造所報價單2026.numbers` — 這是穆穆自己設計報價邏輯時的 Numbers 試算、應屬 Ziner Invoice（報價單）。**這次 scope 不動房客 1、所以這個資料夾不動**、留到 Phase 2 跟 Ziner Invoice 一起搬進 `ziner-invoice/reference/`。
- `cover-l.png` / `cover-r.png` / `cover-sample.ai` — 已 grep 確認是 booklet + risograph-tool 用的、跟著 standalone 進 `tools/`（見 3e）。

### 3h. `docs/` 八份 BOO-POS 文件（要拍板）

```
docs/
├── boo-pos-art-asset-checklist-v1.md
├── pos-app-architecture-v1.md
├── pos-data-schema-v1.md
├── pos-event-layout-v1.md
├── pos-mvp-development-v1.md
├── pos-promotion-rules-v1.md
├── pos-session-batch-v1.md
└── pos-technical-direction-v1.md
```

這捆**根本不該在這 repo 裡**——全是 BOO-POS 的設計文件。三種處理：

- **i. mv 到 `BOO-POS_2026/docs/`**（穆穆在 BOO-POS_2026 那邊 commit）— 最對。但 BOO-POS_2026 是 nested git repo、要在那條 repo 自己 commit、不是這條
- **ii. 暫不動、留原地** — 標記「下次清理」、避免跨 repo 動作
- **iii. mv 到 `docs/boo-pos/`、留在這 repo** — 不解決根本問題、只是更不亂

**我的傾向：i**。但要等穆穆同意「現在動 BOO-POS_2026」、不然就 ii。

---

## 4. 要改的路徑清單（採方案 A、共用 icon 各複製一份）

### 4a. `studio-ledger/main.js`（原 `ledger-main.js`）

```diff
   webPreferences: {
-    preload: path.join(__dirname, 'ledger-preload.js'),
+    preload: path.join(__dirname, 'preload.js'),
     ...
   },
-  icon: path.join(__dirname, 'assets', 'coin-logo-app-80.png')
+  icon: path.join(__dirname, 'icon', 'coin-logo-app-80.png')
 });

-win.loadFile(path.join(__dirname, 'Riso印刷記帳本.html'));
+win.loadFile(path.join(__dirname, 'index.html'));
```

行號參考（mv 之前的 `ledger-main.js`）：第 51 行 preload、第 56 行 icon、第 59 行 loadFile。

### 4b. `coin-ledger-gb/main.js`（原 `coin-ledger-main.js`）

```diff
   webPreferences: {
-    preload: path.join(__dirname, 'coin-ledger-preload.js'),
+    preload: path.join(__dirname, 'preload.js'),
     ...
   },
-  icon: path.join(__dirname, 'assets', 'coin-logo-app-80.png')
+  icon: path.join(__dirname, 'icon', 'coin-logo-app-80.png')
 });

-win.loadFile(path.join(__dirname, 'coin-ledger-gb-style.html'));
+win.loadFile(path.join(__dirname, 'index.html'));
```

行號參考（mv 之前的 `coin-ledger-main.js`）：第 51 行 preload、第 56 行 icon、第 59 行 loadFile。

### 4c. `studio-ledger/electron-builder.json`（原 `electron-builder-ledger.json`）

```diff
 {
   "appId": "com.zinerstudio.risoledger",
   "productName": "工作室帳本",
   "files": [
-    "Riso印刷記帳本.html",
-    "assets/**/*",
-    "ledger-main.js",
-    "ledger-preload.js",
+    "studio-ledger/**/*",
     "package.json"
   ],
   "directories": {
-    "output": "dist",
+    "output": "studio-ledger/dist",
-    "buildResources": "assets"
+    "buildResources": "studio-ledger/icon"
   },
   "mac": {
     ...
-    "icon": "assets/coin-logo-app-80.png"
+    "icon": "studio-ledger/icon/coin-logo-app-80.png"
   },
   "extraMetadata": {
     ...
-    "main": "ledger-main.js"
+    "main": "studio-ledger/main.js"
   }
 }
```

**重要**：`files` 路徑是「相對於 root」、不是「相對於 builder json 自己」。所以即使 builder json 搬進 `studio-ledger/`、`files` 仍要寫 `"studio-ledger/**/*"`。後面執行也要從 root 跑：

```bash
npx electron-builder --config studio-ledger/electron-builder.json --mac dmg
```

### 4d. `coin-ledger-gb/electron-builder.json`（原 `electron-builder-coin-ledger.json`）

```diff
 {
   ...
   "files": [
-    "coin-ledger-gb-style.html",
-    "assets/**/*",
-    "coin-ledger-main.js",
-    "coin-ledger-preload.js",
+    "coin-ledger-gb/**/*",
     "package.json"
   ],
   "directories": {
-    "output": "dist-coin-ledger",
+    "output": "coin-ledger-gb/dist",
-    "buildResources": "assets"
+    "buildResources": "coin-ledger-gb/icon"
   },
   "mac": {
     ...
-    "icon": "assets/coin-logo-app-80.png"
+    "icon": "coin-ledger-gb/icon/coin-logo-app-80.png"
   },
   "win": {
     ...
-    "icon": "assets/coin-logo-app.ico"
+    "icon": "coin-ledger-gb/icon/coin-logo-app.ico"
   },
   "extraMetadata": {
     ...
-    "main": "coin-ledger-main.js"
+    "main": "coin-ledger-gb/main.js"
   }
 }
```

### 4e. 跨檔 reference grep 結果（完整、verified）

我把整個 repo 的 `.js` / `.html` / `.json` / `.md`（排除 node_modules / dist / dist-coin-ledger / backup / recovery / BOO-POS_2026 / .claude / worktrees）grep 過。**這次 scope 內、會 reference 到要 mv 檔案的、就以下幾處**：

| 引用方 | 引用什麼 | 在哪改 |
|---|---|---|
| `ledger-main.js` | preload + icon + html | 見 4a |
| `coin-ledger-main.js` | preload + icon + html | 見 4b |
| `electron-builder-ledger.json` | html + assets + main.js + preload + icon | 見 4c |
| `electron-builder-coin-ledger.json` | 同上 + .ico | 見 4d |
| 七支 standalone HTML | `zinerstudio_webicon.png` | 跟著進 `tools/`、相對路徑不變 ✅ |
| `booklet-imposition-calculator.html` | `cover-l.png` / `cover-r.png` | 跟著進 `tools/`、相對路徑不變 ✅ |
| `risograph-tool.html` | `cover-l.png` / `cover-r.png` | 跟著進 `tools/`、相對路徑不變 ✅ |

**完全沒有跨 app reference**——這次要動的東西、跟房客 1（Ziner Invoice）零交集。可以放心。

**也沒有任何 .css / .js 外部檔被 reference**——所有 standalone HTML 都把 CSS 內嵌、JS 用 CDN 或內嵌（例如 `riso-quote.html` 引 `cdnjs.cloudflare.com/.../html2canvas`）。

---

## 5. Standalone HTML 工具的細分提案

七支 .html、再加上它們用的圖（`zinerstudio_webicon.png`、`cover-l/r.png`、`cover-sample.ai`）要怎麼擺：

### 提案 A：通通收成 `tools/` 一房

```
tools/
├── booklet-imposition-calculator.html
├── riso-quote.html
├── riso-quote-wireframe.html
├── riso-quote-wireframe-clean.html
├── riso-rookie-village.html
├── risograph-tool.html
├── separation-simulator.html
├── zinerstudio_webicon.png
├── cover-l.png
├── cover-r.png
└── cover-sample.ai
```

**好處**：root 一秒清爽
**壞處**：「現役工具」跟「過去設計稿」混一起——`riso-quote.html` 是現役（2026-04-08 還在改）、`riso-quote-wireframe*.html` 是過去線框稿

### 提案 B：「現役」跟「設計稿存檔」分兩房（推這個）

```
tools/
├── booklet-imposition-calculator.html
├── riso-quote.html
├── riso-rookie-village.html
├── risograph-tool.html
├── separation-simulator.html
├── zinerstudio_webicon.png
├── cover-l.png
├── cover-r.png
├── cover-sample.ai
└── _archive/
    ├── riso-quote-wireframe.html
    └── riso-quote-wireframe-clean.html
```

**好處**：未來進 `tools/` 找「分色模擬器」不會被線框稿干擾
**壞處**：要穆穆確認哪些是現役、哪些是過去設計稿。提案表的歸類是我猜的——線框稿可能還在用呢

### 提案 C：跟著主題分

```
tools/
├── booklet/
│   └── booklet-imposition-calculator.html
├── riso/
│   ├── riso-quote.html
│   ├── riso-rookie-village.html
│   ├── risograph-tool.html
│   └── separation-simulator.html
├── _archive/
│   ├── riso-quote-wireframe.html
│   └── riso-quote-wireframe-clean.html
└── _shared/
    ├── zinerstudio_webicon.png
    ├── cover-l.png
    └── cover-r.png
```

**好處**：未來新增 RISO 工具有自然的家
**壞處**：相對路徑要改——`tools/riso/riso-quote.html` 引 `../_shared/zinerstudio_webicon.png` 不再是同層

**我的傾向：提案 B**。前提是穆穆能告訴我哪幾支是現役。如果穆穆不確定、就先 A、之後再升 B。

---

## 6. 網頁版（root `index.html`）的提案

### 現況

`index.html`（158 KB）跟 `app/index.html`（162 KB）**檔名相同、內容完全不同**、是兩條獨立的進化線。網頁版是給 Wix iframe 嵌入用的：

- git log 顯示 `Add postMessage height reporting for Wix iframe auto-resize`、`Redesign screenshot: quote card with all conditions, desktop download only` 都是 web 場景
- 最近七個月的 commit **幾乎都是它在動**（這份 repo 的 git 活躍歷史 = 網頁版的歷史）
- **完全 self-contained**：所有圖檔都用 `data:image/png;base64` inline 寫死、不引用任何外部資產

跟桌面 app 之間：
- 零檔案引用關係
- 零共用 build 流程
- 部署方式完全不同（網頁版上 Wix；桌面版 `npm run dist:mac` 打 dmg）

### 提案 1：拉出去自己一個 repo（例如 `ziner-web-quote/`、推這個）

**好處**：
- 版控線路乾淨——這份 repo 唯一在好好用 git 的就是它、搬出去之後 commit 紀錄不用混在桌面 app 裡
- 未來部署網頁有自己的節奏、不用跟桌面 app 的整理 / build 一起拖泥帶水
- Codex 用「土法 backup/ 快照」這套習慣對網頁版會打架（網頁版進得了 git、不需要 backup/）——分開之後兩種 workflow 不再交叉

**壞處**：
- 穆穆要多顧一個 repo（多一個 dir 在 Documents 裡）
- 「報價單」這個概念在兩個 repo 之間其實有共享邏輯（紙材費、加工費）——分開後改一邊不會同步另一邊。但**現在也沒同步**、所以這個壞處其實是現況、不是新增的代價

### 提案 2：留下、收成 `web-quote/` 房

**好處**：簡單、單一 repo
**壞處**：git log 持續混雜——以後看 commit 還是分不出哪個是桌面、哪個是網頁

**我的傾向：提案 1**。原因是：這份 repo 之所以 git 用得不正常、多少是因為它一直被當成「桌面 app 倉庫 + 網頁版 git 倉庫」兩用。拉出去之後，這邊就是純桌面 app 群、可以容忍 Codex 的土法 backup 習慣；網頁版那邊就回到正常 git 流程。

但這個決定**涉及 Codex 的工作習慣**（它要學會「網頁版改在另一個 repo」）、最終穆穆判斷。

---

## 7. 執行順序 checklist

按順序、每步都可以驗。Phase 1（這次）+ Phase 2（v1.9 收尾後）。

### Phase 1（這次的執行範圍、約半天）

#### 第 0 步：安全網（baseline commit）

```bash
cd /Users/mumu/Documents/zinerstudio_makesomething
git add -A
git commit -m "chore: baseline before phase-1 cleanup (non-Ziner tenants)"
```

**這一步要先做、再開始 mv。** 不然 git 沒記過原本長相、之後一旦 mv 起來、就會看成「50 個檔被同時刪了又生出來」、再也找不出哪檔搬到哪。

**驗證**：`git status` 變 clean、`git log -1` 看到 baseline commit。

> ⚠️ 跟 v1.9 那條 session 協調：那條 session 也在動 main.js / preload.js / app/ / package.json / CHANGELOG.md / backup/。**baseline 之前最好先確認 v1.9 已經 commit 過、或我們這條也順手把它的當前 working tree 一起進 baseline**（這樣兩條 session 都從同一個基準點 fork）。

#### 第 1 步：開房

```bash
mkdir -p studio-ledger/icon studio-ledger/scripts
mkdir -p coin-ledger-gb/icon coin-ledger-gb/scripts
mkdir -p web-quote
mkdir -p tools/_archive
```

**驗證**：`ls -d */` 看到新房存在。

#### 第 2 步：搬工作室帳本

1. `git mv` 第 3a 表所有對應（除了 `coin-logo-app-80.png`——這顆要 `cp` 不是 `mv`、因為 COIN 還要）
2. `cp assets/coin-logo-app-80.png studio-ledger/icon/`（共用 icon、複製一份）
3. 改 `studio-ledger/main.js` 三處（見 4a）
4. 改 `studio-ledger/electron-builder.json`（見 4c）

**驗證**：

```bash
npx electron studio-ledger/main.js
```

打開應該看到工作室帳本介面、dock 上 icon 正確、選單能用、能匯出備份。

#### 第 3 步：搬 COIN LEDGER

1. `git mv` 第 3b 表所有對應（`coin-logo-app-80.png` 因為已經在 assets/、要 `cp`）
2. `cp assets/coin-logo-app-80.png coin-ledger-gb/icon/`
3. 改 `coin-ledger-gb/main.js`（見 4b）
4. 改 `coin-ledger-gb/electron-builder.json`（見 4d）

**驗證**：

```bash
npx electron coin-ledger-gb/main.js
```

打開應該看到 COIN LEDGER 介面。

#### 第 4 步：處理 `dist/` 跟 `dist-coin-ledger/`

- `dist-coin-ledger/` 整包 `git mv` 到 `coin-ledger-gb/dist/`（如果有進 git、否則就直接 `mv`）
- `dist/` 裡那兩顆「工作室帳本-1.5.0-arm64.dmg」相關檔——**穆穆要決定**（見 8c 風險）：
  - i. `mv` 到 `studio-ledger/dist/`
  - ii. 留在 `dist/`、跟 Ziner Invoice 的 .dmg 共處
  - iii. 刪掉（v1.5 太舊、之後重 build）

**我的傾向：iii**。穆穆現在已經沒在發那版了、新版打包出來會覆蓋。

#### 第 5 步：搬網頁版

**如果穆穆選提案 2（留 `web-quote/`）**：

```bash
git mv index.html web-quote/index.html
```

**驗證**：用瀏覽器開 `web-quote/index.html` 看畫面是不是好的（self-contained、應該完全沒事）。

**如果穆穆選提案 1（拉出去 `ziner-web-quote/`）**：

```bash
# 在 ~/Documents 開新 repo
cd ~/Documents
git init ziner-web-quote
cp /Users/mumu/Documents/zinerstudio_makesomething/index.html ziner-web-quote/
# 把這份 repo 的 git log 裡只關於 index.html 的歷史撈出來——
# 用 git filter-repo（建議）或 git log --follow 出來的 patch 重 apply
cd /Users/mumu/Documents/zinerstudio_makesomething
git rm index.html
```

> **網頁版的 git 歷史撈出來** 是非平凡操作（建議用 `git filter-repo`、不是 `git mv`）。**這是一個獨立決定、不一定要這次一起做**——可以這次先擱著、等穆穆想清楚再開新 session 處理。

#### 第 6 步：搬 standalone HTML 工具

1. `git mv` 第 3e 表（按穆穆選的提案 A / B / C）
2. 順手把 `cover-l.png` / `cover-r.png` / `cover-sample.ai` / `zinerstudio_webicon.png` 一起進 `tools/`
3. **驗證**：開瀏覽器看 `tools/booklet-imposition-calculator.html` 跟 `tools/risograph-tool.html`——確認 cover-l/r 還能載入

#### 第 7 步：處理邊角資料夾

- `docs/` — 按 3h 穆穆選的方案處理（搬 BOO-POS_2026 / 暫留 / 改名）
- `qr-zinerstudio.png` — 按 3f 處理
- `memopaper/` — **不動**（屬於 Ziner Invoice、Phase 2 再搬）

#### 第 8 步：打包驗證（真正的金標）

```bash
# 工作室帳本
npx electron-builder --config studio-ledger/electron-builder.json --mac dmg
# → 看 studio-ledger/dist/工作室帳本-1.5.0-arm64.dmg 出來、雙擊安裝、能開

# COIN LEDGER
npx electron-builder --config coin-ledger-gb/electron-builder.json --mac dmg
# → 看 coin-ledger-gb/dist/COIN LEDGER GB-style-1.5.0-arm64.dmg
```

> 第 8 步是真的金標——前面 `npx electron foo/main.js` 跑得起來、不代表 builder 包出來的 .dmg 也跑得起來。builder 會根據 `files` 把檔複製進 .app、`files` 路徑沒涵蓋到、就會在這時才浮現。

#### 第 9 步：commit + 順手更新 `.gitignore`

`.gitignore` 現況只有 `node_modules` / `dist` / `build` 三行。整理後新出現的 `studio-ledger/dist/` / `coin-ledger-gb/dist/` 也要 ignore：

```diff
-dist
-build
+**/dist/
+**/build/
 node_modules
```

然後：

```bash
git add -A
git commit -m "refactor: phase-1 cleanup — non-Ziner tenants moved to own rooms"
```

#### 第 10 步：更新 PROJECT_HANDOFF_CARD.md（給 Codex）

⚠️ 這個檔屬於 Ziner Invoice（房客 1）、按 scope 是「不動」。但**整理工作會改變 Codex 接 prompt 時看到的目錄結構**——如果 Codex 下次來看到三個房卻沒有指引、會踩到舊路徑。

折衷：**追加一段「兼容性備註」、不改原內容**。例如新增一段附錄：

```markdown
## 附錄：2026-05 整理後的新位置（其他房客）

- 工作室帳本：`studio-ledger/`（原 root 散檔）
- COIN LEDGER：`coin-ledger-gb/`（原 root 散檔 + `dist-coin-ledger/`）
- 報價單網頁版：`web-quote/index.html`（原 root `index.html`）
- Standalone 工具：`tools/`

Ziner Invoice 本體（你維護的這條）仍在 root，未變動。
```

這段要不要加、加什麼內容、**穆穆拍板**。

### Phase 2（v1.9 收尾後另約、見最後一段）

把房客 1 Ziner Invoice 也分房。Phase 2 的細節在第 9 段、這份計畫書不展開。

---

## 8. 風險清單

### 🚨 重大

- **R1. `electron-builder` 的 `extraMetadata.main` + `files` 路徑**：兩個 ledger 用 `extraMetadata.main` 技巧把 `package.json` 的 `main` 覆寫成自己的 `ledger-main.js` / `coin-ledger-main.js`。搬到子資料夾後 `main` 要寫成 `studio-ledger/main.js` / `coin-ledger-gb/main.js`、**而且 `files` 要實際包含到那個檔**（`"studio-ledger/**/*"` 包得到）。漏掉的話 .app 裡找不到 main、雙擊秒退。第 8 步打包驗證就是抓這個。

- **R2. 中文檔名 + builder**：`Riso印刷記帳本.html` 過去能 build 是運氣好。搬走順手改 `index.html` 比較安全。但**穆穆要保留中文檔名可以**——只是要在第 2 步多測一次。

- **R3. `dist/` 裡的 `工作室帳本-1.5.0-arm64.dmg` 跟 Ziner Invoice 的 .dmg 共處**：見第 4 步、要拍板。
  - 如果 `mv` 走、跨 git tracking 行為要小心（dist/ 在 .gitignore、所以 git 不會記得搬到哪、純檔案搬即可）
  - 如果留著、之後 Ziner Invoice 打 v1.9 時 builder 不會碰它（檔名不同），但會繼續混在那邊

### ⚠️ 中等

- **R4. v1.9 那條 session 跟這條 session 撞 baseline**：第 0 步 baseline commit 之前，v1.9 那邊應該已經 commit 過（從這份 worktree 看到 `cd17ec0 chore: snapshot v1 baseline`）。**但如果 v1.9 還在 working tree 動、我這邊先 git add -A、會把 v1.9 的未 commit 變動也帶進 baseline**。執行整理前要先跟 v1.9 那條對齊：
  - 方案 a：v1.9 先 commit、我這邊再 baseline
  - 方案 b：v1.9 stash、我這邊 baseline、v1.9 unstash 繼續
  - 方案 c：兩條都在不同 worktree、整理直接在 worktree 做完 PR 回 main

- **R5. Codex 過去的「幫我重包 app」習慣會壞**：Codex 可能 hardcode 了 `ledger-main.js` / `coin-ledger-main.js` 名字。整理後第一次跟 Codex 工作前、要先給它新版 `PROJECT_HANDOFF_CARD.md` 附錄（見第 10 步）。

- **R6. `assets/` 半空狀態**：方案 A 之後 `assets/` 只剩 `app-icon-build.png` / `app-icon.png` / `app-icon.source.png`（Ziner 用的）。Phase 2 之後可能就完全空了、可以 rm。不影響功能、只是視覺上奇怪。

- **R7. `dist-coin-ledger/` 改名為 `coin-ledger-gb/dist/`**：穆穆 / Codex 如果有 script / Finder bookmark 指向舊路徑、要更新。

### 💡 小

- **R8. `qr-zinerstudio.png` 是孤兒**：完全沒人引用、整理過程不會踩雷、只是邊角決定（見 3f）。
- **R9. `tools/_archive/` 裡兩支 wireframe**：穆穆說不定還在用、提案 B 把它們關進 archive 之後找不到。第 5 步要再確認一次。
- **R10. `cover-sample.ai` 是 Illustrator 檔、大（544 KB）**：放 `tools/` 是因為 cover-l/r 的 source、但平常用不到。可以順手評估要不要搬出 repo（放 Google Drive、留素材）。

---

## 9. Phase 2 預告（v1.9 結束後再做）

Phase 2 = 把房客 1 Ziner Invoice 也分房。不是這份計畫書的執行範圍、但**這次的房號選擇要為它鋪路**。

Phase 2 的預期動作（**等 v1.9 收尾、另開 session 做**）：

```
ziner-invoice/
├── main.js                  # 原 root main.js
├── preload.js               # 原 root preload.js
├── index.html               # 原 app/index.html（順手拆 app/ 一層）
├── letter.html              # 原 app/letter.html
├── CHANGELOG.md             # 原 root CHANGELOG.md
├── PROJECT_HANDOFF_CARD.md  # 原 root PROJECT_HANDOFF_CARD.md
├── icon/
│   ├── app-icon-build.png   # 原 assets/app-icon-build.png
│   ├── app-icon.png
│   └── app-icon.source.png
├── scripts/
│   └── make_icon.swift      # 原 scripts/make_icon.swift
├── reference/
│   └── _便條加工_誌造所報價單2026.numbers  # 原 memopaper/
├── backup/                  # 原 root backup/
└── recovery/                # 原 root recovery/
```

`package.json` 要動 `main` / `build.files` / `build.mac.icon`。`pad_icon.swift` 因為是 generic 工具、可以留 root 或進 ziner-invoice/scripts/——Phase 2 再決定。

**Phase 2 不要塞進這次** 的原因：
- v1.9 還在動 main.js / app/ / CHANGELOG.md / package.json
- Ziner Invoice 是這個 repo 最複雜的房客、單獨做風險較低
- 這份 Phase 1 完成後、root 已經乾爽很多、Phase 2 的範圍會更聚焦

---

## 10. 拍板結果（2026-05-21 穆穆敲定）

| # | 問題 | 決定 |
|---|---|---|
| 1 | 房號命名 | **A 英文短** |
| 2 | `apps/` 前綴 | **不加** |
| 3 | 整理力度 | **A 輕度** |
| 4 | 共用 icon `coin-logo-app-80.png` | **i 各複製一份** |
| 5 | 網頁版 `index.html` | **留 `web-quote/`**（提案 2、不拉出去） |
| 6 | Standalone HTML 分法 | **A 一房**（先不分 archive） |
| 7 | `docs/` 八份 BOO-POS | **ii 暫不動**（之後 BOO-POS_2026 那邊接） |
| 8 | `dist/` 裡的「工作室帳本-1.5.0」舊 dmg | **iii 刪** |
| 9 | `qr-zinerstudio.png` 歸屬 | **進 `web-quote/`**（同 webicon） |
| 9b | `zinerstudio_webicon.png` 歸屬 | **進 `web-quote/`**（穆穆指定跟 qr 一起） |
| 10 | `PROJECT_HANDOFF_CARD.md` 加附錄給 Codex | **加** |
| 11 | 兩個 ledger 是否同源/整併 | **不合併、分開保險** |
| 12 | 七支 standalone HTML 現役/archive 區分 | **暫不區分、未來再分** |
| 13 | 跟 v1.9 對齊 baseline | **執行時跟另一條 session 喬**（工程細節、不歸穆穆） |

**9 + 9b 的執行注意事項**：七支 standalone HTML 引用 `zinerstudio_webicon.png` 是 root 同層相對路徑。把 webicon 搬到 `web-quote/` 後、`tools/` 那七支要嘛改路徑、要嘛在 `tools/` 也放一份 webicon 副本。執行時用後者比較簡單（複製一份、零路徑修改）。

---

## 11. 給穆穆的人話總結

用人話講一次：

- 妳的 repo 像家——客廳裡同時擺著四桌客人的東西、桌上還散著舊草稿。
- 妳在另一個視窗正在伺候桌子 1（Ziner Invoice、v1.9 改信件）——所以這次我不去動桌子 1、只整理 2、3、4 那三桌、跟旁邊散著的 standalone 小擺設。
- 桌子 1 之後再分房（Phase 2），不是不分、是換時間做。
- 我整理之前確認過一件事：**這三桌跟桌子 1 完全沒在共用碗盤**（grep 過、零 cross-reference）——兩條 session 不會打架。
- `dist/` 那邊有一個歷史包袱：桌子 1 跟桌子 2 的 .dmg 過去被同一個出貨袋裝著——這次整理可以順手分開（或留著、看妳）。
- `docs/` 那捆其實是 BOO-POS 的設計文件、放錯地方了。
- `BOO-POS_2026/` 是它自己的小屋子（自己的 git）、這次別動它。
- `qr-zinerstudio.png` 是孤兒——找不到誰在用——可能是妳手動拖去設計用的。
- 整理力度我建議**輕度**（方案 A）——只搬非 Ziner 房客、Ziner 的東西留 root。改動最小、跟 v1.9 那邊不打架。
- 真正動手是另一個視窗的事——這份計畫書妳審完、回答第 10 段那 13 個拍板問題、我們就可以開新視窗執行。
- 動手的時候我會跟妳一邊做一邊驗——每搬一個 app、跑一次看畫面、再跑一次打包、確認 .dmg 還能開。

整理時間估：半天到一天（Phase 1）。Phase 2 等 v1.9 收尾、另約。

寫完了——慢慢看、有問題隨時戳我。
