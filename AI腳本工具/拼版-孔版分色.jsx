// ============================================================
//  拼版 — 孔版分色  for Adobe Illustrator
//  逐圖層複製到 A3、各色版自動對位、保留命名圖層結構
//
//  用法：
//   1. 先用「開圖層.jsx」建好命名圖層、把設計內容放進去
//   2. 檔案 → 指令碼 → 其他指令碼… → 選這個檔
//   3. 彈窗選訂單類型 / 輸入裁切尺寸 / 勾要拼版的圖層 → 拼版
//   4. 跑完當前 artboard 變 A3、設計按 cols×rows 落版、各色版保留圖層
//   * 不會自動存檔、妳 review 完才存
//   * 第一格用原物件、其他格用複製、undo 一次全部還原
//   * 對位以「裁切框中心」為錨點，不會被裁切標記或出血干擾
// ============================================================

#target illustrator

(function () {

  if (app.documents.length === 0) {
    alert('請先開要拼版的檔。');
    return;
  }
  var doc = app.activeDocument;
  var MM = 2.834645;  // 1 mm = 2.834645 pt

  // 落版框架預設（pitch = 兩格左邊到左邊的距離、cut = 裁切後尺寸）
  var PRESETS = {
    '明信片 直 (2×2)': { cols: 2, rows: 2, pitchH: 148.5, pitchV: 165,   cutW: 105, cutH: 148 },
    '明信片 橫 (2×2)': { cols: 2, rows: 2, pitchH: 165,   pitchV: 148.5, cutW: 148, cutH: 105 },
    '名片 (2×2)':      { cols: 2, rows: 2, pitchH: 148.5, pitchV: 70,    cutW: 85,  cutH: 55  },
    '自訂':            { cols: 1, rows: 1, pitchH: 100,   pitchV: 100,   cutW: 100, cutH: 100 }
  };
  var PRESET_NAMES = ['明信片 直 (2×2)', '明信片 橫 (2×2)', '名片 (2×2)', '自訂'];

  // ---------- 彈窗 ----------
  var dlg = new Window('dialog', '拼版 — 孔版分色');
  dlg.orientation = 'column';
  dlg.alignChildren = 'fill';
  dlg.margins = 16;

  // 落版框架
  var pFrame = dlg.add('panel', undefined, '落版框架');
  pFrame.orientation = 'column';
  pFrame.alignChildren = 'left';
  pFrame.margins = [12, 16, 12, 12];

  var gType = pFrame.add('group');
  gType.add('statictext', undefined, '訂單類型：');
  var typeDd = gType.add('dropdownlist', undefined, PRESET_NAMES);
  typeDd.selection = 0;

  var gAB = pFrame.add('group');
  gAB.add('statictext', undefined, 'A3 方向：');
  var rPortrait = gAB.add('radiobutton', undefined, '直');
  var rLandscape = gAB.add('radiobutton', undefined, '橫');
  rPortrait.value = true;

  var gCut = pFrame.add('group');
  gCut.add('statictext', undefined, '裁切尺寸 (mm)：寬');
  var cutWInput = gCut.add('edittext', undefined, '105'); cutWInput.characters = 6;
  gCut.add('statictext', undefined, '×  高');
  var cutHInput = gCut.add('edittext', undefined, '148'); cutHInput.characters = 6;

  var gCR = pFrame.add('group');
  gCR.add('statictext', undefined, '欄 × 列：');
  var colsInput = gCR.add('edittext', undefined, '2'); colsInput.characters = 4;
  gCR.add('statictext', undefined, '×');
  var rowsInput = gCR.add('edittext', undefined, '2'); rowsInput.characters = 4;

  var gP = pFrame.add('group');
  gP.add('statictext', undefined, 'pitch (mm)：水平');
  var pitchHInput = gP.add('edittext', undefined, '148.5'); pitchHInput.characters = 6;
  gP.add('statictext', undefined, '垂直');
  var pitchVInput = gP.add('edittext', undefined, '165');   pitchVInput.characters = 6;

  var gOpt = pFrame.add('group');
  var cbCenter = gOpt.add('checkbox', undefined, '置中（取消則靠紙張左上）');
  cbCenter.value = true;

  // preset 切換 → 自動帶數字
  typeDd.onChange = function () {
    var p = PRESETS[typeDd.selection.text];
    if (!p) return;
    colsInput.text = String(p.cols);
    rowsInput.text = String(p.rows);
    pitchHInput.text = String(p.pitchH);
    pitchVInput.text = String(p.pitchV);
    cutWInput.text = String(p.cutW);
    cutHInput.text = String(p.cutH);
  };

  // 色版圖層勾選
  var pLayers = dlg.add('panel', undefined, '要拼版的色版圖層');
  pLayers.orientation = 'column';
  pLayers.alignChildren = 'left';
  pLayers.margins = [12, 16, 12, 12];

  if (doc.layers.length === 0) {
    alert('文件裡沒有圖層。');
    return;
  }

  var layerChecks = [];
  for (var i = 0; i < doc.layers.length; i++) {
    var ly = doc.layers[i];
    var count = ly.pageItems.length;
    var label = ly.name + '  (' + count + ' 個物件)';
    var cb = pLayers.add('checkbox', undefined, label);
    cb.value = (count > 0);  // 預設：有內容才勾、空圖層不勾
    layerChecks.push({ layer: ly, check: cb });
  }

  // 按鈕
  var gBtn = dlg.add('group');
  gBtn.alignment = 'right';
  gBtn.add('button', undefined, '取消', { name: 'cancel' });
  gBtn.add('button', undefined, '拼版', { name: 'ok' });

  if (dlg.show() != 1) { return; }

  // ---------- 收參數 ----------
  var cols = parseInt(colsInput.text) || 1;
  var rows = parseInt(rowsInput.text) || 1;
  var pitchH_pt = (parseFloat(pitchHInput.text) || 0) * MM;
  var pitchV_pt = (parseFloat(pitchVInput.text) || 0) * MM;
  var cutW_pt = (parseFloat(cutWInput.text) || 0) * MM;
  var cutH_pt = (parseFloat(cutHInput.text) || 0) * MM;

  if (cols < 1 || rows < 1 || pitchH_pt <= 0 || pitchV_pt <= 0 || cutW_pt <= 0 || cutH_pt <= 0) {
    alert('欄/列/pitch/裁切尺寸 都要 > 0。');
    return;
  }

  // A3 紙張
  var A3_W = 297 * MM;
  var A3_H = 420 * MM;
  var sheetW, sheetH;
  if (rLandscape.value) { sheetW = A3_H; sheetH = A3_W; }
  else                  { sheetW = A3_W; sheetH = A3_H; }

  // 勾選的圖層
  var selectedLayers = [];
  for (var i = 0; i < layerChecks.length; i++) {
    if (layerChecks[i].check.value) selectedLayers.push(layerChecks[i].layer);
  }
  if (selectedLayers.length === 0) {
    alert('沒勾任何圖層、不執行。');
    return;
  }

  // artboard 改 A3
  var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
  var r = ab.artboardRect;
  var abLeft = r[0], abTop = r[1];
  ab.artboardRect = [abLeft, abTop, abLeft + sheetW, abTop - sheetH];

  // 量物件聯集中心（用 bounds 中點當錨點、不是用 bounds 大小算 pitch）
  // gb = [left, top, right, bottom]（Illustrator: top > bottom）
  var bounds = null;
  for (var i = 0; i < selectedLayers.length; i++) {
    var items = selectedLayers[i].pageItems;
    for (var j = 0; j < items.length; j++) {
      var gb = items[j].geometricBounds;
      if (!bounds) {
        bounds = [gb[0], gb[1], gb[2], gb[3]];
      } else {
        if (gb[0] < bounds[0]) bounds[0] = gb[0];
        if (gb[1] > bounds[1]) bounds[1] = gb[1];
        if (gb[2] > bounds[2]) bounds[2] = gb[2];
        if (gb[3] < bounds[3]) bounds[3] = gb[3];
      }
    }
  }
  if (!bounds) {
    alert('勾選的圖層裡沒有內容、不執行。');
    return;
  }

  var origCenterX = (bounds[0] + bounds[2]) / 2;
  var origCenterY = (bounds[1] + bounds[3]) / 2;

  // 拼版總尺寸用「裁切尺寸」算、不用 bounds（裁切標記/出血不會干擾）
  var totalW = (cols - 1) * pitchH_pt + cutW_pt;
  var totalH = (rows - 1) * pitchV_pt + cutH_pt;

  var startX, startY;
  if (cbCenter.value) {
    startX = abLeft + (sheetW - totalW) / 2;
    startY = abTop  - (sheetH - totalH) / 2;
  } else {
    startX = abLeft;
    startY = abTop;
  }

  // 快照各圖層原始 items 跟它們相對中心的偏移（duplicate 前先抓、避免複製到複製）
  var snapshots = [];
  for (var i = 0; i < selectedLayers.length; i++) {
    var layer = selectedLayers[i];
    var orig = [];
    for (var j = 0; j < layer.pageItems.length; j++) {
      var it = layer.pageItems[j];
      orig.push({
        item: it,
        offsetX: it.left - origCenterX,  // 相對原中心的水平偏移
        offsetY: it.top  - origCenterY   // 相對原中心的垂直偏移
      });
    }
    snapshots.push({ layer: layer, items: orig });
  }

  // 對每個圖層、對每格、複製並對位
  // 每格的「裁切框中心」 = startX + cc*pitchH + cutW/2 , startY - rr*pitchV - cutH/2
  for (var s = 0; s < snapshots.length; s++) {
    var items = snapshots[s].items;

    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < cols; cc++) {
        var cellCenterX = startX + cc * pitchH_pt + cutW_pt / 2;
        var cellCenterY = startY - rr * pitchV_pt - cutH_pt / 2;
        var isFirst = (rr === 0 && cc === 0);

        for (var k = 0; k < items.length; k++) {
          var rec = items[k];
          var target = isFirst ? rec.item : rec.item.duplicate();
          // item 跟原中心的相對位置不變、整組搬到新中心
          target.position = [cellCenterX + rec.offsetX, cellCenterY + rec.offsetY];
        }
      }
    }
  }

  app.redraw();

  // 圖層名清單
  var layerNames = [];
  for (var i = 0; i < selectedLayers.length; i++) layerNames.push(selectedLayers[i].name);

  alert('拼好了！\n\n' +
        '落版：' + cols + ' × ' + rows + ' = ' + (cols * rows) + ' 版\n' +
        '裁切尺寸：' + Math.round(cutW_pt / MM) + ' × ' + Math.round(cutH_pt / MM) + ' mm\n' +
        '色版圖層 ' + selectedLayers.length + ' 個：' + layerNames.join('、'));

})();
