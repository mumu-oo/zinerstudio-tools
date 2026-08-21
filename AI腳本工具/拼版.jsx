// ============================================================
//  拼版 / N-up  for Adobe Illustrator
//  用法：
//   1. 把要拼的東西放一個上去（圖、群組、置入的客人檔案都行）
//   2. 選取它（多個物件會自動群組成一份）
//   3. 檔案 → 指令碼 → 其他指令碼… → 選這個檔
//   4. 彈窗選 紙張 / 方向 / 間距 / 邊距 → 確定
//   它會把選取的東西複製、依紙張排滿、置中，並告訴你落幾版
// ============================================================

#target illustrator

(function () {

  if (app.documents.length === 0) { alert('請先開一個文件、放上要拼的物件。'); return; }
  var doc = app.activeDocument;
  var sel = doc.selection;
  if (!sel || sel.length === 0) { alert('請先「選取」要拼版的物件（一個或一組都行）。'); return; }

  // ---------- 彈窗 ----------
  var dlg = new Window('dialog', '拼版 N-up');
  dlg.orientation = 'column';
  dlg.alignChildren = 'fill';
  dlg.margins = 16;

  var gSize = dlg.add('group');
  gSize.add('statictext', undefined, '紙張：');
  var sizeDd = gSize.add('dropdownlist', undefined, ['A3 (297×420)', 'A4 (210×297)', 'A5 (148×210)']);
  sizeDd.selection = 0;

  var pOri = dlg.add('panel', undefined, '方向');
  pOri.orientation = 'row'; pOri.alignChildren = 'left';
  var rPortrait = pOri.add('radiobutton', undefined, '直');
  var rLandscape = pOri.add('radiobutton', undefined, '橫');
  rPortrait.value = true;

  var gGut = dlg.add('group');
  gGut.add('statictext', undefined, '間距(mm)：');
  var gutInput = gGut.add('edittext', undefined, '4');
  gutInput.characters = 5;

  var gMar = dlg.add('group');
  gMar.add('statictext', undefined, '邊距(mm)：');
  var marInput = gMar.add('edittext', undefined, '8');
  marInput.characters = 5;

  var gBtn = dlg.add('group');
  gBtn.alignment = 'right';
  gBtn.add('button', undefined, '取消', { name: 'cancel' });
  gBtn.add('button', undefined, '拼版', { name: 'ok' });

  if (dlg.show() != 1) { return; }

  // ---------- 參數 ----------
  var MM = 2.834645;
  var sizes = [[297, 420], [210, 297], [148, 210]];   // A3/A4/A5 (直)
  var s = sizes[sizeDd.selection.index];
  var sheetW, sheetH;
  if (rLandscape.value) { sheetW = s[1] * MM; sheetH = s[0] * MM; }
  else { sheetW = s[0] * MM; sheetH = s[1] * MM; }

  var gut = (parseFloat(gutInput.text) || 0) * MM;
  var mar = (parseFloat(marInput.text) || 0) * MM;

  // ---------- 把選取整理成一份 master ----------
  var master;
  if (sel.length === 1) {
    master = sel[0];
  } else {
    var grp = doc.groupItems.add();
    for (var i = sel.length - 1; i >= 0; i--) { sel[i].moveToBeginning(grp); }
    master = grp;
  }
  var w = master.width;
  var h = master.height;

  // ---------- 把目前工作區改成選的紙張 ----------
  var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
  var r = ab.artboardRect;          // [left, top, right, bottom]
  var abLeft = r[0], abTop = r[1];
  ab.artboardRect = [abLeft, abTop, abLeft + sheetW, abTop - sheetH];

  // ---------- 算落幾版 ----------
  var usableW = sheetW - 2 * mar;
  var usableH = sheetH - 2 * mar;
  var cols = Math.floor((usableW + gut) / (w + gut));
  var rows = Math.floor((usableH + gut) / (h + gut));
  if (cols < 1) cols = 1;
  if (rows < 1) rows = 1;
  var count = cols * rows;

  var blockW = cols * w + (cols - 1) * gut;
  var blockH = rows * h + (rows - 1) * gut;
  var startX = mar + (usableW - blockW) / 2;   // 置中（距紙張左）
  var startY = mar + (usableH - blockH) / 2;   // 置中（距紙張上）

  // ---------- 排列 ----------
  // 距紙張左上 (dx,dy) → Illustrator [left, top]
  // ※ 若整份上下顛倒：把 (abTop - dy) 改成 ((abTop - sheetH) + dy)
  function place(item, col, row) {
    var dx = startX + col * (w + gut);
    var dy = startY + row * (h + gut);
    item.left = abLeft + dx;
    item.top = abTop - dy;
  }

  var k = 0;
  for (var rr = 0; rr < rows; rr++) {
    for (var cc = 0; cc < cols; cc++) {
      var it = (k === 0) ? master : master.duplicate();
      place(it, cc, rr);
      k++;
    }
  }

  app.redraw();
  alert('拼好了！\n落版：' + cols + ' × ' + rows + ' ＝ ' + count + ' 版\n單件尺寸：' +
        Math.round(w / MM) + ' × ' + Math.round(h / MM) + ' mm');

})();
