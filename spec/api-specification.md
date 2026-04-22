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

## Nhóm endpoints nội bộ: Campaigns

Các endpoints này chủ yếu **nội bộ** (dùng bởi dashboard admin/NV), không phải từ CRM/ERP. Vẫn cần HMAC auth nhưng với API key loại "internal".

### POST /api/v1/campaigns

Tạo campaign mới (chỉ admin/manager).

**Request:**
```json
{
  "name": "Chiến dịch Mùa hè 2026",
  "description": "Vượt qua cao điểm nắng nóng cùng nhau",
  "type": "team_goal",
  "period": {
    "from": "2026-06-01",
    "to": "2026-07-31"
  },
  "scope": {
    "departmentIds": ["delivery"]
  },
  "goals": [
    {
      "metric": "work_count",
      "workTypeIds": null,
      "target": 15000
    },
    {
      "metric": "ontime_rate",
      "target": 88
    }
  ],
  "reward_description": "Tiệc BBQ + 500k/người khi đạt. Vượt 110% thêm 1 ngày nghỉ mát.",
  "reward_budget": 20000000
}
```

**Response (201):**
```json
{
  "ok": true,
  "campaign_id": "cmp_summer_2026",
  "status": "draft"
}
```

**Lưu ý:**
- Campaign tạo ra ở status `draft`, phải publish để active
- Scope rỗng = toàn công ty (cần permission cao hơn để tạo)

### POST /api/v1/campaigns/{id}/publish

Publish campaign từ draft → active.

**Điều kiện publish:**
- Có ít nhất 1 goal (nếu type = team_goal) hoặc award (nếu type = individual_awards)
- `period.from` chưa trôi qua
- `reward_description` không rỗng
- Soft warning nếu có campaign cùng scope active trong 4 tuần qua

### GET /api/v1/campaigns/active

Lấy danh sách campaign đang active cho widget dashboard.

**Query params:**
- `employee_external_id` (optional) — chỉ trả về campaign NV này thuộc scope

**Response:**
```json
{
  "ok": true,
  "campaigns": [
    {
      "id": "cmp_summer_2026",
      "name": "Chiến dịch Mùa hè 2026",
      "type": "team_goal",
      "period": { "from": "2026-06-01", "to": "2026-07-31" },
      "days_remaining": 12
    }
  ]
}
```

### GET /api/v1/campaigns/{id}/progress

Lấy tiến độ campaign (cho widget và dashboard).

**Response:**
```json
{
  "ok": true,
  "campaign_id": "cmp_summer_2026",
  "name": "Chiến dịch Mùa hè 2026",
  "period": { "from": "2026-06-01", "to": "2026-07-31" },
  "days_remaining": 12,
  "status": "active",
  "goals": [
    {
      "metric": "work_count",
      "target": 15000,
      "current": 9847,
      "progress_percent": 65.6,
      "on_track": true,
      "pace_message": "Đang đúng tiến độ"
    },
    {
      "metric": "ontime_rate",
      "target": 88,
      "current": 91.2,
      "progress_percent": 103.6,
      "on_track": true,
      "pace_message": "Đang vượt target"
    }
  ],
  "overall_status": "on_track",
  "encouragement": "Đội đang vượt target, cố gắng duy trì!"
}
```

**Caching:** 15 phút server-side.

### POST /api/v1/campaigns/{id}/complete

Đánh dấu campaign kết thúc.

**Request:**
```json
{
  "ending_ritual_done": true,
  "notes": "Đã tổ chức tiệc BBQ ngày 1/8. Chia reward 500k/người cho 12 NV đạt.",
  "winners": ["emp_nam", "emp_cuong"]  // Nếu type = individual_awards
}
```

**Response:**
```json
{
  "ok": true,
  "generated_events": 12,
  "message": "Đã tạo 12 sự vụ teamwork/initiative cho NV đoạt giải"
}
```

**Hành vi:**
- Nếu `ending_ritual_done = false` → trả 400, campaign không được complete (buộc admin phải tổng kết trước)
- Auto-generate events positive cho winners để ghi vào hồ sơ NV

### POST /api/v1/peer-recognitions

Gửi lời cảm ơn đồng nghiệp.

**Request:**
```json
{
  "to_employee_external_id": "CRM_EMP_042",
  "reason": "Cảm ơn anh đã giúp tôi lắp máy điều hòa cho khách khó tính hôm thứ ba, anh rất kiên nhẫn giải thích.",
  "campaign_id": "cmp_recognition_week_q2"
}
```

**Response (201):**
```json
{
  "ok": true,
  "recognition_id": "pr_8a7b",
  "generated_event_id": "evt_9c2d",
  "remaining_quota_in_campaign": 3
}
```

**Validation:**
- `reason.length >= 20` — ép buộc lý do cụ thể
- Nếu trong campaign Recognition Week: check quota (mặc định 5/người)
- `from` và `to` khác nhau
- Auto-generate Event với category `teamwork`, status `confirmed`

### GET /api/v1/employees/{external_id}/recognitions

Lấy lời cảm ơn NV đã nhận (cho dashboard cá nhân).

**Query params:**
- `period_from`, `period_to` (optional)
- `campaign_id` (optional)

**Response:**
```json
{
  "ok": true,
  "employee_external_id": "CRM_EMP_042",
  "total": 7,
  "recognitions": [
    {
      "from": "Phạm Thị Hoa",
      "reason": "Cảm ơn anh đã giúp tôi lắp máy...",
      "created_at": "2026-06-15T10:23:00Z",
      "campaign_name": "Tuần lễ ghi nhận Q2 2026"
    }
  ]
}
```

---

---

## Nhóm endpoints: AI Evaluation

Các endpoints để hệ thống nghiệp vụ (CRM, ERP, Chat Agent) đẩy dữ liệu công việc sang để AI chấm điểm. Kết quả luôn ở `pending` — QL phải review trước khi tính điểm.

### POST /api/v1/ai-evaluations

Đẩy dữ liệu một công việc để AI chấm dựa trên criteria của WorkType.

**Request:**
```json
{
  "work_type_code": "CHAT_SESSION",
  "employee_external_id": "CRM_EMP_042",
  "work_data": {
    "conversation_id": "chat_8847",
    "agent_id": "CRM_EMP_042",
    "messages": [...],
    "duration_minutes": 14,
    "resolved": true,
    "customer_sentiment_end": "neutral"
  },
  "occurred_at": "2026-04-22T14:30:00Z",
  "external_id": "CHAT-2026-04-22-8847",
  "source": "crm"
}
```

**Fields:**

| Field | Required | Ghi chú |
|-------|----------|---------|
| `work_type_code` | ✓ | Phải có criteria active |
| `employee_external_id` | ✓ | Phải đã map |
| `work_data` | ✓ | JSON của công việc — phải có đủ required_fields theo criteria |
| `occurred_at` | ✓ | Thời điểm công việc xảy ra |
| `external_id` | ✓ | Dùng cho idempotency |
| `source` | ✓ | "crm", "erp", "chat_agent", v.v. |

**Response thành công (201):**
```json
{
  "ok": true,
  "ai_evaluation_id": "aiev_7c3f",
  "work_log_id": "wl_5f3a2b",
  "status": "pending_review",
  "ai_result": {
    "overall_assessment": "good",
    "rule_scores": [
      {
        "rule_id": "response_time",
        "assessment": "good",
        "score_delta": 0,
        "reasoning": "Phản hồi sau 4 phút, trong ngưỡng good"
      },
      {
        "rule_id": "tone",
        "assessment": "excellent",
        "score_delta": 2,
        "reasoning": "Agent gọi tên khách, xin lỗi đúng chỗ, không viết tắt"
      },
      {
        "rule_id": "resolution",
        "assessment": "excellent",
        "score_delta": 3,
        "reasoning": "Giải quyết hoàn toàn trong 1 phiên, khách xác nhận hài lòng"
      }
    ],
    "detected_events": [],
    "red_flags_triggered": [],
    "confidence": 0.87,
    "reasoning": "Phiên chat đạt chất lượng tốt. Điểm mạnh: thái độ và kết quả. Không có điểm cần cải thiện rõ ràng."
  }
}
```

**Response khi thiếu dữ liệu (422 — INSUFFICIENT_DATA):**
```json
{
  "ok": false,
  "error_code": "INSUFFICIENT_DATA",
  "error": "work_data thiếu field bắt buộc: messages, conversation_id",
  "missing_fields": ["messages", "conversation_id"]
}
```

**Response khi WorkType không có criteria (422 — NO_CRITERIA):**
```json
{
  "ok": false,
  "error_code": "NO_CRITERIA",
  "error": "WorkType 'LAP_DH' chưa có evaluation criteria. Tạo criteria trước."
}
```

---

### GET /api/v1/ai-evaluations/{id}

Xem chi tiết kết quả AI chấm (để QL review).

**Response:**
```json
{
  "ok": true,
  "id": "aiev_7c3f",
  "work_log_id": "wl_5f3a2b",
  "employee_external_id": "CRM_EMP_042",
  "work_type_code": "CHAT_SESSION",
  "criteria_version": "1.0",
  "status": "pending_review",
  "ai_result": { ... },
  "created_at": "2026-04-22T14:35:00Z"
}
```

---

### POST /api/v1/ai-evaluations/{id}/confirm

QL xác nhận kết quả AI — WorkLog và Events chuyển sang `confirmed`.

**Request:**
```json
{
  "action": "confirm",
  "note": "Đồng ý với đánh giá của AI"
}
```

**Response:**
```json
{
  "ok": true,
  "work_log_id": "wl_5f3a2b",
  "events_confirmed": 0,
  "points_applied": 5
}
```

---

### POST /api/v1/ai-evaluations/{id}/override

QL không đồng ý, ghi đè kết quả AI.

**Request:**
```json
{
  "action": "override",
  "override_assessment": "excellent",
  "override_reason": "AI không biết context: khách này là VIP, phải xử lý ưu tiên, cần thêm thời gian",
  "manual_rule_scores": [
    { "rule_id": "resolution", "assessment": "excellent", "score_delta": 3 }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "work_log_id": "wl_5f3a2b",
  "overridden_by": "ql_delivery",
  "points_applied": 8
}
```

---

### GET /api/v1/ai-evaluations/pending

Lấy danh sách kết quả AI đang chờ review (cho QL dashboard).

**Query params:**
- `department_code` (optional)
- `work_type_code` (optional)
- `limit` (default 50)

**Response:**
```json
{
  "ok": true,
  "total_pending": 12,
  "evaluations": [
    {
      "id": "aiev_7c3f",
      "employee_name": "Nguyễn Văn Nam",
      "work_type": "CHAT_SESSION",
      "overall_assessment": "good",
      "red_flags": 0,
      "occurred_at": "2026-04-22T14:30:00Z",
      "created_at": "2026-04-22T14:35:00Z"
    }
  ]
}
```

---

### Nhóm endpoints: Criteria Management (internal/admin)

#### GET /api/v1/work-types/{code}/criteria

Lấy criteria hiện tại của một WorkType.

**Response:**
```json
{
  "ok": true,
  "work_type_code": "CHAT_SESSION",
  "active_version": "1.0",
  "criteria": { ... }
}
```

#### POST /api/v1/work-types/{code}/criteria

Tạo criteria mới (draft) hoặc publish version mới.

**Request:**
```json
{
  "action": "create_draft",
  "criteria": {
    "description_for_ai": "...",
    "input_schema": { ... },
    "scoring_rules": [ ... ],
    "red_flags": [ ... ],
    "context_to_consider": [ ... ]
  }
}
```

**action values:**
- `"create_draft"` — tạo draft version mới
- `"publish"` — publish draft → active (version cũ tự archive)

---

## Testing

Xem artifact `artifacts/api_integration_design.jsx` — có playground đầy đủ để test payload trước khi implement.

## SLA & Monitoring gợi ý

- **P99 latency:** < 200ms cho POST endpoints, < 500ms cho GET scorecard
- **Availability:** 99.5% (cho phép downtime ~3 giờ/tháng)
- **Data retention:** giữ raw events ít nhất 3 năm (cho audit)
- **Alert khi:** DLQ tăng > 10 event/hour, 5xx > 1%/phút
