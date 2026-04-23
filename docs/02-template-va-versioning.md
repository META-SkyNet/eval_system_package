# 02 · CriterionTree & Versioning

## Khái niệm cốt lõi

Mỗi phòng ban sở hữu một **CriterionTree** — cây tiêu chí đánh giá được phiên bản hóa. Đây là bộ khung hoàn chỉnh xác định "phòng này đánh giá nhân viên theo những tiêu chí nào, với trọng số bao nhiêu, đo bằng cách nào."

CriterionTree là thứ duy nhất định nghĩa cấu trúc đánh giá của một phòng — không có "template" riêng, không có "pillar library" chung. Mỗi phòng có cây riêng, cây được phiên bản hóa để bảo toàn lịch sử.

Cấu trúc cây:

```
CriterionTree (phòng + version)
  └── CriterionNode (root, folder)
        ├── CriterionNode (folder)
        │     ├── CriterionNode (leaf, eval_type=quantitative)
        │     └── CriterionNode (leaf, eval_type=qualitative_360)
        └── CriterionNode (leaf, eval_type=event)
```

Có hai loại node:

- **Folder** (`is_leaf = false`): nhóm các tiêu chí con, tổng hợp điểm theo trọng số
- **Leaf** (`is_leaf = true`): tiêu chí đo thực sự, có `eval_type` xác định cách tính điểm

---

## Vòng đời (lifecycle)

```
      [Tạo mới]
         │
         ▼
    ┌─────────┐     [Publish]      ┌──────────┐
    │  draft  │ ─────────────────▶ │  active  │
    └─────────┘                    └──────────┘
         │                              │
         │ Có thể thêm/sửa/xóa node    │ [Version mới publish]
         │                              ▼
         │                        ┌──────────┐
         └──────────────────────▶ │ archived │
                                  └──────────┘
                                  (giữ vĩnh viễn để xem lịch sử)
```

### draft

- Đang xây dựng, có thể thêm/sửa/xóa node thoải mái
- Chưa được dùng để mở kỳ đánh giá
- Có thể tồn tại nhiều draft cùng lúc (nhưng chỉ 1 tree active/phòng)

### active

- Đang được sử dụng để đánh giá nhân viên trong kỳ hiện tại
- **Immutable** — không sửa, không xóa, không thêm node
- Chỉ 1 tree active tại 1 thời điểm mỗi phòng
- Mọi EvalPeriod mới của phòng sẽ gắn với tree đang active

### archived

- Đã bị thay thế bởi version mới
- Vẫn được giữ nguyên để tra cứu lịch sử đánh giá cũ
- Các kỳ đánh giá đã mở với tree này vẫn tiếp tục tham chiếu đến nó
- Không được phục hồi về active

---

## Cách xây dựng CriterionTree

### Bước 1: Tạo draft

Có hai cách khởi tạo:

**Cách A — Clone từ Preset Library:**

```http
POST /criterion-trees
{
  "department_id": "warehouse",
  "clone_from_preset": "preset_warehouse_standard"
}
```

Server clone toàn bộ cấu trúc node từ preset thành draft mới. Phòng có thể chỉnh sửa tự do sau khi clone.

**Cách B — Clone từ tree hiện có (thường dùng khi update):**

```http
POST /criterion-trees
{
  "department_id": "warehouse",
  "clone_from_tree": "tree_wh_v2"
}
```

**Cách C — Tạo từ đầu (blank):**

```http
POST /criterion-trees
{
  "department_id": "warehouse"
}
```

### Bước 2: Thêm node

Thêm folder và leaf vào draft. Node không có `parent_id` là root node.

```http
POST /criterion-trees/{tree_id}/nodes
{
  "parent_id": null,
  "name": "Kết quả công việc",
  "weight": 50,
  "is_leaf": false,
  "sort_order": 1
}

POST /criterion-trees/{tree_id}/nodes
{
  "parent_id": "node_folder_ket_qua",
  "name": "Số đơn nhập kho",
  "weight": 60,
  "is_leaf": true,
  "eval_type": "quantitative",
  "external_ref": "wh_inbound_count",
  "description": "Số pallet nhập/ngày. Target=20, normalize = min(quantity/20 × 100, 100)",
  "sort_order": 1
}
```

### Bước 3: Kiểm tra điều kiện

Trước khi publish, hệ thống kiểm tra:

1. Có ít nhất 1 root node
2. Tất cả siblings (cùng cha) có Σ weight = 100% (±0.01 tolerance)
3. Root nodes có Σ weight = 100%
4. Không có orphan node
5. Mọi leaf node có `eval_type` hợp lệ
6. Mọi folder node có `eval_type = null`
7. Không quá 4 cấp depth (root = level 1)

Có thể kiểm tra trước khi publish:

```http
POST /criterion-trees/{tree_id}/validate
```

Response trả về danh sách lỗi nếu có.

### Bước 4: Publish

```http
POST /criterion-trees/{tree_id}/activate
```

Khi activate thành công:

- Tree hiện tại chuyển sang `active`
- Tree active cũ (nếu có) tự động chuyển sang `archived`
- Từ đây, mọi EvalPeriod mới của phòng sẽ gắn với tree này

---

## Khi muốn thay đổi tiêu chí

**Quy tắc bất biến: không bao giờ sửa tree đang active.**

Quy trình thay đổi:

1. Clone tree hiện tại thành draft mới (version tăng tự động)
2. Sửa draft — thêm, bớt, đổi trọng số node tùy ý
3. Validate → Publish
4. Tree cũ tự động archived

Dữ liệu lịch sử không bị ảnh hưởng: work_logs, events, và scorecard_snapshots cũ vẫn giữ nguyên tham chiếu đến `criterion_tree_id` cũ. Khi xem lịch sử kỳ Q1, hệ thống dùng tree của Q1 — không phải tree hiện tại.

Ví dụ cụ thể:

- Phòng Kho đang dùng tree v2 (active)
- QL muốn thêm tiêu chí "Kiểm kê định kỳ" → clone v2 thành v3 (draft)
- Sửa v3: thêm leaf mới, điều chỉnh trọng số
- Publish v3 → v2 thành archived, v3 thành active
- Kỳ tháng 4 sẽ dùng v3; kỳ tháng 3 (đã finalized) vẫn tham chiếu v2

---

## Preset Library

Để tiết kiệm thời gian khởi tạo cho phòng mới, hệ thống cung cấp **Preset Library** — tập hợp các cây tiêu chí mẫu phổ biến theo loại phòng.

| Preset | Cấu trúc mẫu |
|--------|-------------|
| Giao hàng chuẩn | Kết quả (50%) + Chất lượng (30%) + Tuân thủ (20%) |
| Kho chuẩn | Kết quả nhập/xuất (45%) + Độ chính xác (35%) + An toàn (20%) |
| Bảo hành chuẩn | Kết quả ca (35%) + Tay nghề (25%) + Chất lượng (25%) + Phản hồi (15%) |
| Kế toán chuẩn | Độ chính xác (40%) + Tiến độ (30%) + Tuân thủ (20%) + Phát triển (10%) |
| Bán hàng chuẩn | Doanh số (50%) + Khách hàng mới (25%) + Chất lượng tư vấn (25%) |

Preset chỉ là điểm khởi đầu — phòng có thể chỉnh sửa thoải mái sau khi clone. Preset không ràng buộc schema hay tên tiêu chí.

---

## Ví dụ thực tế: CriterionTree Phòng Kho (v1)

```json
{
  "id": "tree_wh_v1",
  "department_id": "warehouse",
  "version": 1,
  "status": "active",
  "activated_at": "2026-01-15T08:00:00Z",
  "nodes": [
    {
      "id": "n_result",
      "parent_id": null,
      "name": "Kết quả nhập/xuất",
      "weight": 45,
      "is_leaf": false,
      "sort_order": 1,
      "children": [
        {
          "id": "n_inbound",
          "parent_id": "n_result",
          "name": "Số pallet nhập kho",
          "weight": 50,
          "is_leaf": true,
          "eval_type": "quantitative",
          "external_ref": "wh_inbound_pallet",
          "description": "Số pallet nhập/ngày. Target=20 pallet/ngày, normalize = min(quantity/target × 100, 100)",
          "sort_order": 1
        },
        {
          "id": "n_outbound",
          "parent_id": "n_result",
          "name": "Số đơn pick hoàn thành",
          "weight": 50,
          "is_leaf": true,
          "eval_type": "quantitative",
          "external_ref": "wh_pick_completed",
          "description": "Số đơn pick hoàn thành/ngày. Target=30 đơn/ngày",
          "sort_order": 2
        }
      ]
    },
    {
      "id": "n_accuracy",
      "parent_id": null,
      "name": "Độ chính xác",
      "weight": 35,
      "is_leaf": false,
      "sort_order": 2,
      "children": [
        {
          "id": "n_pick_acc",
          "parent_id": "n_accuracy",
          "name": "Tỷ lệ pick đúng",
          "weight": 60,
          "is_leaf": true,
          "eval_type": "event",
          "description": "Sự vụ lỗi pick. Mỗi lỗi -5 điểm từ baseline 100",
          "sort_order": 1
        },
        {
          "id": "n_360",
          "parent_id": "n_accuracy",
          "name": "Đánh giá QL",
          "weight": 40,
          "is_leaf": true,
          "eval_type": "qualitative_360",
          "description": "QL trực tiếp chấm 0-100 cuối kỳ",
          "sort_order": 2
        }
      ]
    },
    {
      "id": "n_safety",
      "parent_id": null,
      "name": "An toàn & Tuân thủ",
      "weight": 20,
      "is_leaf": true,
      "eval_type": "manual",
      "description": "QL nhập điểm cuối kỳ dựa trên quan sát thực tế",
      "sort_order": 3
    }
  ]
}
```

Cây này có 3 root nodes (n_result + n_accuracy + n_safety, tổng weight = 45+35+20 = 100%). Mỗi folder có siblings tổng = 100%.

---

## Liên kết với EvalPeriod

Mỗi kỳ đánh giá (EvalPeriod) được gắn cứng với một `criterion_tree_id` tại thời điểm mở kỳ:

```typescript
type EvalPeriod = {
  id: string;
  department_id: string;
  criterion_tree_id: string;   // Gắn cứng khi tạo, không thay đổi
  status: "open" | "closed" | "finalized";
  // ...
};
```

Khi mở kỳ mới, hệ thống tự động lấy tree đang active của phòng đó. Khi tree sau đó bị archive, kỳ đó vẫn tham chiếu đến tree cũ — đảm bảo xem lại lịch sử bất cứ lúc nào cũng cho kết quả chính xác.

Hệ quả: một phòng có thể có nhiều kỳ đánh giá tham chiếu đến nhiều tree version khác nhau. Đây là thiết kế cố ý — "Q1/2026 dùng tiêu chí nào?" phải trả lời được sau 5 năm.

---

## Data model tóm tắt

```typescript
type CriterionTree = {
  id: string;
  department_id: string;
  version: number;              // 1, 2, 3, ... monotonic
  status: "draft" | "active" | "archived";
  activated_at?: ISO8601;
  created_by: string;
  created_at: ISO8601;
};

type CriterionNode = {
  id: string;
  tree_id: string;
  parent_id: string | null;     // null = root node
  name: string;
  weight: number;               // % so với siblings (Σ siblings = 100)
  is_leaf: boolean;
  eval_type:
    | null                      // folder
    | "quantitative"            // tính từ work_logs
    | "qualitative_360"         // form 360°
    | "event"                   // tính từ events confirmed
    | "manual"                  // QL nhập trực tiếp
    | "ai";                     // AI chấm, luôn pending_review
  description?: string;         // Mô tả cách tính / normalize
  external_ref?: string;        // Map với CRM/ERP field
  sort_order: number;
  created_at: ISO8601;
};
```

Chi tiết constraints và scoring formula xem `spec/data-model.md` và `spec/business-rules.md`.

---

## Đọc tiếp

- `03-su-vu-va-ghi-nhan.md` — module Sự vụ (eval_type=event)
- `04-khai-quat-hoa-cong-viec.md` — ghi nhận công việc định lượng (eval_type=quantitative)
- `spec/business-rules.md` mục 5 — quy tắc chi tiết publish, immutability, validate
