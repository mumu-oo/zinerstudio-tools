// ============================================================
//  開圖層 / Setup Layers  for Adobe Illustrator
//  用法：
//   1. 開一個新檔（或已開好待整理的檔）
//   2. 檔案 → 指令碼 → 其他指令碼… → 選這個檔
//   3. 彈窗勾要用的色版 + 是否雙面 → 確定
//   4. 跑完文件裡就有一組命名乾淨的空圖層、塞圖案進去就好
//   * 已存在同名圖層會跳過、不覆蓋
//   * 勾雙面後可分別選正/反面要哪些色（兩面色不必相同）
// ============================================================

#target illustrator

(function () {

  if (app.documents.length === 0) {
    alert('請先開一個文件再跑這個。');
    return;
  }
  var doc = app.activeDocument;

  // 11 色清單（直接列、不分類）
  var INKS = ['黑', '青藍', '綠', '黃', '赤紅', '紫堇',
              '螢橘', '螢粉', '天空', '金', '薄荷'];

  // ---------- 彈窗 ----------
  var dlg = new Window('dialog', '開圖層 — 孔版色版');
  dlg.orientation = 'column';
  dlg.alignChildren = 'fill';
  dlg.margins = 16;

  // 一個 panel 放 11 個 checkbox（拆兩行不撐寬）
  function buildInkPanel(parent, title) {
    var p = parent.add('panel', undefined, title);
    p.orientation = 'column';
    p.alignChildren = 'left';
    p.margins = [12, 16, 12, 12];

    var row1 = p.add('group'); row1.orientation = 'row'; row1.alignChildren = 'left';
    var row2 = p.add('group'); row2.orientation = 'row'; row2.alignChildren = 'left';

    var checks = [];
    for (var i = 0; i < INKS.length; i++) {
      var target = (i < 6) ? row1 : row2;
      var cb = target.add('checkbox', undefined, INKS[i]);
      checks.push(cb);
    }
    return checks;
  }

  // 正面（或單面）色版
  var frontChecks = buildInkPanel(dlg, '色版（正面 / 單面）');

  // 雙面 toggle
  var pDuplex = dlg.add('panel', undefined, '雙面設定');
  pDuplex.orientation = 'column';
  pDuplex.alignChildren = 'left';
  pDuplex.margins = [12, 16, 12, 12];
  var cbDuplex = pDuplex.add('checkbox', undefined, '雙面印刷（自動加 正/反 前綴，正反面色可不同）');

  // 反面色版
  var backChecks = buildInkPanel(dlg, '反面色版（雙面時才建立）');

  function setBackEnabled(on) {
    for (var i = 0; i < backChecks.length; i++) backChecks[i].enabled = on;
  }
  setBackEnabled(false);
  cbDuplex.onClick = function () { setBackEnabled(cbDuplex.value); };

  // 按鈕
  var gBtn = dlg.add('group');
  gBtn.alignment = 'right';
  gBtn.add('button', undefined, '取消', { name: 'cancel' });
  gBtn.add('button', undefined, '建立圖層', { name: 'ok' });

  if (dlg.show() != 1) { return; }

  // ---------- 收集勾選 ----------
  function collect(checks) {
    var out = [];
    for (var i = 0; i < INKS.length; i++) {
      if (checks[i].value && checks[i].enabled) out.push(INKS[i]);
    }
    return out;
  }

  var front = collect(frontChecks);
  var back = cbDuplex.value ? collect(backChecks) : [];

  if (front.length === 0 && back.length === 0) {
    alert('沒勾任何色版、不執行。');
    return;
  }

  // ---------- 算要建的圖層名 ----------
  var toCreate = [];
  if (cbDuplex.value) {
    for (var i = 0; i < front.length; i++) toCreate.push('正 ' + front[i]);
    for (var i = 0; i < back.length; i++) toCreate.push('反 ' + back[i]);
  } else {
    for (var i = 0; i < front.length; i++) toCreate.push(front[i]);
  }

  // 「剪裁標記」永遠在最上面（toCreate[0]、反向遍歷時最後 add → 頂層）
  toCreate.unshift('剪裁標記');

  // ---------- 建圖層（跳過已存在）----------
  var existing = {};
  for (var i = 0; i < doc.layers.length; i++) {
    existing[doc.layers[i].name] = true;
  }

  var created = [], skipped = [];
  // 反向遍歷：最後 add 的會在最上面、所以 toCreate[0] 最後 add → 在最上
  for (var i = toCreate.length - 1; i >= 0; i--) {
    var name = toCreate[i];
    if (existing[name]) {
      skipped.push(name);
    } else {
      var layer = doc.layers.add();
      layer.name = name;
      created.push(name);
    }
  }
  created.reverse();
  skipped.reverse();

  // ---------- 回報 ----------
  var msg = '建好了！\n\n新增 ' + created.length + ' 個圖層';
  if (created.length > 0) msg += '：\n  ' + created.join('、');
  if (skipped.length > 0) msg += '\n\n跳過已存在 ' + skipped.length + ' 個：\n  ' + skipped.join('、');
  alert(msg);

})();
