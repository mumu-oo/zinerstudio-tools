// ============================================================
//  數字月曆產生器  for Adobe Illustrator
//  跑法：檔案 → 指令碼 → 其他指令碼… → 選這個檔
//  彈窗：年份 / 週起始 / 語言 / 字體 → 產生（整年一張 3×4）
//  年份隨便打哪年都行，會自動重算
// ============================================================

#target illustrator

(function () {

  // ---------- 先抓電腦裡的字體清單 ----------
  var fontNames = [];
  for (var f = 0; f < app.textFonts.length; f++) {
    fontNames.push(app.textFonts[f].name);
  }
  fontNames.sort();
  // 找個順眼的預設
  var defIdx = 0;
  var prefer = ['PingFang', 'Heiti', 'Helvetica', 'Arial', 'Noto'];
  for (var pi = 0; pi < prefer.length && defIdx === 0; pi++) {
    for (var fi = 0; fi < fontNames.length; fi++) {
      if (fontNames[fi].indexOf(prefer[pi]) === 0) { defIdx = fi; break; }
    }
  }

  // ---------- 彈窗 ----------
  var dlg = new Window('dialog', '數字月曆產生器');
  dlg.orientation = 'column';
  dlg.alignChildren = 'fill';
  dlg.margins = 16;

  var gYear = dlg.add('group');
  gYear.add('statictext', undefined, '年份：');
  var yearInput = gYear.add('edittext', undefined, '2026');
  yearInput.characters = 6;

  var pWeek = dlg.add('panel', undefined, '每週起始');
  pWeek.orientation = 'row';
  pWeek.alignChildren = 'left';
  var rSun = pWeek.add('radiobutton', undefined, '星期日 開頭');
  var rMon = pWeek.add('radiobutton', undefined, '星期一 開頭');
  rSun.value = true;

  var pLang = dlg.add('panel', undefined, '語言');
  pLang.orientation = 'column';
  pLang.alignChildren = 'left';
  var rZh = pLang.add('radiobutton', undefined, '中文　日 一 二 三 四 五 六');
  var rEn3 = pLang.add('radiobutton', undefined, 'English 縮寫　SUN MON TUE…');
  var rEn1 = pLang.add('radiobutton', undefined, 'English 單字母　S M T W T F S');
  rZh.value = true;

  var gFont = dlg.add('group');
  gFont.add('statictext', undefined, '字體：');
  var fontDd = gFont.add('dropdownlist', undefined, fontNames);
  fontDd.selection = defIdx;
  fontDd.preferredSize.width = 280;

  var gBtn = dlg.add('group');
  gBtn.alignment = 'right';
  gBtn.add('button', undefined, '取消', { name: 'cancel' });
  gBtn.add('button', undefined, '產生', { name: 'ok' });

  if (dlg.show() != 1) { return; }

  var YEAR = parseInt(yearInput.text, 10);
  if (isNaN(YEAR)) { YEAR = 2026; }
  var WEEK_START = rMon.value ? 1 : 0;
  var LANG = rEn1.value ? 'en1' : (rEn3.value ? 'en3' : 'zh');

  var chosenFont = null;
  try { chosenFont = app.textFonts.getByName(fontDd.selection.text); } catch (e) { chosenFont = null; }

  // ---------- 尺寸設定 ----------
  var MM = 2.834645;
  var cellW = 24 * MM, cellH = 18 * MM;
  var titleSize = 28, headerSize = 11, dateSize = 15;
  var pad = 3 * MM;

  var gridW = cellW * 7;
  var titleH = 16 * MM, headerH = 9 * MM;
  var monthH = titleH + headerH + cellH * 6;
  var monthW = gridW;
  var marginX = 16 * MM, marginY = 16 * MM;
  var gapX = 12 * MM, gapY = 14 * MM;

  // ---------- 文字資料 ----------
  var monthsZh = ['一月', '二月', '三月', '四月', '五月', '六月',
                  '七月', '八月', '九月', '十月', '十一月', '十二月'];
  var monthsEn = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  var wdZh = ['日', '一', '二', '三', '四', '五', '六'];
  var wdEn3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var wdEn1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  var months = (LANG === 'zh') ? monthsZh : monthsEn;
  var wdSet = (LANG === 'zh') ? wdZh : (LANG === 'en1' ? wdEn1 : wdEn3);
  var headers = [];
  for (var i = 0; i < 7; i++) { headers.push(wdSet[(WEEK_START + i) % 7]); }

  // ---------- 文件 ----------
  var cols = 3, rows = 4;
  var docW = marginX * 2 + cols * monthW + (cols - 1) * gapX;
  var docH = marginY * 2 + rows * monthH + (rows - 1) * gapY;
  var doc = app.documents.add(DocumentColorSpace.RGB, docW, docH);
  doc.layers[0].name = YEAR + ' 數字月曆';

  // ---------- 座標：距工作區左上 (dx,dy) → [left, top] ----------
  // ※ 若整份上下顛倒：把 (abRect[1] - dy) 改成 (abRect[3] + dy)
  function pos(abRect, dx, dy) { return [abRect[0] + dx, abRect[1] - dy]; }

  function addText(abRect, dx, dy, str, size) {
    var t = doc.textFrames.add();
    t.contents = str;
    t.textRange.characterAttributes.size = size;
    if (chosenFont) {
      try { t.textRange.characterAttributes.textFont = chosenFont; } catch (e) {}
    }
    try { t.textRange.paragraphAttributes.justification = Justification.LEFT; } catch (e) {}
    var p = pos(abRect, dx, dy);
    t.left = p[0];
    t.top = p[1];
    return t;
  }

  // ---------- 畫一個月 ----------
  function drawMonth(abRect, monthIndex, originX, originY) {
    addText(abRect, originX, originY, months[monthIndex], titleSize);
    var hy = originY + titleH;
    for (var c = 0; c < 7; c++) {
      addText(abRect, originX + c * cellW + pad, hy, headers[c], headerSize);
    }
    var firstWd = new Date(YEAR, monthIndex, 1).getDay();
    var offset = (firstWd - WEEK_START + 7) % 7;
    var daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();
    var gridTop = originY + titleH + headerH;
    for (var d = 1; d <= daysInMonth; d++) {
      var idx = offset + (d - 1);
      var row = Math.floor(idx / 7), col = idx % 7;
      addText(abRect, originX + col * cellW + pad, gridTop + row * cellH + pad, '' + d, dateSize);
    }
  }

  // ---------- 主流程 ----------
  var ab = doc.artboards[0].artboardRect;
  for (var m = 0; m < 12; m++) {
    var gc = m % cols, gr = Math.floor(m / cols);
    drawMonth(ab, m, marginX + gc * (monthW + gapX), marginY + gr * (monthH + gapY));
  }

  app.redraw();
  alert('完成！' + YEAR + ' 年數字月曆已產生。\n字體：' + (chosenFont ? chosenFont.name : '預設') + '\n每個數字都是獨立文字、可單獨選取設計。');

})();
