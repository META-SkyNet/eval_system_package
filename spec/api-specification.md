# API Specification v1

Base URL: `https://eval.company.vn/api/v1`

## Authentication

Mọi request phải có 3 headers:

```
X-API-Key: evk_live_...
X-Timestamp: 1714400000
X-Signature: sha256-hex-...
```

**HMAC signature:** `HMAC-SHA256(secret, timestamp + "." + raw_body)`

**Timestamp:** Unix epoch seconds. Reject nếu lệch server > 5 phút.

**Content-Type:** `application/json` cho mọi POST request.

## Chuẩn lỗi chung

```json
{
  "ok": false,
  "error_code": "STRING_CODE",
  "error": "Human-readable message",
  "field": "fieldname (optional)"
}
```

**HTTP status codes:**
- `200 OK` — Thành công, không tạo mới (GET, upsert existing)
- `201 Created` — Tạo mới thành công
- `400 Bad Request` — Lỗi validation payload (thiếu field, sai format)
- `401 Unauthorized` — Sai API key hoặc signature
- `403 Forbidden` — API key không có quyền cho endpoint này
- `409 Conflict` — Race condition, trùng lặp không giải quyết được
- `422 Unprocessable Entity` — Payload hợp lệ nhưng business rule sai (VD: job_code không tồn tại)
- `429 Too Many Requests` — Rate limit
- `500 Internal Server Error` — Server lỗi, có thể retry

**Rate limit:** 100 req/s/API key mặc định. Có thể tăng theo nhu cầu.

---

## Endpoint 1: POST /work-events

Báo công việc hoàn thành hoặc thay đổi trạng thái.

### Request

```json
POST /api/v1/work-events
Headers: X-API-Key, X-Timestamp, X-Signature
Body:
{
  "external_id": "CRM-ORD-2026-04-22-8847",
  "event_type": "work_completed",
  "job_code": "LAP_DH",
  "employee_external_id": "CRM_EMP_042",
  "quantity": 1,
  "status": "completed_ontime",
  "completed_at": "2026-04-22T14:30:00Z",
  "metadata": {
    "order_id": "ORD-8847",
    "customer_district": "Cầu Giấy",
    "note": "Khách yêu cầu lắp thêm van khóa"
  }
}
```

### Fields

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `external_id` | ✓ | string | Unique, dùng cho idempotency. Format tuỳ CRM. |
| `event_type` | ✓ | enum | `work_completed`, `work_updated`, `work_cancelled` |
| `job_code` | ✓ | string | Phải có trong WorkCatalog của phòng NV (VD: "LAP_DH") |
| `employee_external_id` | ✓ | string | Phải đã được map qua `/employee-mapping` |
| `quantity` | ✓ | number > 0 | Thường là 1 |
| `status` | ✓ | enum | `completed_ontime`, `completed_late`, `completed_issue`, `failed` |
| `completed_at` | ✓ | ISO8601 | UTC |
| `metadata` | | object | Tuỳ ý — không dùng cho scoring, chỉ lưu để debug |

### Response thành công (201)

```json
{
  "ok": true,
  "work_log_id": "wl_5f3a2b",
  "action": "created",
  "points_calculated": 10
}
```

### Response idempotent (200)

Nếu `external_id` đã tồn tại, UPDATE và trả về:

```json
{
  "ok": true,
  "work_log_id": "wl_5f3a2b",
  "action": "updated",
  "points_calculated": 10
}
```

### Response lỗi

**400 — MISSING_EXTERNAL_ID:**
```json
{ "ok": false, "error_code": "MISSING_EXTERNAL_ID", "error": "external_id là bắt buộc để tránh trùng", "field": "external_id" }
```

**422 — UNKNOWN_JOB_CODE** (→ đẩy vào Dead Letter Queue):
```json
{ "ok": false, "error_code": "UNKNOWN_JOB_CODE", "error": "job_code 'LAP_CUSTOM_XYZ' không có trong catalog Giao hàng" }
```

**400 — EMPLOYEE_NOT_MAPPED:**
```json
{ "ok": false, "error_code": "EMPLOYEE_NOT_MAPPED", "error": "employee_external_id 'CRM_EMP_999' chưa được map. Gọi /employee-mapping trước." }
```

---

## Endpoint 2: POST /incidents

Báo sự vụ / sự cố.

### Request

```json
POST /api/v1/incidents
Body:
{
  "external_id": "CRM-COMPLAINT-2026-04-22-12",
  "category": "customer_complaint",
  "severity": "heavy",
  "employee_external_id": "CRM_EMP_042",
  "source": "customer",
  "occurred_at": "2026-04-22T15:00:00Z",
  "reported_by": "CSKH - Nguyễn Thị X",
  "description": "Khách phản ánh giao muộn 3 tiếng",
  "related_work_external_id": "CRM-ORD-2026-04-22-8847"
}
```

### Fields

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `external_id` | ✓ | string | Unique, idempotency |
| `category` | ✓ | enum | 8 loại — xem danh sách bên dưới |
| `severity` | ✓ | enum | `light`, `medium`, `heavy` |
| `employee_external_id` | ✓ | string | Phải đã map |
| `source` | ✓ | enum | `customer`, `internal`, `automatic` |
| `occurred_at` | ✓ | ISO8601 | |
| `reported_by` | ✓ | string | Tên người ghi nhận, không ẩn danh |
| `description` | ✓ | string | Min 10 ký tự |
| `related_work_external_id` | | string | Tuỳ chọn, gắn với work log nếu có |

### Categories

- `customer_praise` (+)
- `customer_complaint` (−)
- `incident_damage` (−)
- `initiative` (+)
- `extra_effort` (+)
- `absence` (−)
- `teamwork` (+)
- `skill_issue` (−)

### Response (201)

```json
{
  "ok": true,
  "event_id": "evt_8a9c",
  "initial_status": "pending",
  "linked_to_work_log": "wl_5f3a2b"
}
```

**Lưu ý:** Sự vụ mới tạo luôn ở status `pending` — phải được admin/QL xác nhận thủ công trước khi tính điểm. Đây là cơ chế chống vu khống.

---

## Endpoint 3: POST /employee-mapping

Đồng bộ map nhân viên CRM ↔ Evaluation.

### Request

```json
POST /api/v1/employee-mapping
Body:
{
  "employee_external_id": "CRM_EMP_042",
  "full_name": "Nguyễn Văn Nam",
  "department_code": "DELIVERY",
  "role": "NV Lắp đặt",
  "active": true
}
```

### Fields

| Field | Required | Type | Ghi chú |
|-------|----------|------|---------|
| `employee_external_id` | ✓ | string | Unique key |
| `full_name` | ✓ | string | |
| `department_code` | ✓ | string | Phải match với Department.code trong Evaluation |
| `role` | ✓ | string | Free text |
| `active` | ✓ | bool | `false` = NV nghỉ việc (không xoá) |

### Response

**201 (tạo mới):**
```json
{
  "ok": true,
  "internal_id": "emp_a7f3",
  "action": "created"
}
```

**200 (cập nhật existing):**
```json
{
  "ok": true,
  "internal_id": "emp_a7f3",
  "action": "updated"
}
```

### Bulk variant (tuỳ chọn)

Cho migration ban đầu:

```json
POST /api/v1/employee-mapping/bulk
Body:
{
  "employees": [
    { "employee_external_id": "...", ... },
    { "employee_external_id": "...", ... }
  ]
}

Response:
{
  "ok": true,
  "processed": 150,
  "created": 145,
  "updated": 5,
  "errors": []
}
```

---

## Endpoint 4: GET /employees/{employee_external_id}/scorecard

CRM lấy bảng điểm để hiển thị.

### Request

```
GET /api/v1/employees/CRM_EMP_042/scorecard?period_from=2026-04-01&period_to=2026-04-30
Headers: X-API-Key, X-Timestamp, X-Signature
```

### Query params

| Param | Default | Ghi chú |
|-------|---------|---------|
| `period_from` | đầu tháng hiện tại | ISO date |
| `period_to` | hôm nay | ISO date |

### Response (200)

```json
{
  "ok": true,
  "employee_external_id": "CRM_EMP_042",
  "full_name": "Nguyễn Văn Nam",
  "department": "DELIVERY",
  "period": {
    "from": "2026-04-01",
    "to": "2026-04-30"
  },
  "work_points": {
    "total": 87.5,
    "ontime_rate": 94,
    "total_work_logs": 23,
    "breakdown": [
      { "job_code": "LAP_DH", "qty": 8, "points": 80 },
      { "job_code": "GIAO_NHO", "qty": 15, "points": 15 }
    ]
  },
  "events": {
    "total": 4,
    "positive": 3,
    "negative": 1,
    "net_score": 4,
    "breakdown": [
      { "category": "customer_praise", "count": 2, "weight": 3 },
      { "category": "initiative", "count": 1, "weight": 1 },
      { "category": "customer_complaint", "count": 1, "weight": -2 }
    ]
  },
  "scoring": {
    "pillar_1_score": 85,
    "pillar_2_score": null,
    "pillar_2_note": "Chưa chấm 360° cho kỳ này",
    "pillar_3_score": 78,
    "total_score": null,
    "rank": null,
    "completeness": "partial"
  },
  "generated_at": "2026-04-22T10:00:00Z",
  "cache_ttl_seconds": 300
}
```

### Caching

Server cache 5 phút. Gọi nhiều lần trong 5 phút trả về cùng snapshot. `cache_ttl_seconds` cho biết khi nào cache hết hạn.

---

## Webhook ngược (tuỳ chọn, future)

Evaluation System có thể gọi ngược CRM khi event thay đổi status (pending → confirmed) — nếu CRM cần biết.

```json
POST https://crm.company.vn/webhook/eval
{
  "event_type": "incident_confirmed",
  "external_id": "CRM-COMPLAINT-2026-04-22-12",
  "new_status": "confirmed",
  "confirmed_by": "QL Giao hàng"
}
```

Chưa đặc tả trong v1 — thêm sau nếu có nhu cầu.

---

## Testing

Xem artifact `artifacts/api_integration_design.jsx` — có playground đầy đủ để test payload trước khi implement.

## SLA & Monitoring gợi ý

- **P99 latency:** < 200ms cho POST endpoints, < 500ms cho GET scorecard
- **Availability:** 99.5% (cho phép downtime ~3 giờ/tháng)
- **Data retention:** giữ raw events ít nhất 3 năm (cho audit)
- **Alert khi:** DLQ tăng > 10 event/hour, 5xx > 1%/phút
