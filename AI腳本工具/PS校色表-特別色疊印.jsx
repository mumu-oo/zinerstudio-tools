// ============================================================
//  PS 校色表 — 特別色疊印  for Adobe Photoshop
//  自動開新檔、把誌造所整套墨色建成「特別色色版」、
//  兩兩疊印畫成一張矩陣表（外框＝橫列色、內塊＝直欄色、內塊區＝兩色疊印）
//
//  用途：給歐歐校分色模擬器的混色（2026-08-20、穆穆說模擬器的紫跟 PS 有落差）
//  用法：
//   1. Photoshop → 檔案 → 指令碼 → 瀏覽…（Browse）→ 選這個檔
//   2. 跑完會出現一張矩陣圖（特別色色版疊印預覽）
//   3. 檢視 100%、整張截圖傳給歐歐即可，不用存檔
//   * 特別色 Solidity 用 PS 預設 0%（透明油墨疊印預覽）
//   * 最上面一排＝各色單獨 100%（當對照）
// ============================================================

#target photoshop

(function () {

  var INKS = [
    { name: 'SKY 天空',     r: 0x62, g: 0xA8, b: 0xE5 },
    { name: 'BLUE 青藍',    r: 0x00, g: 0x78, b: 0xBF },
    { name: 'GREEN 綠',     r: 0x00, g: 0xA9, b: 0x5C },
    { name: 'YELLOW 黃',    r: 0xFF, g: 0xE8, b: 0x00 },
    { name: 'RED 赤紅',     r: 0xE8, g: 0x20, b: 0x20 },
    { name: 'VIOLET 紫堇',  r: 0x9D, g: 0x7A, b: 0xD2 },
    { name: 'MINT 薄荷',    r: 0x82, g: 0xD8, b: 0xD5 },
    { name: 'PINK 螢粉',    r: 0xFF, g: 0x48, b: 0xB0 },
    { name: 'ORANGE 螢橘',  r: 0xFF, g: 0x5F, b: 0x00 },
    { name: 'GOLD 金',      r: 0xAC, g: 0x93, b: 0x6E },
    { name: 'BLACK 黑',     r: 0x00, g: 0x00, b: 0x00 }
  ];

  var CELL = 110;   // 一格的邊長 px
  var GAP  = 14;    // 格距
  var PAD  = 40;    // 邊界
  var n = INKS.length;
  // 版面：第 0 列＝單色對照列；下面 n 列 × n 欄的上三角（含對角線不畫）
  var W = PAD * 2 + (n * (CELL + GAP)) - GAP;
  var H = PAD * 2 + ((n + 1) * (CELL + GAP)) - GAP;

  var oldUnits = app.preferences.rulerUnits;
  app.preferences.rulerUnits = Units.PIXELS;

  var doc = app.documents.add(W, H, 72, '誌造所特別色疊印校色表',
    NewDocumentMode.RGB, DocumentFill.WHITE);

  var black = new SolidColor();
  black.rgb.red = 0; black.rgb.green = 0; black.rgb.blue = 0;

  // 建 11 個特別色色版（Solidity 0 = PS 預設、透明油墨）
  var chans = [];
  for (var i = 0; i < n; i++) {
    var ch = doc.channels.add();
    ch.kind = ChannelType.SPOTCOLOR;
    ch.name = INKS[i].name;
    var c = new SolidColor();
    c.rgb.red = INKS[i].r; c.rgb.green = INKS[i].g; c.rgb.blue = INKS[i].b;
    ch.color = c;
    ch.opacity = 0;   // Solidity 0%
    chans.push(ch);
  }

  function fillRect(chIndex, x1, y1, x2, y2) {
    doc.selection.select([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
    doc.activeChannels = [chans[chIndex]];
    doc.selection.fill(black);      // 特別色色版裡黑＝該油墨 100%
    doc.selection.deselect();
  }

  function cellX(col) { return PAD + col * (CELL + GAP); }
  function cellY(rowIncHeader) { return PAD + rowIncHeader * (CELL + GAP); }

  // 第 0 列：各色單獨 100%（直欄順序）
  for (var col = 0; col < n; col++) {
    var x = cellX(col);
    fillRect(col, x, cellY(0), x + CELL, cellY(0) + CELL);
  }

  // 矩陣（上三角、row < col 才畫）：外框整格＝row 色、內縮 24px 的內塊再疊 col 色
  for (var row = 0; row < n; row++) {
    for (var col2 = row + 1; col2 < n; col2++) {
      var cx = cellX(col2);
      var cy = cellY(row + 1);
      fillRect(row,  cx, cy, cx + CELL, cy + CELL);                    // 外框：橫列色 100%
      fillRect(col2, cx + 24, cy + 24, cx + CELL - 24, cy + CELL - 24); // 內塊：直欄色 100%（此區＝疊印）
    }
  }

  // 回到 RGB 複合檢視
  doc.activeChannels = doc.componentChannels;
  app.preferences.rulerUnits = oldUnits;
  app.runMenuItem(charIDToTypeID('FtOn'));  // 縮放至符合視窗

  alert('校色表完成！\n\n上排＝各色單獨 100%。\n矩陣格：外框＝橫列的顏色、內塊＝再疊上直欄的顏色（內塊區就是兩色疊印）。\n\n檢視設 100% 後整張截圖傳給歐歐就可以了，不用存檔。');

})();
