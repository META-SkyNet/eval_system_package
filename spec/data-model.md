# Data Model Specification

## Entity Relationship Overview

```
Organization
    │
    └──N PillarDefinition  (library dùng chung toàn tổ chức)
           │ referenced by
           ▼
Department 1───N Employee
    │
    │ 1
    │
    ├──N Template 1───N Version 1───N Pillar (ref PillarDefinition) 1───N Question
    │
    └──1 WorkCatalog 1───N WorkUnitType 1───N WorkLog N───1 Employee
                               │                  │
                               │ 0..1             │ 0..1
                               ▼                  ▼
                        EvaluationCriteria   AIEvaluation
                        (versioned, embedded)      │
                                                   │ 0..N
                                                   ▼
                                                Event N───1 Employee
```

## Entities

### Department

```typescript
type Department = {
  id: string;                   // "delivery", "warehouse", "warranty"
  code: string;                 // "DELIVERY" — uppercase stable code, dùng trong API
  name: string;                 // "Giao hàng"
  color?: string;               // Cho UI
  active: boolean;
};
```

**Notes:** Department code là stable identifier, phải đồng bộ giữa Evaluation System và CRM. Thay đổi department code là breaking change.

### Employee

```typescript
type Employee = {
  id: string;                   // Internal ID: "emp_nam"
  externalId: string;           // ID trong CRM: "CRM_EMP_042" — UNIQUE
  fullName: string;
  departmentId: string;         // FK → Department
  role: string;                 // "NV Giao hàng", "KTV Bảo hành"
  active: boolean;
  createdAt: ISO8601;
  updatedAt: ISO8601;
};
```

**Constraints:**
- `externalId` UNIQUE
- `(externalId)` là khoá dùng trong API calls từ CRM
- Khi NV nghỉ việc: `active = false`, không xoá record (giữ lịch sử)

### PillarDefinition (Standard Pillar Library)

Bộ định nghĩa trụ cột dùng chung toàn tổ chức. Template mỗi phòng *chọn* từ library này, không tự đặt tên mới.

```typescript
type PillarDefinition = {
  id: string;                    // "QUANTITATIVE", "QUALITY_360", "FEEDBACK", ...
  name: string;                  // "Kết quả định lượng"
  description: string;
  data_source: "quantitative"    // Tính từ work_logs
             | "qualitative_360" // Thu thập qua form 360°
             | "event_driven"    // Tính từ events confirmed
             | "manual";         // QL nhập trực tiếp mỗi kỳ

  default_weight: number;        // Gợi ý weight khi thêm vào template (0-100)
  allowed_question_types: QuestionType[];
  is_standard: boolean;          // true = thuộc bộ default 3 trụ cột
  active: boolean;
  created_by: string;            // "system" hoặc user ID (ai thêm vào library)
  created_at: ISO8601;
};
```

**Standard library (seed mặc định):**

| id | name | data_source | is_standard |
|----|------|-------------|-------------|
| `QUANTITATIVE` | Kết quả định lượng | `quantitative` | ✓ |
| `QUALITY_360` | Chất lượng & Thái độ | `qualitative_360` | ✓ |
| `FEEDBACK` | Phản hồi & Sự cố | `event_driven` | ✓ |
| `SKILL_MASTERY` | Năng lực chuyên môn | `qualitative_360` | |
| `COMPLIANCE` | Tuân thủ quy trình & An toàn | `event_driven` | |
| `LEARNING` | Đào tạo & Phát triển | `manual` | |
| `INNOVATION` | Sáng kiến & Cải tiến | `event_driven` | |

**Constraints:**
- Chỉ admin / HR có thể thêm PillarDefinition mới vào library
- Xoá pillar definition không được nếu đã có Version đang dùng nó
- `id` là stable identifier — không đổi một khi đã publish

---

### Template

```typescript
type Template = {
  id: string;
  departmentId: string;         // FK → Department
  name: string;
  description?: string;
  activeVersionId: string | null;  // FK → Version, có thể null khi chưa publish lần nào
  createdAt: ISO8601;
  updatedAt: ISO8601;
};
```

**Constraints:**
- `activeVersionId` phải trỏ đến một Version có `status = "published"` thuộc template này
- Có thể có nhiều template/phòng, nhưng thường chỉ 1-2

### Version

```typescript
type Version = {
  id: string;
  templateId: string;           // FK → Template
  versionNumber: string;        // "1.0", "2.0" — stable, monotonic increase
  status: "draft" | "published" | "archived";
  basedOn?: string;             // versionNumber của bản gốc nếu clone
  note?: string;
  pillars: Pillar[];            // Embedded, không tách table riêng
  createdAt: ISO8601;
  publishedAt?: ISO8601;
  archivedAt?: ISO8601;
};
```

**Constraints:**
- Chỉ một version có `status = "published"` mỗi template (= activeVersionId)
- Version đã publish/archived **immutable** (không được UPDATE pillars/questions)
- Tổng trọng số pillar phải = 100 để publish

### Pillar (embedded trong Version)

```typescript
type Pillar = {
  id: string;                        // "p1", "p2", ... (trong context của version)
  definition_id: string;             // FK → PillarDefinition.id ("QUANTITATIVE", ...)
  name_override?: string;            // Tùy chọn: đặt tên khác cho phòng này
  weight: number;                    // 0-100
  questions: Question[];
};
```

**Constraints:**
- Mỗi Version có **2–6 pillars**
- `definition_id` phải tồn tại trong PillarDefinition và `active = true`
- Không được có 2 pillar cùng `definition_id` trong một version
- `weight` là số nguyên 0-100
- Σ weight của tất cả pillars = 100 (để publish được)
- Default khi tạo template mới: 3 pillars — QUANTITATIVE (50) + QUALITY_360 (30) + FEEDBACK (20)

### Question (embedded trong Pillar)

```typescript
type Question = {
  id: string;
  label: string;
  type: "number" | "work_points" | "work_count" | "work_quality" | "scale" | "yesno" | "event";
  weight: number;               // 0-100 trong pillar

  // Cho type = "scale" | "yesno" | "event":
  linkedEventCategories?: string[];  // VD: ["customer_praise", "initiative"]

  // Cho type = "work_points" | "work_count" | "work_quality":
  workTypeIds?: string[] | null;     // null = tính trên tất cả loại
};
```

**Constraints:**
- Σ weight của questions trong 1 pillar nên = 100 (để UI hiển thị đẹp, nhưng không bắt buộc như pillar)
- `type = "work_count"` **bắt buộc** `workTypeIds` (khác null, có ít nhất 1 phần tử)

### WorkCatalog

```typescript
type WorkCatalog = {
  id: string;
  departmentId: string;         // FK → Department, UNIQUE (mỗi phòng 1 catalog)
  name: string;
  unitTypes: WorkUnitType[];    // Embedded
};
```

**Constraints:**
- Mỗi Department có **đúng 1 WorkCatalog**
- Xoá loại công việc không xoá Work Logs cũ — giữ để truy xuất lịch sử

### WorkUnitType (embedded)

```typescript
type WorkUnitType = {
  id: string;                        // Internal ID: "wt_d1"
  code: string;                      // Stable code: "LAP_DH" — dùng trong API
  name: string;                      // "Lắp đặt điều hòa"
  points: number;                    // Điểm công cơ bản, có thể là số thực (0.5, 1.5)
  note?: string;
  active: boolean;

  // MỚI: Criteria cho AI chấm điểm (optional)
  evaluation_criteria?: EvaluationCriteria | null;
};
```

**Constraints:**
- `(departmentId, code)` UNIQUE
- Code là stable identifier, không đổi. Muốn thay thế → mark `active = false`, tạo code mới.
- Điểm công có thể chỉnh (không làm invalidate Work Logs cũ — chúng vẫn giữ số điểm đã tính)
- `evaluation_criteria` là optional — WorkType không có criteria thì không áp dụng AI chấm

### EvaluationCriteria

Bộ tiêu chí AI chấm điểm gắn với một WorkUnitType. Có versioning riêng — thay đổi tiêu chí thì tạo version mới, không overwrite.

```typescript
type EvaluationCriteria = {
  version: string;                   // "1.0", "1.1", "2.0"
  status: "draft" | "active" | "archived";
  description_for_ai: string;        // Mô tả nghiệp vụ cho AI hiểu context
  input_schema: {
    required_fields: string[];       // Field bắt buộc phải có trong work_data JSON
    optional_fields: string[];
  };
  scoring_rules: ScoringRule[];
  red_flags: string[];               // Pattern bất thường cần alert riêng
  context_to_consider: string[];     // Sắc thái nghiệp vụ — ngoại lệ hợp lý
  created_at: ISO8601;
  created_by: string;                // User ID của người tạo
};

type ScoringRule = {
  rule_id: string;                   // Stable ID: "ontime", "quality", "price"
  description: string;               // Mô tả tiêu chí cho người đọc
  evaluation?: string;               // Hướng dẫn AI cách đọc fields
  scoring: {
    excellent?: string;              // "Điều kiện → +N điểm"
    good?: string;
    poor?: string;
  };
  auto_flag_event?: {
    condition: string;               // Mô tả condition bằng text
    creates_event: {
      category: EventCategory;
      severity: "light" | "medium" | "heavy";
    };
  };
};
```

**Constraints:**
- Chỉ 1 version có `status = "active"` mỗi WorkType
- Criteria `active` hoặc `archived` **không được sửa** (immutable)
- Thay đổi criteria → tạo version mới (clone, modify, publish)
- `version_history` lưu tất cả versions để biết NV đã chấm theo tiêu chí nào

### AIEvaluation (kết quả AI chấm)

Kết quả mỗi lần AI chấm một work_data, lưu để audit và QL review.

```typescript
type AIEvaluation = {
  id: string;
  work_log_id: string;               // FK → WorkLog (vừa tạo, status pending_review)
  work_type_code: string;
  criteria_version: string;          // Version criteria đã dùng để chấm
  employee_id: string;
  work_data_snapshot: object;        // JSON gốc từ hệ thống nghiệp vụ
  ai_result: {
    overall_assessment: "excellent" | "good" | "poor" | "insufficient_data";
    rule_scores: RuleScore[];
    detected_events: DetectedEvent[];
    red_flags_triggered: string[];
    confidence: number;              // 0-1, AI tự ước lượng
    reasoning: string;               // Giải thích ngắn của AI
  };
  status: "pending_review" | "confirmed" | "overridden" | "discarded";
  reviewed_by?: string;
  reviewed_at?: ISO8601;
  created_at: ISO8601;
};

type RuleScore = {
  rule_id: string;
  assessment: "excellent" | "good" | "poor" | "skipped";
  score_delta: number;               // +2, -1, 0, v.v.
  reasoning: string;
};

type DetectedEvent = {
  rule_id: string;
  category: EventCategory;
  severity: "light" | "medium" | "heavy";
  description: string;
  auto_created_event_id?: string;    // FK → Event nếu đã tạo
};
```

### WorkLog

```typescript
type WorkLog = {
  id: string;
  employeeId: string;           // FK → Employee
  workTypeId: string;           // FK → WorkUnitType
  quantity: number;             // Thường 1, có thể > 1 để gộp
  status: "completed_ontime" | "completed_late" | "completed_issue" | "failed";
  completedAt: ISO8601;
  note?: string;

  // Cho idempotency & tích hợp:
  externalId?: string;          // UNIQUE trong phạm vi source
  source?: string;              // "manual" | "crm" | "erp" | ...

  // Liên kết với sự vụ:
  relatedEventId?: string;

  // Snapshot điểm công tại thời điểm ghi (chống thay đổi ngược):
  pointsSnapshot?: number;      // Lưu points * quantity tại thời điểm tạo

  createdAt: ISO8601;
  updatedAt: ISO8601;
};
```

**Constraints:**
- `(externalId, source)` UNIQUE nếu cả hai đều có
- Khi CRM gọi lại với cùng `externalId + source` → UPDATE (idempotent)
- `pointsSnapshot` giữ lại điểm công tính ở thời điểm xảy ra — đảm bảo không bị "viết lại lịch sử" khi admin chỉnh `points` của WorkUnitType về sau

### Event (sự vụ)

```typescript
type Event = {
  id: string;
  employeeId: string;           // FK → Employee
  category: EventCategory;      // Xem bảng categories
  severity: "light" | "medium" | "heavy";
  source: "customer" | "internal" | "automatic";
  occurredAt: ISO8601;
  reportedBy: string;           // Tên người ghi nhận
  description: string;
  status: "pending" | "confirmed" | "disputed";

  confirmedAt?: ISO8601;
  confirmedBy?: string;

  // Liên kết:
  relatedWorkLogId?: string;    // FK → WorkLog

  // Cho tích hợp:
  externalId?: string;
  source_system?: string;       // "crm" | "erp" | null

  createdAt: ISO8601;
};

type EventCategory =
  | "customer_praise"
  | "customer_complaint"
  | "incident_damage"
  | "initiative"
  | "extra_effort"
  | "absence"
  | "teamwork"
  | "skill_issue";
```

**Constraints:**
- Event `status = pending` không tính vào điểm
- `status = disputed` tạm giữ, không tính cho đến khi resolve
- Chỉ `status = confirmed` được cộng vào điểm sự vụ

### Campaign

Sự kiện kích hoạt tinh thần theo dịp. Xem `docs/06-campaign-kich-hoat-tinh-than.md`.

```typescript
type Campaign = {
  id: string;
  name: string;                    // "Chiến dịch Mùa hè 2026"
  description: string;
  type: "team_goal" | "individual_awards" | "recognition_week" | "milestone_celebration" | "skill_challenge";
  status: "draft" | "active" | "completed" | "cancelled";

  period: {
    from: ISO8601;
    to: ISO8601;
  };

  scope: {
    departmentIds?: string[];      // null = toàn công ty
    employeeIds?: string[];        // null = tất cả trong scope
  };

  goals?: CampaignGoal[];          // Cho type = team_goal
  awards?: CampaignAward[];        // Cho type = individual_awards

  reward_description: string;
  reward_budget?: number;          // Chỉ tham khảo, không auto trả

  created_by: string;
  created_at: ISO8601;
  completed_at?: ISO8601;
  ending_ritual_done: boolean;     // Đảm bảo có tổng kết trước khi close
};

type CampaignGoal = {
  id: string;
  metric: "work_points" | "work_count" | "ontime_rate" | "event_count";
  workTypeIds?: string[];
  eventCategories?: string[];
  target: number;
  current?: number;                // Cache, cập nhật định kỳ
  last_calculated_at?: ISO8601;
};

type CampaignAward = {
  id: string;
  title: string;                   // "Người giúp đỡ nhiều nhất"
  criteria: string;                // Mô tả cách chấm
  metric_source: "peer_recognition" | "improvement" | "customer_praise" | "consistency" | "manual";
  winners?: string[];              // Điền cuối kỳ
};
```

**Constraints:**
- Campaign không tự động ảnh hưởng đến lương — reward tách biệt, chi trả thủ công
- `ending_ritual_done = false` khi status chuyển sang `completed` → cảnh báo admin phải có tổng kết
- Campaign reward tạo sự vụ (event) tích cực tương ứng để ghi vào hồ sơ NV (xem business rules)
- Gap giữa 2 campaigns cùng scope nên ≥ 4 tuần (soft warning, không hard block)

### PeerRecognition

Lời cảm ơn giữa đồng nghiệp. Thường dùng trong Recognition Week campaign, có thể mở rộng dùng hàng ngày.

```typescript
type PeerRecognition = {
  id: string;
  from_employee_id: string;        // Người gửi
  to_employee_id: string;          // Người nhận
  reason: string;                  // Min 20 ký tự, bắt buộc cụ thể
  campaign_id?: string;            // Nếu thuộc campaign

  created_at: ISO8601;

  // Tự động tạo event teamwork khi recognition được gửi:
  generated_event_id?: string;     // FK → Event
};
```

**Constraints:**
- `from_employee_id != to_employee_id` (không tự cảm ơn mình)
- Trong một Recognition Week campaign, có giới hạn N lời cảm ơn/người (mặc định 5)
- `reason.length >= 20` — ép buộc lý do cụ thể, chống spam
- Auto-generate Event với category `teamwork`, severity `light`, status `confirmed`, source `internal`

## Audit & History

Các entity sau cần **audit log** (không xóa, append-only):

- Event status change (pending → confirmed/disputed)
- Version publish
- Employee active/inactive
- API key create/revoke
- WorkUnitType points change (để theo dõi đã điều chỉnh bao giờ)
- Campaign create / publish / complete
- PeerRecognition create (chống spam, detect fake patterns)

Schema gợi ý:

```typescript
type AuditLog = {
  id: string;
  entity: string;               // "event", "version", ...
  entityId: string;
  action: string;               // "created", "status_changed", ...
  before?: object;
  after?: object;
  actor: string;                // User ID hoặc "system"
  timestamp: ISO8601;
};
```

## Scoring Calculation

Khi chấm điểm cuối kỳ cho một nhân viên, hệ thống duyệt qua tất cả pillars của version đang active. Mỗi pillar tính điểm theo `data_source` của `PillarDefinition` tương ứng.

### Pillar data_source = "quantitative"

Với mỗi Question trong pillar:

```
if type == "work_points":
    score = Σ pointsSnapshot của WorkLog (filter theo workTypeIds, completedAt trong kỳ)

if type == "work_count":
    score = Σ quantity của WorkLog (filter theo workTypeIds)

if type == "work_quality":
    score = (Σ quantity where status == "completed_ontime") / (Σ quantity total) × 100
```

### Pillar data_source = "qualitative_360"

Thu thập từ bảng `qualitative_scores` (form 360° — có thể là Google Form hoặc form nội bộ). Mỗi question lấy **trung bình điểm** từ tất cả evaluators trong kỳ, sau đó normalize về thang 0-100:

```
avg_score = mean(qualitative_scores where question_id = Q and period overlaps)
normalized = avg_score / 10 × 100   # thang gốc 0-10 → 0-100
```

Câu hỏi `scale` có `linkedEventCategories` có thể được **điều chỉnh** bởi sự vụ tương ứng (VD: điểm "Chuyên cần" bị trừ nếu có nhiều event `absence` confirmed).

### Pillar data_source = "event_driven"

Với mỗi Question trong pillar:

```
net_score = Σ (polarity × severity_multiplier) for confirmed events
              matching linkedEventCategories, occurredAt in period

# Normalize về 0-100 bằng công thức clamp tuyến tính:
# Baseline = 50 (trung lập), mỗi đơn net_score = ±5 điểm, clamped [0, 100]
normalized = clamp(50 + net_score × 5, 0, 100)
```

*Ví dụ:* net_score = +2 → 60 điểm; net_score = −4 → 30 điểm; net_score ≥ +10 → 100 điểm.

Hệ số `5` và baseline `50` là **configurable** mỗi org (xem business-rules.md §4).

### Pillar data_source = "manual"

QL nhập điểm trực tiếp vào bảng `qualitative_scores` với `evaluator_role = "manager"` mỗi kỳ đánh giá. Không có tính toán tự động.

### Tổng điểm (N pillars)

```
pillar_scores = []
for pillar in version.pillars:
    pillar_score = calculate_pillar(pillar, period)   # theo data_source ở trên
    pillar_scores.append(pillar_score × pillar.weight)

total = Σ pillar_scores / 100
```

Xếp hạng từ total: A (≥85), B (70–84), C (55–69), D (<55) — threshold có thể chỉnh theo org.

## Suggested Storage

- **Relational DB (Postgres/MySQL):** phù hợp cho tất cả entities trên
- **JSON column** cho `pillars` (embedded trong Version) và `unitTypes` (embedded trong WorkCatalog) — vì không query trực tiếp, chỉ cần lấy cả nested object
- **Indexes cần thiết:**
  - `Employee.externalId` UNIQUE
  - `WorkLog.externalId + source` UNIQUE nếu có
  - `WorkLog.employeeId + completedAt` (query theo NV + thời gian)
  - `Event.employeeId + occurredAt`
  - `Event.status`
  - `Campaign.status + period.from` (query active campaigns)
  - `PeerRecognition.to_employee_id + created_at` (xem ai đang được cảm ơn)
  - `PeerRecognition.from_employee_id + campaign_id` (enforce quota trong campaign)
- **Audit logs** có thể dùng table riêng hoặc service chuyên biệt (VD: events to Kafka)
