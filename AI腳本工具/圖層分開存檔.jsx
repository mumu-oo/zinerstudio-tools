// ============================================================
//  圖層分開存檔 / Export Layers to Files  for Adobe Illustrator
//  誌造所 ZINER STUDIO 免費分享 · zinerstudio.com
//
//  給孔版印刷分色完稿用：一個檔裡有 紅／藍／黃 幾個圖層，
//  跑完自動變成 原檔名_紅.ai、原檔名_藍.ai⋯⋯每個檔只含那一層。
//  也可以選 PDF（保留向量）或 JPG（300dpi、尺寸不變）。
//
//  用法：
//   1. 先把檔案存檔（腳本以硬碟上的檔為準、不會動到你的原檔）
//   2. 檔案 → 指令碼 → 其他指令碼…（Browse）→ 選這個檔
//   3. 勾要的格式 → 確定 → 輸出在原檔旁的「分層輸出」資料夾
//
//  規則：
//   * 空圖層自動跳過；鎖定、隱藏的圖層一樣會各自輸出
//   * JPG 以「作用中工作區域」為範圍、像素數按 300dpi 換算
//     （檔內 dpi 標籤 Illustrator 固定寫 72，在 PS 用「影像尺寸、
//       不重新取樣」改回 300 即為原尺寸，像素完全一致）
// ============================================================

#target illustrator

(function () {

  if (app.documents.length === 0) { alert('請先開啟要拆圖層的檔案。'); return; }
  var doc = app.activeDocument;

  // 要有實體檔案（我們是重開硬碟上的複本來拆、原檔完全不動）
  var srcFile;
  try { srcFile = doc.fullName; } catch (e) { srcFile = null; }
  if (!srcFile || !srcFile.exists) { alert('請先把檔案存檔一次再跑（腳本以硬碟上的檔為準）。'); return; }
  if (doc.saved === false) {
    if (!confirm('檔案有未儲存的變更。\n腳本會以「上次存檔的內容」來拆——要繼續嗎？\n（按「否」先去存檔）')) return;
  }

  function layerHasArt(layer) {
    if (layer.pageItems.length > 0) return true;
    for (var i = 0; i < layer.layers.length; i++) if (layerHasArt(layer.layers[i])) return true;
    return false;
  }

  // 收非空的頂層圖層（記 index、名字只拿來取檔名）
  var jobs = [];
  for (var i = 0; i < doc.layers.length; i++) {
    if (layerHasArt(doc.layers[i])) jobs.push({ index: i, name: doc.layers[i].name });
  }
  if (jobs.length === 0) { alert('沒有任何有內容的圖層。'); return; }

  // ---------- 選格式的小視窗 ----------
  var win = new Window('dialog', '圖層分開存檔');
  win.orientation = 'column'; win.alignChildren = 'left';
  win.add('statictext', undefined, '找到 ' + jobs.length + ' 個有內容的圖層，要輸出成：');
  var cbAI  = win.add('checkbox', undefined, 'AI　（每層一個 .ai、只含該圖層）');
  var cbPDF = win.add('checkbox', undefined, 'PDF （每層一個 .pdf、保留向量）');
  var cbJPG = win.add('checkbox', undefined, 'JPG （300dpi、尺寸不變、白底）');
  cbAI.value = true;
  var noteTxt = win.add('statictext', undefined, '輸出到原檔旁的「分層輸出」資料夾，檔名＝原檔名_圖層名', { multiline: true });
  noteTxt.preferredSize.width = 320;
  var btns = win.add('group'); btns.alignment = 'right';
  btns.add('button', undefined, '取消', { name: 'cancel' });
  btns.add('button', undefined, '開拆', { name: 'ok' });
  if (win.show() !== 1) return;
  if (!cbAI.value && !cbPDF.value && !cbJPG.value) { alert('至少勾一種格式啦。'); return; }

  // ---------- 輸出資料夾 ----------
  var baseName = decodeURI(srcFile.name).replace(/\.[^.]+$/, '');
  var outFolder = new Folder(srcFile.parent.fsName + '/分層輸出');
  if (!outFolder.exists) outFolder.create();

  function sanitize(s) { return s.replace(/[\/\\:*?"<>|]/g, '-'); }

  var done = [], failed = [];
  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j];
    var outBase = outFolder.fsName + '/' + baseName + '_' + sanitize(job.name);
    try {
      // 重開一份原檔當工作複本（原檔、目前開著的視窗都不會被動到）
      var copy = app.open(srcFile);
      // 只留目標圖層：其他頂層圖層解鎖後移除
      for (var k = copy.layers.length - 1; k >= 0; k--) {
        copy.layers[k].locked = false;
        if (k !== job.index) copy.layers[k].remove();
      }
      copy.layers[0].visible = true;

      if (cbAI.value) {
        var aiOpt = new IllustratorSaveOptions();
        aiOpt.embedICCProfile = true;
        copy.saveAs(new File(outBase + '.ai'), aiOpt);
      }
      if (cbPDF.value) {
        var pdfOpt = new PDFSaveOptions();
        pdfOpt.preserveEditability = true;
        copy.saveAs(new File(outBase + '.pdf'), pdfOpt);
      }
      if (cbJPG.value) {
        var jpgOpt = new ExportOptionsJPEG();
        jpgOpt.qualitySetting = 100;
        jpgOpt.antiAliasing = true;
        jpgOpt.artBoardClipping = true;               // 以作用中工作區域為範圍、每層尺寸一致
        jpgOpt.horizontalScale = 300 / 72 * 100;      // 300dpi 換算像素
        jpgOpt.verticalScale   = 300 / 72 * 100;
        copy.exportFile(new File(outBase + '.jpg'), ExportType.JPEG, jpgOpt);
      }
      copy.close(SaveOptions.DONOTSAVECHANGES);
      done.push(job.name);
    } catch (err) {
      try { copy.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
      failed.push(job.name + '（' + err + '）');
    }
  }

  var msg = '完成！輸出 ' + done.length + ' 個圖層 → 「分層輸出」資料夾\n' + done.join('、');
  if (failed.length) msg += '\n\n⚠ 失敗：\n' + failed.join('\n');
  alert(msg);

})();
