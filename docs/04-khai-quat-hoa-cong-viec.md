# 04 · Ghi nhận Công việc — WorkLog & Leaf Nodes

## Vấn đề cần giải quyết

Mỗi phòng có loại công việc hoàn toàn khác nhau:

- Phòng Giao hàng: số chuyến giao, số đơn lắp đặt
- Phòng Kho: số pallet nhập, số đơn pick
- Phòng IT: số ticket đóng trong SLA
- Phòng Kế toán: số báo cáo nộp đúng deadline

Vấn đề: làm sao đo được tất cả trên cùng thang điểm 0–100, trong khi mỗi phòng có đơn vị và target khác nhau?

Giải pháp của hệ thống: không tạo catalog loại công việc riêng mà **map mỗi loại công việc thành một leaf node trong CriterionTree của phòng đó**, với `eval_type = "quantitative"`. Dữ liệu thô (số lượng) từ CRM/ERP đến dưới dạng WorkLog, hệ thống normalize thành điểm 0–100 theo rule trong leaf.

---

## Mô hình khái quát hóa công việc

Bất kỳ công việc nào — dù ở phòng ban nào, loại hình nào — đều có thể biểu diễn qua **5 chiều**:

| Chiều | Field | Ý nghĩa |
|-------|-------|---------|
| **Ai làm** | `employee_id` | Nhân viên thực hiện |
| **Làm gì** | `criterion_node_id` | Loại công việc — leaf node trong CriterionTree của phòng |
| **Bao nhiêu** | `quantity` | Thể tích — số đơn vị hoàn thành (> 0) |
| **Tốt không** | `score` | Chất lượng — điểm 0–100 sau normalize (tùy chọn khi gửi) |
| **Khi nào** | `logged_at` | Thời điểm thực hiện |

Đây là **phép khái quát hóa cốt lõi**: dù công việc là giao hàng, kế toán, IT hay biên tập — cuối cùng đều rút gọn về cùng 5 trường này để so sánh, tổng hợp và chấm điểm nhất quán trên toàn công ty.

### Pipeline khái quát hóa

```
Sự kiện thực tế (CRM / ERP)
         │
         ▼  ánh xạ qua external_ref → criterion_node_id
     WorkLog
  [employee_id × criterion_node_id × quantity × score? × logged_at]
         │
         ▼  normalize formula (từ description của leaf)
    Leaf Score  0–100
         │
         ▼  Σ quantity-weighted mean (nhiều WorkLog cùng leaf trong kỳ)
  Leaf Score (kỳ)
         │
         ▼  × weight, cộng anh em trong folder
   Folder Score
         │
         ▼  × weight, cộng anh em lên root
    Tree Score
         │
         ▼
     Scorecard
```

### Tính phổ quát — 4 phòng, 1 mô hình

| Phòng | Sự kiện thực | WorkLog nhận |
|-------|-------------|-------------|
| Giao hàng | Đơn #00812 hoàn thành | `external_ref=delivery_trip_count`, quantity=1 |
| Kế toán | Báo cáo tháng 4 nộp đúng hạn | `external_ref=accounting_report_ontime`, quantity=8, score=88 |
| IT | Ticket INC-2891 đóng trong SLA | `external_ref=it_ticket_within_sla`, quantity=1 |
| Kho | 48 pallet nhập, 3 lỗi sai vị trí | `external_ref=warehouse_pick_accuracy`, quantity=48, score=94 |

Cùng endpoint `POST /work-events`, cùng schema, cùng pipeline tính điểm.

---

## Các mẫu khái quát hóa nâng cao

### Một sự kiện thực → nhiều WorkLog

Một chuyến giao hàng chạm đến nhiều chiều đo khác nhau. CRM gửi 3 lần với cùng đơn nhưng `external_ref` khác nhau:

```json
{ "external_ref": "delivery_trip_count",   "quantity": 1, "external_id": "trip_001_vol",  "source": "crm" }
{ "external_ref": "delivery_ontime_rate",  "quantity": 1, "score": 100, "external_id": "trip_001_time", "source": "crm" }
{ "external_ref": "delivery_damage_check", "quantity": 1, "score": 95,  "external_id": "trip_001_safe", "source": "crm" }
```

Mỗi chiều đo (thể tích, đúng hạn, an toàn) → leaf riêng → weight riêng → tổng hợp theo cây. Không cần thay đổi cấu trúc leaf để thêm chiều đo mới.

### Độ phức tạp qua quantity

Không phải mọi đơn vị công việc đều như nhau. Hệ thống cho phép CRM mã hóa độ phức tạp qua `quantity`:

| Loại công việc | quantity | Lý do |
|---------------|----------|-------|
| Giao đơn nhỏ (document) | 1 | Chuẩn |
| Giao + lắp đặt điều hòa | 3 | Tương đương 3 chuyến thường về công sức |
| Giao nội thành | 1 | Chuẩn |
| Giao liên tỉnh | 2 | Xa hơn, nặng hơn |

Khi tổng hợp cuối kỳ, `quantity` đóng vai trọng số trong weighted mean:

```
leaf_score = Σ(score × quantity) / Σ(quantity)
```

CRM phản ánh được mức độ khó khác nhau của từng đơn mà không cần thay đổi cấu hình leaf node.

### Chấm điểm trễ (delayed scoring)

Một số công việc chỉ biết kết quả sau thời gian: giao hàng xong 3 ngày sau khách mới feedback, ticket đóng 24h sau khách đánh giá, báo cáo nộp cuối tháng mới audit.

WorkLog hỗ trợ pattern này: CRM gửi trước không có `score`, sau đó UPDATE bằng cùng `external_id` khi có kết quả:

```json
// Lần 1: giao xong, chưa có feedback
{ "external_id": "trip_001_qual", "external_ref": "delivery_quality", "quantity": 1 }

// 3 ngày sau: khách đánh giá 4/5 sao
{ "external_id": "trip_001_qual", "external_ref": "delivery_quality", "quantity": 1, "score": 80 }
// → UPDATE record cũ (idempotency key), không tạo bản mới
```

`logged_at` giữ nguyên thời điểm giao hàng. `score` được cập nhật khi có feedback. Scorecard tính theo `score` cuối cùng trong kỳ.

---

## Leaf node với eval_type=quantitative

Mỗi "loại công việc" định lượng của một phòng được biểu diễn là một leaf node trong CriterionTree của phòng đó, với `eval_type = "quantitative"`.

```typescript
// Ví dụ: leaf "Số chuyến giao" trong CriterionTree Phòng Giao hàng
{
  "id": "node_delivery_trips",
  "tree_id": "tree_delivery_v2",
  "parent_id": "node_folder_result",
  "name": "Số chuyến giao",
  "weight": 60,                          // 60% trong folder "Kết quả"
  "is_leaf": true,
  "eval_type": "quantitative",
  "external_ref": "delivery_trip_count", // Tag để CRM map đến node này
  "description": "Số chuyến giao/tháng. Target=100 chuyến/tháng. normalize = min(Σquantity / 100 × 100, 100)"
}
```

Hai field quan trọng:

- **`external_ref`**: tag tùy ý để CRM/ERP biết gửi dữ liệu vào node nào, không cần biết `node_id` nội bộ
- **`description`**: mô tả cách normalize score từ quantity — server đọc rule này để tính điểm, hoặc CRM tự tính rồi gửi `score` luôn

---

## WorkLog — bản ghi từng lần làm việc

Mỗi khi nhân viên hoàn thành một đơn vị công việc, hệ thống tạo một **WorkLog**:

```typescript
type WorkLog = {
  id: string;
  employee_id: string;
  period_id: string;
  criterion_node_id: string;   // FK → CriterionNode (phải là leaf, eval_type=quantitative)
  external_id?: string;        // ID từ CRM/ERP — dùng cho idempotency
  source?: string;             // "crm" | "erp" | "manual"
  quantity: number;            // Số lượng đơn vị (thường là 1)
  unit?: string;               // "chuyến", "pallet", "ticket", "báo cáo", ...
  score?: number;              // 0-100 đã normalize — CRM tự tính rồi gửi, hoặc server tính
  raw_data?: object;           // JSON gốc từ CRM/ERP để audit
  logged_at: ISO8601;
  created_at: ISO8601;
};
```

**`(external_id, source)` là cặp idempotency key**: CRM gửi lại cùng external_id sẽ UPDATE record cũ, không tạo bản mới.

---

## Cách CRM/ERP gửi dữ liệu

### Dùng external_ref (khuyến nghị)

CRM không cần biết `criterion_node_id` nội bộ. Dùng `external_ref` để hệ thống tự map:

```http
POST /work-events
Authorization: Bearer evk_live_...

{
  "employee_external_id": "CRM_EMP_042",
  "external_ref": "delivery_trip_count",
  "quantity": 1,
  "unit": "chuyến",
  "external_id": "crm_order_00812",
  "source": "crm",
  "logged_at": "2026-04-23T14:30:00Z"
}
```

Server tìm leaf node có `external_ref = "delivery_trip_count"` trong CriterionTree active của phòng nhân viên đó, tạo WorkLog tương ứng.

### Dùng criterion_node_id trực tiếp

Nếu hệ tích hợp sâu hơn và biết node ID:

```http
POST /work-events
{
  "employee_external_id": "CRM_EMP_042",
  "criterion_node_id": "node_delivery_trips",
  "quantity": 1,
  "external_id": "crm_order_00812",
  "source": "crm",
  "logged_at": "2026-04-23T14:30:00Z"
}
```

### Gửi score đã tính sẵn

Nếu CRM đã biết cách normalize, có thể gửi `score` trực tiếp thay vì để server tính:

```http
POST /work-events
{
  "employee_external_id": "CRM_EMP_042",
  "external_ref": "delivery_trip_count",
  "quantity": 143,
  "unit": "chuyến",
  "score": 95,                   // CRM tự tính: 143/150 × 100 ≈ 95
  "external_id": "crm_monthly_batch_042_apr",
  "source": "crm",
  "logged_at": "2026-04-30T23:59:00Z"
}
```

Khi `score` có sẵn, server dùng luôn giá trị đó — không tính lại từ quantity.

---

## Normalize score từ quantity

Khi WorkLog không có sẵn `score`, server tính dựa trên rule ghi trong `leaf.description`.

Công thức phổ biến:

```
# Target-based normalize
score = min(quantity / target × 100, 100)

# Tỷ lệ đúng hạn (khi có nhiều log trong kỳ)
score = (Σ quantity_ontime / Σ quantity_total) × 100
```

Khi aggregating nhiều WorkLog trong cùng kỳ:

```python
logs = WorkLog where employee_id = X and period_id = P and criterion_node_id = leaf.id

if all logs have score field:
    leaf_score = Σ(log.score × log.quantity) / Σ(log.quantity)  # Weighted mean
else:
    leaf_score = compute_from_description(logs, leaf.description)
```

**Nếu leaf.description không có rule rõ ràng và WorkLog không gửi score** → hệ thống không thể tính. Cần phối hợp với team CRM để đảm bảo một trong hai: mô tả rule trong description, hoặc CRM gửi `score` luôn.

---

## Ví dụ thực tế: 3 phòng khác nhau

### Phòng Giao hàng

Leaf: `"Số chuyến giao"`, `external_ref = "delivery_trip_count"`

CRM gửi mỗi chuyến hoàn thành:

```json
{
  "employee_external_id": "CRM_EMP_010",
  "external_ref": "delivery_trip_count",
  "quantity": 1,
  "unit": "chuyến",
  "external_id": "trip_20260423_010_001",
  "source": "crm",
  "logged_at": "2026-04-23T11:15:00Z"
}
```

Cuối tháng, NV Long giao 143 chuyến. Target = 150. Tổng quantity trong kỳ = 143.

```
score = min(143 / 150 × 100, 100) = 95.3
```

### Phòng Kế toán

Leaf: `"Báo cáo đúng hạn"`, `external_ref = "accounting_report_ontime"`

ERP gửi batch cuối tháng:

```json
{
  "employee_external_id": "ERP_ACC_005",
  "external_ref": "accounting_report_ontime",
  "quantity": 8,
  "unit": "báo cáo",
  "score": 88,                   // 8/9 báo cáo trong tháng nộp đúng hạn → 8/9 × 100 ≈ 88.9
  "external_id": "erp_acc_apr2026_005",
  "source": "erp",
  "logged_at": "2026-04-30T17:00:00Z"
}
```

ERP đã tự tính score (vì nó biết tổng số báo cáo cần nộp là 9). Server dùng `score = 88` trực tiếp.

### Phòng IT — Ticket support

Leaf: `"Ticket xử lý trong SLA"`, `external_ref = "it_ticket_within_sla"`

Ticket system gửi mỗi ticket đóng:

```json
{
  "employee_external_id": "CRM_EMP_031",
  "external_ref": "it_ticket_within_sla",
  "quantity": 1,
  "unit": "ticket",
  "external_id": "ticket_INC-2891",
  "source": "crm",
  "logged_at": "2026-04-23T16:45:00Z"
}
```

Trong kỳ, NV Hùng đóng 47 ticket. Target = 40/tháng.

```
score = min(47 / 40 × 100, 100) = 100  (capped tại 100)
```

---

## Dead Letter Queue — khi không map được

Nếu CRM gửi `external_ref` không khớp với bất kỳ leaf node nào trong cây active của phòng → hệ thống **không reject**, mà ghi vào **Dead Letter Queue (DLQ)**:

```json
// DLQ entry
{
  "error_code": "UNKNOWN_NODE_REF",
  "payload": { "external_ref": "delivery_return_trip", ... },
  "received_at": "2026-04-23T14:30:05Z",
  "status": "pending"
}
```

Admin nhận alert, kiểm tra:

- Nếu `external_ref` mới cần thêm vào tree → clone tree, thêm leaf mới với `external_ref` đó, publish version mới
- Nếu CRM gửi nhầm `external_ref` → yêu cầu CRM sửa
- Sau khi fix → replay DLQ entry, nó sẽ được xử lý thành WorkLog bình thường

DLQ đảm bảo **CRM không bao giờ bị block** — dữ liệu vẫn đến, chỉ đợi được xử lý. Không mất dữ liệu trong quá trình cấu hình hệ thống.

Tương tự với `employee_external_id` không tồn tại (`EMPLOYEE_NOT_FOUND`) hoặc kỳ đã finalized (`PERIOD_FINALIZED`) — đều vào DLQ thay vì từ chối.

---

## Weight thay cho "điểm công" cố định

Trong mô hình cũ, mỗi loại công việc có "điểm công" cố định (VD: lắp điều hòa = 10 điểm, giao đơn nhỏ = 1 điểm). Mô hình mới không dùng cơ chế này.

Thay vào đó, **weight của leaf trong CriterionTree** xác định mức độ quan trọng của loại công việc đó trong tổng điểm của phòng.

Ví dụ cây Giao hàng:

```
Kết quả (weight 50% trong tree)
  ├── Số chuyến giao     (weight 60% trong folder → đóng góp 30% vào tổng)
  └── Tỷ lệ đúng hạn    (weight 40% trong folder → đóng góp 20% vào tổng)
```

Phòng muốn tăng tầm quan trọng của "đúng hạn" so với "số lượng"? Điều chỉnh weight trong tree — không cần thay đổi cách CRM gửi dữ liệu, không cần đổi `external_ref`.

Điều chỉnh weight đòi hỏi tạo tree version mới (vì tree active là immutable). Nhưng `external_ref` của leaf vẫn giữ nguyên — CRM tiếp tục gửi như cũ, không cần cập nhật integration.

---

## Validation khi nhận WorkLog

### Hard reject (HTTP 400)

Server trả lỗi ngay, CRM phải sửa payload:

- Thiếu field bắt buộc (`employee_external_id` hoặc `employee_id`, `quantity`, `logged_at`)
- `quantity <= 0`
- `logged_at` format sai

### Dead letter (HTTP 422 — ghi vào DLQ)

Server nhận nhưng không xử lý được ngay, đợi admin fix data:

- `external_ref` không map được node nào
- `criterion_node_id` không tồn tại hoặc không phải leaf quantitative
- `employee_external_id` không tìm thấy trong hệ thống

### Business warning (vẫn accept, HTTP 200/201)

- Kỳ đã `finalized` → ghi DLQ, báo admin (không reject vì có thể mở kỳ bổ sung)

---

## Data model

```typescript
type WorkLog = {
  id: string;
  employee_id: string;           // FK → Employee
  period_id: string;             // FK → EvalPeriod
  criterion_node_id: string;     // FK → CriterionNode (leaf, eval_type=quantitative)
  external_id?: string;          // Từ CRM/ERP — idempotency key
  source?: string;               // "crm" | "erp" | "manual"
  quantity: number;              // Số lượng đơn vị (> 0)
  unit?: string;                 // "chuyến", "pallet", "ticket", "báo cáo", ...
  score?: number;                // 0-100 normalized — tính sẵn hoặc server tính
  raw_data?: object;             // JSON gốc từ CRM/ERP
  logged_at: ISO8601;
  created_at: ISO8601;
};
```

**Constraints:**

- `(external_id, source)` UNIQUE WHERE NOT NULL — idempotency
- `criterion_node_id` phải trỏ đến leaf có `eval_type = "quantitative"`
- CRM cùng source gửi lại cùng `external_id` → UPDATE record cũ (không tạo mới)

---

## Đọc tiếp

- `02-template-va-versioning.md` — CriterionTree lifecycle, cách thêm leaf node
- `05-tich-hop-crm-erp.md` — chi tiết integration pattern, authentication, webhook
- `spec/api-specification.md` — endpoint `POST /work-events` đặc tả đầy đủ
- `spec/business-rules.md` mục 1, 6, 8 — scoring formula, WorkLog validation, DLQ rules
