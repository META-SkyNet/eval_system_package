# API Specification v2

Base URL: `https://eval.company.vn/api/v1`

---

## Authentication

Mọi request phải có 3 headers:

```
X-API-Key: evk_live_...
X-Timestamp: 1714400000
X-Signature: sha256-hex-...
```

**HMAC signature:** `HMAC-SHA256(secret, timestamp + "." + raw_body)`

- `timestamp`: Unix epoch seconds. Server reject nếu lệch > 5 phút.
- `raw_body`: chuỗi JSON nguyên gốc của request body (không được re-serialize).
- `Content-Type`: `application/json` cho mọi POST/PATCH request.

API key có 2 loại:
- `evk_live_...` — external integration (CRM/ERP, AI Engine)
- `evk_int_...` — internal (dashboard admin, frontend)

---

## Chuẩn lỗi chung

```json
{
  "error_code": "STRING_CODE",
  "message": "Mô tả lỗi bằng tiếng Việt",
  "details": {}
}
```

**HTTP status codes:**
- `200 OK` — Thành công, không tạo mới (GET, idempotent duplicate)
- `201 Created` — Tạo mới thành công
- `400 Bad Request` — Thiếu field, sai format
- `401 Unauthorized` — Sai API key hoặc signature
- `403 Forbidden` — API key không có quyền cho endpoint này
- `409 Conflict` — Vi phạm unique constraint không thể giải quyết idempotently
- `422 Unprocessable Entity` — Payload hợp lệ nhưng vi phạm business rule
- `429 Too Many Requests` — Rate limit (100 req/s/API key mặc định)
- `500 Internal Server Error` — Server lỗi, client có thể retry

---

## Nhóm endpoints: Work Events

Ingest công việc hoàn thành từ CRM/ERP. Mỗi work event tạo ra một `work_log` gắn với một `criterion_node` loại `quantitative` hoặc `ai`.

---

### POST /work-events

Báo công việc hoàn thành. Hỗ trợ hai cách xác định node đích: UUID trực tiếp hoặc `external_ref` để server tự resolve.

**Request:**
```json
{
  "employee_external_id": "CRM_EMP_042",
  "department_external_id": "DEPT_DELIVERY",
  "criterion_node_id": "550e8400-e29b-41d4-a716-446655440000",
  "external_id": "CRM-ORD-2026-04-22-8847",
  "source": "crm",
  "quantity": 1,
  "unit": "đơn",
  "score": 85,
  "raw_data": {
    "order_id": "ORD-8847",
    "customer_district": "Cầu Giấy",
    "completed_at": "2026-04-22T14:30:00Z"
  },
  "logged_at": "2026-04-22T14:30:00Z"
}
```

Thay thế: dùng `external_ref` thay vì `criterion_node_id` khi CRM không biết UUID nội bộ:

```json
{
  "employee_external_id": "CRM_EMP_042",
  "department_external_id": "DEPT_DELIVERY",
  "external_ref": "LAP_DH",
  "external_id": "CRM-ORD-2026-04-22-8847",
  "source": "crm",
  "quantity": 1,
  "logged_at": "2026-04-22T14:30:00Z"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `employee_external_id` | ✓ | string | external_id của nhân viên trong CRM/ERP |
| `department_external_id` | ✓ | string | Dùng để resolve external_ref và period |
| `criterion_node_id` | ✓* | UUID | ID trực tiếp của leaf node. Bắt buộc nếu không có `external_ref` |
| `external_ref` | ✓* | string | Tên node trong active tree của department. Server resolve sang `criterion_node_id`. Bắt buộc nếu không có `criterion_node_id` |
| `external_id` | ✓ | string | Idempotency key — unique theo `(external_id, source)` |
| `source` | ✓ | string | `"crm"`, `"erp"`, `"manual"`, v.v. |
| `quantity` | ✓ | number > 0 | Số lượng đơn vị |
| `unit` | | string | Nhãn đơn vị, VD: `"đơn"`, `"cuộc"`, `"ca"` |
| `score` | | number 0–100 | Nếu không truyền, server tính theo công thức của node (hoặc normalize theo quantity) |
| `raw_data` | | object | JSON tùy ý, lưu để debug/audit, không dùng cho scoring |
| `logged_at` | ✓ | ISO8601 | Thời điểm thực tế công việc xảy ra (UTC) |

**Response 201:**
```json
{
  "log_id": "wl_5f3a2b",
  "employee_id": "emp_a7f3",
  "criterion_node_id": "550e8400-e29b-41d4-a716-446655440000",
  "score": 85,
  "status": "recorded"
}
```

**Response 200 — duplicate idempotent:**
```json
{
  "log_id": "wl_5f3a2b",
  "employee_id": "emp_a7f3",
  "criterion_node_id": "550e8400-e29b-41d4-a716-446655440000",
  "score": 85,
  "status": "recorded",
  "idempotent": true
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `UNKNOWN_NODE_REF` | `external_ref` không map được node nào trong active tree. Event bị đẩy vào Dead Letter Queue |
| 422 | `UNKNOWN_EMPLOYEE` | `employee_external_id` không tìm thấy |
| 422 | `PERIOD_CLOSED` | Không tìm thấy eval period đang `open` cho department + thời điểm `logged_at` |
| 409 | `DUPLICATE_EVENT` | `(external_id, source)` đã tồn tại nhưng có dị biệt dữ liệu — không thể resolve idempotently |

**Lưu ý về Dead Letter Queue:** Khi gặp `UNKNOWN_NODE_REF`, server vẫn trả 422 (fire-and-forget không bị block) nhưng ghi record vào DLQ. Admin có thể xử lý thủ công hoặc re-map sau khi cập nhật criterion tree.

---

## Nhóm endpoints: Events / Incidents

Ghi nhận sự kiện (khen, phàn nàn, sự cố, sáng kiến). Mọi sự kiện mới tạo ở status `pending` — phải có QL xác nhận trước khi ảnh hưởng điểm.

---

### POST /events

**Request:**
```json
{
  "employee_external_id": "CRM_EMP_042",
  "department_external_id": "DEPT_DELIVERY",
  "criterion_node_id": null,
  "external_id": "CRM-COMPLAINT-2026-04-22-12",
  "source": "crm",
  "category": "complaint",
  "severity": "normal",
  "direction": "negative",
  "title": "Giao hàng trễ 3 tiếng",
  "description": "Khách phản ánh giao muộn, không báo trước",
  "reporter_external_id": "CRM_EMP_099",
  "occurred_at": "2026-04-22T15:00:00Z"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `employee_external_id` | ✓ | string | Nhân viên bị ảnh hưởng |
| `department_external_id` | ✓ | string | Phòng ban |
| `criterion_node_id` | | UUID \| null | Nếu null → general event không gắn với node cụ thể |
| `external_id` | ✓ | string | Idempotency key |
| `source` | ✓ | string | `"crm"`, `"erp"`, `"internal"`, v.v. |
| `category` | ✓ | enum | `commendation` \| `complaint` \| `incident` \| `initiative` \| `campaign_reward` |
| `severity` | ✓ | enum | `light` \| `normal` \| `heavy` |
| `direction` | ✓ | enum | `positive` \| `negative` |
| `title` | ✓ | string | Tiêu đề ngắn (max 200 ký tự) |
| `description` | | string | Mô tả chi tiết (min 10 ký tự nếu có) |
| `reporter_external_id` | ✓ | string | external_id của người ghi nhận — server resolve sang `reporter_id` FK |
| `occurred_at` | ✓ | ISO8601 | Thời điểm sự kiện xảy ra |

**Response 201:**
```json
{
  "event_id": "evt_8a9c",
  "score_impact": -5,
  "status": "pending"
}
```

`score_impact` được tính server-side từ công thức `severity × direction`. Giá trị âm = trừ điểm, dương = cộng điểm. Admin có thể override sau qua PATCH.

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `UNKNOWN_REPORTER` | `reporter_external_id` không tìm thấy |
| 422 | `UNKNOWN_EMPLOYEE` | `employee_external_id` không tìm thấy |
| 422 | `INVALID_CATEGORY` | category không nằm trong enum hợp lệ |
| 422 | `INVALID_SEVERITY` | severity không phải `light`/`normal`/`heavy` |
| 409 | `DUPLICATE_EVENT` | `(external_id, source)` đã tồn tại |

---

### GET /events/{id}

Xem chi tiết sự kiện.

**Response 200:**
```json
{
  "id": "evt_8a9c",
  "employee_id": "emp_a7f3",
  "period_id": "period_2026_04",
  "criterion_node_id": null,
  "external_id": "CRM-COMPLAINT-2026-04-22-12",
  "source": "crm",
  "category": "complaint",
  "severity": "normal",
  "direction": "negative",
  "score_impact": -5,
  "title": "Giao hàng trễ 3 tiếng",
  "description": "Khách phản ánh giao muộn, không báo trước",
  "reporter_id": "emp_b1c2",
  "status": "pending",
  "occurred_at": "2026-04-22T15:00:00Z",
  "created_at": "2026-04-22T15:05:00Z"
}
```

---

### POST /events/{id}/confirm

QL xác nhận sự kiện — chuyển từ `pending` sang `confirmed`.

**Request:**
```json
{
  "reviewed_by_external_id": "CRM_MGR_001"
}
```

**Response 200:**
```json
{
  "event_id": "evt_8a9c",
  "status": "confirmed",
  "score_impact": -5
}
```

---

### POST /events/{id}/dispute

NV phản đối sự kiện — chuyển sang `disputed`.

**Request:**
```json
{
  "reason": "Tôi đã thông báo cho khách qua điện thoại trước 2 tiếng"
}
```

**Response 200:**
```json
{
  "event_id": "evt_8a9c",
  "status": "disputed"
}
```

---

### GET /events

Danh sách sự kiện với filter.

**Query params:**

| Param | Ghi chú |
|-------|---------|
| `employee_id` | UUID nội bộ |
| `period_id` | UUID của eval period |
| `status` | `pending` \| `confirmed` \| `disputed` \| `resolved` |
| `category` | `commendation` \| `complaint` \| `incident` \| `initiative` \| `campaign_reward` |
| `limit` | Default 50, max 200 |
| `offset` | Default 0 |

**Response 200:**
```json
{
  "total": 12,
  "items": [
    {
      "id": "evt_8a9c",
      "employee_id": "emp_a7f3",
      "category": "complaint",
      "severity": "normal",
      "direction": "negative",
      "score_impact": -5,
      "title": "Giao hàng trễ 3 tiếng",
      "status": "pending",
      "occurred_at": "2026-04-22T15:00:00Z"
    }
  ]
}
```

---

## Nhóm endpoints: Qualitative Scores

Chấm điểm định tính — dùng cho các criterion node có `eval_type = qualitative_360`. Người chấm có thể là QL, đồng nghiệp, bộ phận khác, hoặc bản thân nhân viên (self-assessment).

---

### POST /qualitative-scores

**Request:**
```json
{
  "employee_external_id": "CRM_EMP_042",
  "period_id": "period_2026_04",
  "criterion_node_id": "660e8400-e29b-41d4-a716-446655440001",
  "evaluator_external_id": "CRM_MGR_001",
  "evaluator_role": "manager",
  "score": 80,
  "comment": "Tinh thần làm việc nhóm tốt, chủ động hỗ trợ đồng nghiệp"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `employee_external_id` | ✓ | string | Nhân viên được chấm |
| `period_id` | ✓ | UUID | Eval period |
| `criterion_node_id` | ✓ | UUID | Phải là leaf node với `eval_type = qualitative_360` |
| `evaluator_external_id` | ✓ | string | Người chấm |
| `evaluator_role` | ✓ | enum | `manager` \| `peer` \| `cross_dept` \| `self` |
| `score` | ✓ | number 0–100 | |
| `comment` | | string | Nhận xét tự do |

**Response 201:**
```json
{
  "score_id": "qs_3d4e",
  "score": 80,
  "status": "recorded"
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 409 | `ALREADY_SCORED` | `(employee_id, period_id, criterion_node_id, evaluator_id)` đã tồn tại |
| 422 | `UNKNOWN_EMPLOYEE` | `employee_external_id` không tìm thấy |
| 422 | `PERIOD_CLOSED` | Eval period không còn ở trạng thái `open` |

---

### GET /qualitative-scores

**Query params:**

| Param | Ghi chú |
|-------|---------|
| `employee_id` | UUID nội bộ |
| `period_id` | UUID của eval period |
| `criterion_node_id` | UUID của node |

**Response 200:**
```json
{
  "total": 3,
  "items": [
    {
      "id": "qs_3d4e",
      "employee_id": "emp_a7f3",
      "criterion_node_id": "660e8400-e29b-41d4-a716-446655440001",
      "evaluator_id": "emp_mgr_001",
      "evaluator_role": "manager",
      "score": 80,
      "comment": "Tinh thần làm việc nhóm tốt",
      "created_at": "2026-04-22T10:00:00Z"
    }
  ]
}
```

---

## Nhóm endpoints: Manual Scores

Điểm thủ công do QL nhập trực tiếp — dùng cho các criterion node có `eval_type = manual`. Upsert: lần ghi cuối thắng cho cùng `(employee_id, period_id, criterion_node_id)`.

---

### POST /manual-scores

**Request:**
```json
{
  "employee_external_id": "CRM_EMP_042",
  "period_id": "period_2026_04",
  "criterion_node_id": "770e8400-e29b-41d4-a716-446655440002",
  "score": 90,
  "rationale": "Hoàn thành đào tạo nội bộ module Advanced, đạt 95/100",
  "scored_by_external_id": "CRM_MGR_001"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `employee_external_id` | ✓ | string | |
| `period_id` | ✓ | UUID | |
| `criterion_node_id` | ✓ | UUID | Phải là leaf node với `eval_type = manual` |
| `score` | ✓ | number 0–100 | |
| `rationale` | | string | Lý do — khuyến khích nhập để audit trail |
| `scored_by_external_id` | ✓ | string | QL nhập điểm |

**Response 200/201:** Server trả 201 nếu tạo mới, 200 nếu upsert existing.
```json
{
  "score_id": "ms_5e6f",
  "score": 90,
  "action": "created"
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `UNKNOWN_EMPLOYEE` | `employee_external_id` không tìm thấy |
| 422 | `PERIOD_CLOSED` | Eval period không còn ở trạng thái `open` |

---

### GET /manual-scores

**Query params:**

| Param | Ghi chú |
|-------|---------|
| `employee_id` | UUID nội bộ |
| `period_id` | UUID của eval period |

**Response 200:**
```json
{
  "total": 2,
  "items": [
    {
      "id": "ms_5e6f",
      "employee_id": "emp_a7f3",
      "criterion_node_id": "770e8400-e29b-41d4-a716-446655440002",
      "score": 90,
      "rationale": "Hoàn thành đào tạo nội bộ module Advanced",
      "scored_by": "emp_mgr_001",
      "created_at": "2026-04-22T11:00:00Z",
      "updated_at": "2026-04-22T11:00:00Z"
    }
  ]
}
```

---

## Nhóm endpoints: Criterion Trees

Quản lý cây tiêu chí đánh giá của từng phòng ban. Cây có 3 trạng thái: `draft` → `active` → `archived`. Chỉ sửa được cây ở trạng thái `draft`.

---

### GET /criterion-trees

Danh sách cây của một phòng ban.

**Query params:**

| Param | Ghi chú |
|-------|---------|
| `department_id` | UUID phòng ban (bắt buộc) |
| `status` | `draft` \| `active` \| `archived` (optional) |

**Response 200:**
```json
{
  "total": 3,
  "items": [
    {
      "id": "tree_abc123",
      "department_id": "dept_delivery",
      "version": 2,
      "status": "active",
      "description": "Bộ tiêu chí Q2/2026",
      "created_at": "2026-03-15T09:00:00Z",
      "published_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

---

### POST /criterion-trees

Tạo draft tree mới cho phòng ban. Có thể clone từ preset.

**Request:**
```json
{
  "department_id": "dept_delivery",
  "description": "Bộ tiêu chí Q3/2026",
  "clone_from_preset_id": "preset_delivery_standard"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `department_id` | ✓ | UUID | |
| `description` | | string | Mô tả ngắn cho version này |
| `clone_from_preset_id` | | UUID | Nếu truyền, copy toàn bộ node structure từ preset |

**Response 201:**
```json
{
  "tree_id": "tree_def456",
  "version": 3,
  "status": "draft"
}
```

---

### GET /criterion-trees/{id}

Lấy toàn bộ cây với node tree dạng nested JSON.

**Response 200:**
```json
{
  "id": "tree_abc123",
  "department_id": "dept_delivery",
  "version": 2,
  "status": "active",
  "description": "Bộ tiêu chí Q2/2026",
  "root_nodes": [
    {
      "id": "node_001",
      "parent_id": null,
      "name": "Hiệu suất công việc",
      "weight": 60,
      "is_leaf": false,
      "eval_type": null,
      "external_ref": null,
      "sort_order": 1,
      "children": [
        {
          "id": "node_002",
          "parent_id": "node_001",
          "name": "Lắp đặt đơn hàng",
          "weight": 70,
          "is_leaf": true,
          "eval_type": "quantitative",
          "external_ref": "LAP_DH",
          "description": "Số đơn lắp đặt hoàn thành đúng hạn",
          "sort_order": 1,
          "children": []
        },
        {
          "id": "node_003",
          "parent_id": "node_001",
          "name": "Giao hàng nhỏ",
          "weight": 30,
          "is_leaf": true,
          "eval_type": "quantitative",
          "external_ref": "GIAO_NHO",
          "description": null,
          "sort_order": 2,
          "children": []
        }
      ]
    },
    {
      "id": "node_004",
      "parent_id": null,
      "name": "Thái độ & Teamwork",
      "weight": 40,
      "is_leaf": false,
      "eval_type": null,
      "external_ref": null,
      "sort_order": 2,
      "children": [
        {
          "id": "node_005",
          "parent_id": "node_004",
          "name": "Đánh giá 360°",
          "weight": 100,
          "is_leaf": true,
          "eval_type": "qualitative_360",
          "external_ref": null,
          "description": null,
          "sort_order": 1,
          "children": []
        }
      ]
    }
  ]
}
```

---

### POST /criterion-trees/{id}/nodes

Thêm node vào draft tree. Chỉ hoạt động khi tree ở trạng thái `draft`.

**Request:**
```json
{
  "parent_id": "node_001",
  "name": "Chat hỗ trợ khách",
  "weight": 30,
  "is_leaf": true,
  "eval_type": "ai",
  "description": "AI chấm điểm chất lượng chat dựa trên transcript",
  "external_ref": "CHAT_SUPPORT",
  "sort_order": 3
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `parent_id` | | UUID \| null | null = root node |
| `name` | ✓ | string | |
| `weight` | ✓ | number 0–100 | Phần trăm trong nhóm anh em |
| `is_leaf` | ✓ | boolean | Node lá mới được nhận data chấm điểm |
| `eval_type` | ✓ nếu `is_leaf` | enum | `quantitative` \| `qualitative_360` \| `event` \| `manual` \| `ai` |
| `description` | | string | Mô tả, hiển thị cho QL khi chấm |
| `external_ref` | | string | Mã tham chiếu từ CRM/ERP để resolve node |
| `sort_order` | | integer | Thứ tự hiển thị trong cùng nhóm |

**Response 201:**
```json
{
  "node_id": "node_006",
  "tree_id": "tree_def456",
  "parent_id": "node_001",
  "name": "Chat hỗ trợ khách",
  "weight": 30,
  "is_leaf": true,
  "eval_type": "ai"
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `TREE_NOT_DRAFT` | Tree không ở trạng thái `draft` |
| 422 | `INVALID_EVAL_TYPE` | `eval_type` không hợp lệ hoặc thiếu khi `is_leaf = true` |
| 422 | `DEPTH_EXCEEDED` | Thêm node này sẽ làm cây sâu hơn 4 cấp |

---

### PATCH /criterion-trees/{id}/nodes/{nodeId}

Sửa thông tin node. Chỉ hoạt động khi tree ở trạng thái `draft`.

**Request** (gửi chỉ những field cần sửa):
```json
{
  "name": "Chat hỗ trợ khách hàng",
  "weight": 25,
  "description": "Cập nhật mô tả mới"
}
```

**Response 200:**
```json
{
  "node_id": "node_006",
  "updated_fields": ["name", "weight", "description"]
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `TREE_NOT_DRAFT` | Tree không ở trạng thái `draft` |

---

### DELETE /criterion-trees/{id}/nodes/{nodeId}

Xóa node và toàn bộ subtree bên dưới. Chỉ hoạt động khi tree ở trạng thái `draft`.

**Response 200:**
```json
{
  "deleted_node_ids": ["node_006", "node_007"]
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `TREE_NOT_DRAFT` | Tree không ở trạng thái `draft` |

---

### POST /criterion-trees/{id}/publish

Publish draft tree thành active. Tree active cũ (nếu có) sẽ chuyển sang `archived`. Hệ thống validate toàn bộ cây trước khi publish.

**Điều kiện publish:**
- Ít nhất 1 root node
- Tổng weight của các node anh em (cùng parent) = 100%
- Không có node lá thiếu `eval_type`
- Chiều sâu cây ≤ 4 cấp
- Không có orphan node

**Request:** (không cần body)

**Response 201:**
```json
{
  "tree_id": "tree_def456",
  "version": 3,
  "status": "active",
  "archived_tree_id": "tree_abc123"
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân | details |
|------|-----------|-------------|---------|
| 422 | `WEIGHT_SUM_ERROR` | Nhóm node anh em không cộng bằng 100% | `{ "node_id": "...", "parent_id": "...", "actual_sum": 95 }` |
| 422 | `EMPTY_TREE` | Cây không có node nào | |
| 422 | `DEPTH_EXCEEDED` | Cây sâu hơn 4 cấp | `{ "max_depth_found": 5 }` |
| 422 | `INVALID_EVAL_TYPE` | Có leaf node thiếu hoặc sai `eval_type` | `{ "node_id": "..." }` |
| 422 | `TREE_NOT_DRAFT` | Tree không ở trạng thái `draft` | |

---

### POST /criterion-trees/{id}/archive

Archive tree đang active (thủ công, không thường dùng — publish cây mới đã tự archive cũ).

**Response 200:**
```json
{
  "tree_id": "tree_abc123",
  "status": "archived"
}
```

---

## Nhóm endpoints: Preset Libraries

Bộ template cây tiêu chí mẫu do admin hệ thống cung cấp. Phòng ban clone preset khi tạo tree mới.

---

### GET /preset-libraries

Danh sách preset có sẵn.

**Response 200:**
```json
{
  "total": 4,
  "items": [
    {
      "id": "preset_delivery_standard",
      "name": "Giao hàng & Lắp đặt — Tiêu chuẩn",
      "description": "3 trụ cột: Hiệu suất (60%), Thái độ (25%), Sự vụ (15%)",
      "node_count": 12,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "preset_support_standard",
      "name": "Hỗ trợ khách hàng — Tiêu chuẩn",
      "description": "3 trụ cột: Chất lượng chat (50%), Giải quyết (30%), Thái độ (20%)",
      "node_count": 10,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### GET /preset-libraries/{id}

Chi tiết preset với full node tree.

**Response 200:**
```json
{
  "id": "preset_delivery_standard",
  "name": "Giao hàng & Lắp đặt — Tiêu chuẩn",
  "description": "3 trụ cột: Hiệu suất (60%), Thái độ (25%), Sự vụ (15%)",
  "root_nodes": [
    {
      "name": "Hiệu suất công việc",
      "weight": 60,
      "is_leaf": false,
      "children": [
        {
          "name": "Lắp đặt đơn hàng",
          "weight": 70,
          "is_leaf": true,
          "eval_type": "quantitative",
          "external_ref": "LAP_DH"
        },
        {
          "name": "Giao hàng nhỏ",
          "weight": 30,
          "is_leaf": true,
          "eval_type": "quantitative",
          "external_ref": "GIAO_NHO"
        }
      ]
    }
  ]
}
```

---

## Nhóm endpoints: Eval Periods

Quản lý kỳ đánh giá. Mỗi kỳ gắn với một phòng ban và một criterion tree đang `active`.

---

### POST /eval-periods

Tạo kỳ đánh giá mới.

**Request:**
```json
{
  "department_id": "dept_delivery",
  "name": "Tháng 4/2026",
  "period_start": "2026-04-01",
  "period_end": "2026-04-30",
  "criterion_tree_id": "tree_abc123"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `department_id` | ✓ | UUID | |
| `name` | ✓ | string | Tên hiển thị của kỳ |
| `period_start` | ✓ | ISO date | Ngày bắt đầu |
| `period_end` | ✓ | ISO date | Ngày kết thúc |
| `criterion_tree_id` | ✓ | UUID | Phải là tree `active` của department |

**Response 201:**
```json
{
  "period_id": "period_2026_04",
  "status": "open"
}
```

---

### GET /eval-periods

**Query params:**

| Param | Ghi chú |
|-------|---------|
| `department_id` | UUID phòng ban |
| `status` | `open` \| `closed` \| `finalized` |

**Response 200:**
```json
{
  "total": 4,
  "items": [
    {
      "id": "period_2026_04",
      "department_id": "dept_delivery",
      "name": "Tháng 4/2026",
      "period_start": "2026-04-01",
      "period_end": "2026-04-30",
      "criterion_tree_id": "tree_abc123",
      "status": "open"
    }
  ]
}
```

---

### POST /eval-periods/{id}/close

Đóng kỳ đánh giá — không nhận thêm work events, events, hay scores mới.

**Response 200:**
```json
{
  "period_id": "period_2026_04",
  "status": "closed"
}
```

---

### POST /eval-periods/{id}/finalize

Chốt kỳ đánh giá — kích hoạt tính điểm cuối và tạo scorecard_snapshot cho toàn bộ nhân viên. Không thể rollback.

**Response 200:**
```json
{
  "period_id": "period_2026_04",
  "status": "finalized",
  "snapshots_generated": 28
}
```

---

## Nhóm endpoints: Scorecard

Bảng điểm tổng hợp của nhân viên theo kỳ. Cấu trúc `breakdown` phản ánh trực tiếp criterion tree với điểm đã điền vào.

---

### GET /scorecard

Bảng điểm cá nhân.

**Query params:**

| Param | Required | Ghi chú |
|-------|----------|---------|
| `employee_id` | ✓ | UUID nội bộ |
| `period_id` | ✓ | UUID của eval period |

**Response 200:**
```json
{
  "employee_id": "emp_a7f3",
  "period_id": "period_2026_04",
  "total_score": 82.5,
  "rank": 3,
  "completeness": 87,
  "generated_at": "2026-04-30T23:00:00Z",
  "breakdown": [
    {
      "node_id": "node_001",
      "name": "Hiệu suất công việc",
      "weight": 60,
      "score": 88.0,
      "is_leaf": false,
      "eval_type": null,
      "children": [
        {
          "node_id": "node_002",
          "name": "Lắp đặt đơn hàng",
          "weight": 70,
          "score": 91.0,
          "is_leaf": true,
          "eval_type": "quantitative",
          "children": []
        },
        {
          "node_id": "node_003",
          "name": "Giao hàng nhỏ",
          "weight": 30,
          "score": 80.0,
          "is_leaf": true,
          "eval_type": "quantitative",
          "children": []
        }
      ]
    },
    {
      "node_id": "node_004",
      "name": "Thái độ & Teamwork",
      "weight": 40,
      "score": null,
      "is_leaf": false,
      "eval_type": null,
      "children": [
        {
          "node_id": "node_005",
          "name": "Đánh giá 360°",
          "weight": 100,
          "score": null,
          "is_leaf": true,
          "eval_type": "qualitative_360",
          "children": []
        }
      ]
    }
  ],
  "missing_leaves": [
    {
      "node_id": "node_005",
      "name": "Đánh giá 360°",
      "reason": "Chưa có đủ lượt chấm qualitative_360"
    }
  ]
}
```

`completeness` là phần trăm (0–100) số leaf node có đủ dữ liệu để tính điểm. `rank` là null nếu kỳ chưa `finalized`.

**Caching:** Server cache 5 phút. Gọi lại trong 5 phút trả về cùng snapshot.

---

### GET /scorecard/department

Bảng điểm toàn phòng ban.

**Query params:**

| Param | Required | Ghi chú |
|-------|----------|---------|
| `department_id` | ✓ | UUID phòng ban |
| `period_id` | ✓ | UUID của eval period |

**Response 200:**
```json
{
  "period_id": "period_2026_04",
  "department_id": "dept_delivery",
  "employees": [
    {
      "employee_id": "emp_a7f3",
      "name": "Nguyễn Văn Nam",
      "total_score": 82.5,
      "rank": 3,
      "completeness": 87
    },
    {
      "employee_id": "emp_b2c3",
      "name": "Trần Thị Lan",
      "total_score": 91.0,
      "rank": 1,
      "completeness": 100
    }
  ]
}
```

Danh sách đã sắp xếp theo `rank` tăng dần (rank 1 = điểm cao nhất). Không bao gồm chi tiết `breakdown` — dùng `GET /scorecard` cho từng cá nhân.

---

## Nhóm endpoints: AI Evaluations

AI Engine đẩy kết quả chấm điểm vào đây. **Tất cả kết quả AI luôn bắt đầu ở `pending_review`** — QL phải xem xét và quyết định trước khi điểm được áp dụng. Không có auto-confirm.

---

### POST /ai-evaluations

AI gửi kết quả chấm cho một leaf node có `eval_type = ai`.

**Request:**
```json
{
  "employee_external_id": "CRM_EMP_042",
  "period_id": "period_2026_04",
  "criterion_node_id": "880e8400-e29b-41d4-a716-446655440003",
  "external_id": "CHAT-2026-04-22-8847",
  "source": "crm_ai_engine",
  "input_data": {
    "conversation_id": "chat_8847",
    "duration_minutes": 14,
    "resolved": true,
    "customer_sentiment_end": "neutral",
    "message_count": 22
  },
  "ai_score": 78,
  "ai_reasoning": "Phiên chat giải quyết được vấn đề nhưng thời gian phản hồi ban đầu chậm (6 phút). Thái độ tốt, không viết tắt, xin lỗi đúng chỗ. Điểm trừ ở tốc độ phản hồi.",
  "ai_model": "claude-sonnet-4-6"
}
```

**Fields:**

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `employee_external_id` | ✓ | string | |
| `period_id` | ✓ | UUID | |
| `criterion_node_id` | ✓ | UUID | Phải là leaf node với `eval_type = ai` |
| `external_id` | ✓ | string | Idempotency key |
| `source` | ✓ | string | `"crm_ai_engine"`, `"erp_ai"`, v.v. |
| `input_data` | ✓ | object | JSON dữ liệu đầu vào AI đã dùng để chấm |
| `ai_score` | ✓ | number 0–100 | Điểm AI đề xuất |
| `ai_reasoning` | ✓ | string | Giải thích của AI |
| `ai_model` | ✓ | string | Tên model đã dùng |

**Response 201:**
```json
{
  "evaluation_id": "aiev_7c3f",
  "status": "pending_review"
}
```

**Errors:**

| HTTP | error_code | Nguyên nhân |
|------|-----------|-------------|
| 422 | `UNKNOWN_EMPLOYEE` | `employee_external_id` không tìm thấy |
| 422 | `PERIOD_CLOSED` | Eval period không còn ở trạng thái `open` |
| 409 | `DUPLICATE_EVENT` | `(external_id, source)` đã tồn tại — trả 200 với bản gốc |

---

### GET /ai-evaluations/{id}

Xem chi tiết kết quả AI (để QL review).

**Response 200:**
```json
{
  "id": "aiev_7c3f",
  "employee_id": "emp_a7f3",
  "period_id": "period_2026_04",
  "criterion_node_id": "880e8400-e29b-41d4-a716-446655440003",
  "external_id": "CHAT-2026-04-22-8847",
  "source": "crm_ai_engine",
  "input_data": { "conversation_id": "chat_8847", "..." : "..." },
  "ai_score": 78,
  "ai_reasoning": "Phiên chat giải quyết được vấn đề nhưng thời gian phản hồi ban đầu chậm...",
  "ai_model": "claude-sonnet-4-6",
  "final_score": null,
  "status": "pending_review",
  "created_at": "2026-04-22T14:35:00Z",
  "reviewed_at": null,
  "reviewed_by": null
}
```

---

### POST /ai-evaluations/{id}/confirm

QL xác nhận kết quả AI — `final_score = ai_score`, status → `confirmed`.

**Request:**
```json
{
  "reviewed_by_external_id": "CRM_MGR_001"
}
```

**Response 200:**
```json
{
  "evaluation_id": "aiev_7c3f",
  "final_score": 78,
  "status": "confirmed"
}
```

---

### POST /ai-evaluations/{id}/override

QL không đồng ý với AI, ghi đè điểm — `final_score = override value`, status → `overridden`.

**Request:**
```json
{
  "final_score": 90,
  "reviewed_by_external_id": "CRM_MGR_001",
  "reason": "AI không biết context: khách này là VIP, phải xử lý ưu tiên hơn. Thời gian phản hồi dài là có chủ ý."
}
```

**Response 200:**
```json
{
  "evaluation_id": "aiev_7c3f",
  "final_score": 90,
  "status": "overridden"
}
```

---

### POST /ai-evaluations/{id}/discard

QL từ chối kết quả AI — status → `discarded`, không tính vào điểm.

**Request:**
```json
{
  "reviewed_by_external_id": "CRM_MGR_001",
  "reason": "Input data không đủ để AI chấm chính xác"
}
```

**Response 200:**
```json
{
  "evaluation_id": "aiev_7c3f",
  "status": "discarded"
}
```

---

### GET /ai-evaluations/pending

Danh sách kết quả AI đang chờ QL review.

**Query params:**

| Param | Ghi chú |
|-------|---------|
| `department_id` | UUID phòng ban |
| `period_id` | UUID của eval period |
| `limit` | Default 50, max 200 |
| `offset` | Default 0 |

**Response 200:**
```json
{
  "total_pending": 7,
  "items": [
    {
      "id": "aiev_7c3f",
      "employee_id": "emp_a7f3",
      "employee_name": "Nguyễn Văn Nam",
      "criterion_node_id": "880e8400-e29b-41d4-a716-446655440003",
      "criterion_node_name": "Chat hỗ trợ khách",
      "ai_score": 78,
      "ai_model": "claude-sonnet-4-6",
      "source": "crm_ai_engine",
      "created_at": "2026-04-22T14:35:00Z"
    }
  ]
}
```

---

## Nhóm endpoints: Campaigns

Campaign là cơ chế kích hoạt tinh thần theo sự kiện (team goal, peer recognition, individual awards). Các endpoints này chủ yếu dùng bởi dashboard admin nội bộ.

---

### POST /campaigns

Tạo campaign mới ở trạng thái `draft`.

**Request:**
```json
{
  "name": "Chiến dịch Mùa hè 2026",
  "description": "Vượt qua cao điểm nắng nóng cùng nhau",
  "type": "team_goal",
  "department_ids": ["dept_delivery"],
  "period_start": "2026-06-01",
  "period_end": "2026-07-31",
  "reward_description": "Tiệc BBQ + 500k/người khi đạt. Vượt 110% thêm 1 ngày nghỉ mát.",
  "config": {
    "goals": [
      { "metric": "work_count", "target": 15000 },
      { "metric": "ontime_rate", "target": 88 }
    ]
  }
}
```

**Response 201:**
```json
{
  "campaign_id": "cmp_summer_2026",
  "status": "draft"
}
```

---

### GET /campaigns/{id}

Chi tiết campaign và tiến độ hiện tại.

**Response 200:**
```json
{
  "id": "cmp_summer_2026",
  "name": "Chiến dịch Mùa hè 2026",
  "type": "team_goal",
  "status": "active",
  "period_start": "2026-06-01",
  "period_end": "2026-07-31",
  "reward_description": "Tiệc BBQ + 500k/người khi đạt",
  "config": { "goals": [ { "metric": "work_count", "target": 15000, "current": 9847 } ] }
}
```

---

### POST /campaigns/{id}/activate

Publish campaign từ `draft` → `active`.

**Điều kiện:** `period_start` chưa trôi qua, `reward_description` không rỗng, có ít nhất 1 goal/award được config.

**Response 200:**
```json
{
  "campaign_id": "cmp_summer_2026",
  "status": "active"
}
```

---

### POST /campaigns/{id}/complete

Đánh dấu campaign kết thúc. Bắt buộc có `ending_ritual_summary` — không được bỏ qua buổi tổng kết.

**Request:**
```json
{
  "ending_ritual_summary": "Đã tổ chức tổng kết ngày 1/8. Chia reward 500k/người cho 12 NV đạt mục tiêu."
}
```

**Response 200:**
```json
{
  "campaign_id": "cmp_summer_2026",
  "status": "completed"
}
```

Nếu `ending_ritual_summary` rỗng hoặc thiếu → 400.

---

### POST /campaigns/{id}/winners

Công bố người chiến thắng campaign `individual_awards`. Tự động tạo `campaign_reward` event cho mỗi winner.

**Request:**
```json
{
  "winners": [
    { "employee_external_id": "CRM_EMP_042", "award_name": "Nhân viên xuất sắc tháng" },
    { "employee_external_id": "CRM_EMP_055", "award_name": "Sáng kiến tiêu biểu" }
  ],
  "announced_by_external_id": "CRM_MGR_001"
}
```

**Response 200:**
```json
{
  "campaign_id": "cmp_summer_2026",
  "winners_count": 2,
  "generated_event_ids": ["evt_w001", "evt_w002"]
}
```

Các event được tạo có `category = campaign_reward`, `direction = positive`, `status = confirmed` (auto-confirmed vì đây là quyết định chủ động của admin, không cần review thêm).

---

## Bảng mã lỗi

Format chuẩn: `{ "error_code": "STRING_CODE", "message": "Mô tả bằng tiếng Việt", "details": {} }`

| error_code | HTTP | Mô tả |
|-----------|------|-------|
| `UNKNOWN_NODE_REF` | 422 | `external_ref` không map được criterion node nào trong active tree của department. Event được đẩy vào Dead Letter Queue |
| `UNKNOWN_EMPLOYEE` | 422 | `employee_external_id` không tìm thấy trong hệ thống |
| `UNKNOWN_REPORTER` | 422 | `reporter_external_id` không tìm thấy trong hệ thống |
| `DUPLICATE_EVENT` | 409 | `(external_id, source)` đã tồn tại nhưng có dị biệt dữ liệu — không thể resolve idempotently |
| `WEIGHT_SUM_ERROR` | 422 | Tổng weight của các node anh em không bằng 100%. `details: { node_id, parent_id, actual_sum }` |
| `EMPTY_TREE` | 422 | Cây không có node nào |
| `DEPTH_EXCEEDED` | 422 | Cây sâu hơn 4 cấp. `details: { max_depth_found }` |
| `TREE_NOT_DRAFT` | 422 | Chỉ sửa được tree ở trạng thái `draft` |
| `INVALID_EVAL_TYPE` | 422 | `eval_type` không nằm trong: `quantitative`, `qualitative_360`, `event`, `manual`, `ai` |
| `ALREADY_SCORED` | 409 | Qualitative score đã tồn tại cho cặp `(employee_id, period_id, criterion_node_id, evaluator_id)` |
| `PERIOD_CLOSED` | 422 | Eval period đã đóng (`closed` hoặc `finalized`), không nhận thêm data |
| `INVALID_CATEGORY` | 422 | `category` không nằm trong: `commendation`, `complaint`, `incident`, `initiative`, `campaign_reward` |
| `INVALID_SEVERITY` | 422 | `severity` không phải `light`, `normal`, hoặc `heavy` |
| `AI_HEAVY_SEVERITY` | 422 | Không thể auto-confirm sự vụ `severity = heavy` — luôn yêu cầu human review |

---

## Idempotency

| Resource | Idempotency key | Hành vi khi trùng |
|----------|----------------|-------------------|
| WorkLog | `(external_id, source)` | Trả 200 với record gốc |
| Event | `(external_id, source)` | Trả 200 với record gốc |
| AIEvaluation | `(external_id, source)` | Trả 200 với record gốc |
| QualitativeScore | `(employee_id, period_id, criterion_node_id, evaluator_id)` | Trả 409 `ALREADY_SCORED` |
| ManualScore | `(employee_id, period_id, criterion_node_id)` | Upsert — last write wins, trả 200 |

**Lưu ý:** Tất cả POST endpoints nhận `external_id` đều phải kiểm tra idempotency trước khi xử lý. CRM/ERP có thể retry an toàn khi gặp timeout — hệ thống không tạo duplicate.

---

## Tích hợp — Ai dùng gì

| Hệ thống | Endpoints |
|---------|-----------|
| CRM/ERP (fire-and-forget) | `POST /work-events`, `POST /events` |
| AI Engine | `POST /ai-evaluations`, `GET /ai-evaluations/pending` |
| Dashboard QL | `GET /ai-evaluations/pending`, `POST /ai-evaluations/{id}/confirm`, `POST /ai-evaluations/{id}/override`, `POST /ai-evaluations/{id}/discard`, `GET /events`, `POST /events/{id}/confirm` |
| Dashboard NV | `GET /scorecard`, `POST /qualitative-scores` (self-assessment) |
| Dashboard Admin | `POST /criterion-trees`, `POST /criterion-trees/{id}/nodes`, `POST /criterion-trees/{id}/publish`, `POST /eval-periods`, `POST /campaigns` |
| Frontend (read) | `GET /criterion-trees/{id}`, `GET /scorecard`, `GET /scorecard/department`, `GET /campaigns/{id}` |

---

## SLA & Monitoring

- **P99 latency:** < 200ms cho POST ingest endpoints, < 500ms cho GET scorecard
- **Availability:** 99.5% (cho phép downtime ~3 giờ/tháng)
- **Data retention:** giữ raw data ít nhất 3 năm (cho audit)
- **Alert khi:** DLQ tăng > 10 event/hour, 5xx > 1%/phút, AI evaluations pending > 48 giờ chưa review
- **Rate limit:** 100 req/s/API key mặc định. Header `Retry-After` trả về khi bị 429.

---

## Webhook ngược (future)

Evaluation System có thể gọi ngược CRM khi event thay đổi status (`pending` → `confirmed`).

```json
POST https://crm.company.vn/webhook/eval
{
  "event_type": "event_confirmed",
  "external_id": "CRM-COMPLAINT-2026-04-22-12",
  "new_status": "confirmed",
  "score_impact": -5
}
```

Chưa đặc tả trong v2 — thêm sau nếu có nhu cầu.
