# 擺攤 POS 資料 Schema v1

## 目的

這份文件定義擺攤 POS App 的資料骨架，目標是讓後續前端、資料庫、本機儲存與匯出功能都能依同一份結構實作。

本版本以離線優先為前提，適合先落地到本機資料庫，例如：

- SQLite
- IndexedDB
- 其他可離線保存的本機儲存方案

---

## Schema 設計原則

- 以本機資料優先，不依賴網路
- 保留歷史快照，避免商品日後改名或改價影響舊交易
- 儘量拆成穩定實體，避免單表塞入過多欄位
- 支援匯出 `CSV`
- 支援完整備份 `JSON`
- 預留多語系欄位，但 MVP 先以中文內容為主

---

## 主要實體總覽

1. Product
2. ProductTag
3. ProductImage
4. Inventory
5. ConsignmentProfile
6. PresetIcon
7. Order
8. OrderItem
9. PaymentRecord
10. PickupOrder
11. PickupItem
12. ImportJob
13. AppSetting
14. BackupRecord

---

## 1. Product

商品主檔。

### 欄位

- `id`
  - 型別：string
  - 說明：商品唯一 ID，建議使用 UUID

- `sku`
  - 型別：string | null
  - 說明：內部商品編號，可空白

- `name_zh`
  - 型別：string
  - 說明：中文商品名稱

- `name_en`
  - 型別：string | null
  - 說明：英文名稱，預留多語系

- `name_ja`
  - 型別：string | null
  - 說明：日文名稱，預留多語系

- `name_ko`
  - 型別：string | null
  - 說明：韓文名稱，預留多語系

- `category`
  - 型別：enum
  - 值：`book` `postcard` `poster` `goods` `handmade` `general`

- `price_twd`
  - 型別：integer
  - 說明：售價，單位為新台幣元，不用浮點數

- `is_adult_only`
  - 型別：boolean
  - 說明：是否為 18 禁商品

- `is_consignment`
  - 型別：boolean
  - 說明：是否為寄賣品

- `fallback_icon_id`
  - 型別：string | null
  - 說明：未上傳商品圖時使用的預設 icon

- `cover_image_id`
  - 型別：string | null
  - 說明：主要商品圖 ID

- `status`
  - 型別：enum
  - 值：`active` `archived` `sold_out_hidden`

- `note`
  - 型別：string | null
  - 說明：商品備註

- `sort_order`
  - 型別：integer
  - 說明：前台顯示排序

- `created_at`
  - 型別：datetime

- `updated_at`
  - 型別：datetime

### 備註

- `category` 只負責商品類型
- 新品、限定、常態、寄賣等屬性改由標籤表處理

---

## 2. ProductTag

商品標籤。採一商品對多標籤設計。

### 建議標籤值

- `new`
- `old`
- `standard`
- `limited`
- `consignment`
- `adult`

### 欄位

- `id`
  - 型別：string

- `product_id`
  - 型別：string

- `tag_code`
  - 型別：string

- `created_at`
  - 型別：datetime

### 備註

- `is_adult_only = true` 時，仍可同步有 `adult` 標籤，方便 UI 篩選
- `is_consignment = true` 時，也可同步有 `consignment` 標籤

---

## 3. ProductImage

商品圖片資料。

### 欄位

- `id`
  - 型別：string

- `product_id`
  - 型別：string

- `file_name`
  - 型別：string

- `mime_type`
  - 型別：string

- `local_path`
  - 型別：string
  - 說明：本機檔案路徑或應用內部資源位置

- `width`
  - 型別：integer | null

- `height`
  - 型別：integer | null

- `is_primary`
  - 型別：boolean

- `created_at`
  - 型別：datetime

---

## 4. Inventory

商品庫存資料。

### 欄位

- `product_id`
  - 型別：string
  - 說明：可作為主鍵之一對一對應 Product

- `stock_quantity`
  - 型別：integer
  - 說明：目前可售庫存

- `stock_reserved_pickup`
  - 型別：integer
  - 說明：已分配給預購取件的數量

- `stock_sold`
  - 型別：integer
  - 說明：現場已售累計

- `low_stock_threshold`
  - 型別：integer | null
  - 說明：低庫存警示值

- `updated_at`
  - 型別：datetime

### 設計說明

- `stock_quantity` 是前台結帳最重要的即時欄位
- 交易完成後，主要扣減 `stock_quantity`
- MVP 僅保留單一庫存欄位，避免市集與創作者使用者混淆

---

## 5. ConsignmentProfile

寄賣商品設定。

### 欄位

- `id`
  - 型別：string

- `product_id`
  - 型別：string

- `owner_name`
  - 型別：string
  - 說明：寄賣作者 / 攤主 / 品牌名

- `settlement_type`
  - 型別：enum
  - 值：`percentage` `flat`

- `settlement_rate`
  - 型別：number | null
  - 說明：百分比抽成，例如 0.2 表示 20%

- `settlement_flat_fee`
  - 型別：integer | null
  - 說明：固定抽成金額

- `note`
  - 型別：string | null

- `created_at`
  - 型別：datetime

- `updated_at`
  - 型別：datetime

### 設計說明

- 只有 `is_consignment = true` 的商品才需要這張資料

---

## 6. PresetIcon

未拍照商品可使用的預設 icon。

### 建議 icon 類型

- `book`
- `paper`
- `goods`
- `misc`

### 欄位

- `id`
  - 型別：string

- `icon_code`
  - 型別：string

- `label_zh`
  - 型別：string

- `asset_path`
  - 型別：string

- `sort_order`
  - 型別：integer

---

## 7. Order

交易主檔。

### 欄位

- `id`
  - 型別：string

- `order_no`
  - 型別：string
  - 說明：顯示用訂單編號，可讀性高

- `order_type`
  - 型別：enum
  - 值：`onsite_sale` `pickup`

- `subtotal_amount`
  - 型別：integer

- `discount_amount`
  - 型別：integer

- `total_amount`
  - 型別：integer

- `payment_status`
  - 型別：enum
  - 值：`paid` `voided`

- `note`
  - 型別：string | null

- `created_at`
  - 型別：datetime

- `updated_at`
  - 型別：datetime

### 設計說明

- `Order` 只放交易層級資料
- 每個商品明細放到 `OrderItem`
- 付款方式紀錄放到 `PaymentRecord`

---

## 8. OrderItem

交易商品明細。

### 欄位

- `id`
  - 型別：string

- `order_id`
  - 型別：string

- `product_id`
  - 型別：string | null
  - 說明：保留 null 的彈性，避免商品刪除導致舊交易失效

- `product_name_snapshot`
  - 型別：string
  - 說明：交易當下商品名稱快照

- `product_category_snapshot`
  - 型別：string

- `unit_price_snapshot`
  - 型別：integer

- `quantity`
  - 型別：integer

- `line_discount_amount`
  - 型別：integer

- `line_total_amount`
  - 型別：integer

- `is_consignment_snapshot`
  - 型別：boolean

- `is_adult_snapshot`
  - 型別：boolean

### 設計說明

- 採 snapshot 設計，避免商品後續變更破壞歷史交易

---

## 9. PaymentRecord

付款紀錄。

### 欄位

- `id`
  - 型別：string

- `order_id`
  - 型別：string

- `payment_method`
  - 型別：enum
  - 值：`cash` `transfer` `line_pay` `other`

- `amount`
  - 型別：integer

- `created_at`
  - 型別：datetime

### 設計說明

- MVP 可先預設單一付款方式
- 這樣設計可保留未來混合付款彈性

---

## 10. PickupOrder

預購取件主檔。

### 欄位

- `id`
  - 型別：string

- `import_job_id`
  - 型別：string | null
  - 說明：對應匯入來源批次

- `order_code`
  - 型別：string

- `customer_name`
  - 型別：string

- `contact`
  - 型別：string | null

- `status`
  - 型別：enum
  - 值：`pending` `picked_up` `cancelled`

- `picked_up_at`
  - 型別：datetime | null

- `note`
  - 型別：string | null

- `created_at`
  - 型別：datetime

- `updated_at`
  - 型別：datetime

---

## 11. PickupItem

預購取件商品明細。

### 欄位

- `id`
  - 型別：string

- `pickup_order_id`
  - 型別：string

- `product_id`
  - 型別：string | null

- `product_name_snapshot`
  - 型別：string

- `quantity`
  - 型別：integer

---

## 12. ImportJob

預購名單或商品資料的匯入紀錄。

### 欄位

- `id`
  - 型別：string

- `import_type`
  - 型別：enum
  - 值：`pickup_orders` `products`

- `file_name`
  - 型別：string

- `source_format`
  - 型別：enum
  - 值：`csv` `json`

- `record_count`
  - 型別：integer

- `status`
  - 型別：enum
  - 值：`success` `partial_success` `failed`

- `created_at`
  - 型別：datetime

- `note`
  - 型別：string | null

---

## 13. AppSetting

App 設定。

### 欄位

- `key`
  - 型別：string

- `value_json`
  - 型別：string
  - 說明：以 JSON 字串存放設定值

- `updated_at`
  - 型別：datetime

### 建議設定項目

- 前台預設語系
- 前台商品欄數偏好
- 預設付款方式清單
- 低庫存警示開關
- 自動備份開關

---

## 14. BackupRecord

備份執行紀錄。

### 欄位

- `id`
  - 型別：string

- `backup_type`
  - 型別：enum
  - 值：`manual` `auto`

- `file_name`
  - 型別：string

- `file_path`
  - 型別：string

- `status`
  - 型別：enum
  - 值：`success` `failed`

- `created_at`
  - 型別：datetime

- `note`
  - 型別：string | null

---

## 關聯摘要

- `Product` 1 對多 `ProductTag`
- `Product` 1 對多 `ProductImage`
- `Product` 1 對 1 `Inventory`
- `Product` 0 或 1 對 1 `ConsignmentProfile`
- `Order` 1 對多 `OrderItem`
- `Order` 1 對多 `PaymentRecord`
- `PickupOrder` 1 對多 `PickupItem`
- `ImportJob` 1 對多 `PickupOrder`

---

## MVP 必做欄位與功能對照

### 商品管理

至少需要：

- `Product`
- `ProductTag`
- `ProductImage`
- `PresetIcon`

### 庫存管理

至少需要：

- `Inventory`

### 前台結帳

至少需要：

- `Order`
- `OrderItem`
- `PaymentRecord`

### 預購取件

至少需要：

- `PickupOrder`
- `PickupItem`
- `ImportJob`

### 寄賣管理

至少需要：

- `ConsignmentProfile`
- `OrderItem.is_consignment_snapshot`

### 備份與設定

至少需要：

- `AppSetting`
- `BackupRecord`

---

## 匯出資料建議

### 銷售紀錄 CSV

建議欄位：

- 訂單編號
- 交易時間
- 商品名稱
- 數量
- 單價
- 折扣
- 小計
- 付款方式

### 寄賣結算 CSV

建議欄位：

- 寄賣對象
- 商品名稱
- 售出數量
- 銷售額
- 抽成方式
- 抽成金額
- 應結算金額

### 預購取件 CSV

建議欄位：

- 訂單編號
- 姓名
- 品項
- 數量
- 取件狀態
- 取件時間

---

## 技術落地建議

如果先求穩定、單機、離線好用，資料層建議優先考慮：

1. SQLite
2. App 內圖片資料夾
3. 匯出 `CSV / JSON`

理由：

- 比 `localStorage` 穩定很多
- 較適合交易紀錄與查詢
- 資料量成長後仍容易維護
- 備份與還原比較清楚

---

## 下一步建議

有了這份 schema 後，最適合接的工作順序是：

1. 定義前台 wireframe
2. 定義後台 wireframe
3. 決定本機資料層技術
4. 建立實際資料表或 model 檔
