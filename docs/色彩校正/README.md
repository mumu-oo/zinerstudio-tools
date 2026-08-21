# 分色模擬器混色校正（進行中、2026-08-21 起）

**目標**：把 `tools/separation-simulator.html` 的疊色引擎從「sRGB 相乘」換成「實測透光率模型」——現行算法把疊色算太深太濁（天空100×螢粉100 算出 #622F9E 深紫、實印是 #9DAFF5 淺紫藍）。

## 已確定的事
- PS 特別色預覽（Solidity 0%）不可信：藍×紅算成酒紅、跟真墨不符，**退役不當標準**（ps-samples.json 留檔參考）
- Spectrolite 拆過（app.asar→sourcemap 還原）：疊色也是 sRGB 相乘＋透明度、無疊色實測；單色有 80 支墨的實測 .gob LUT（`/Applications/Spectrolite.app/Contents/Resources/bin/single-ink-profiles/`）可當沒卡墨色的墊底
- **唯一真理＝穆穆的實體混色卡**（RISOGRAPH PRINTING SWATCHES 系列、K% 階）

## 實測數據（real-samples.json）
- 來源照片：GDrive `社群用/印樣ㄉ/IMG_7077.JPG`（天空×螢粉卡）；paper 白平衡值在檔內
- 擬合結果（linear 透光率、halftone 模型 T=(1-k+k·t)）：
  - 天空 t = [0.132, 0.614, 0.908]（catalog #62A8E5 的 lin = [0.122, 0.392, 0.784]——實墨更透）
  - 螢粉 t = [**1.452**, 0.474, 0.936]——R>1＝螢光墨發光、一般公式模擬不了、只能實測
  - RMSE ≈ 0.072（18 個色塊、等%對角＋交叉配）
- 實測 100×100（校白後）= rgb(157,175,245)

## 下一步（新房接手）
1. 引擎：模擬器 render() 的 canvas `multiply`（sRGB）→ 改 linear 空間、每墨吃實測透光率表（天空/螢粉用上面數值、其他 9 色暫用 catalog lin 或 Spectrolite gob）
2. 穆穆的混色卡每多拍一張（平放均勻光）→ 兩支墨升級實測；全套收齊＝市面最準孔版預覽
3. 驗收方式：模擬器渲染天空×螢粉整條 K% 漸層 vs 混色卡照片並排、穆穆肉眼裁判
