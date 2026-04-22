# Data Model Specification

## Entity Relationship Overview

```
Department 1───N Employee
    │
    │ 1
    │
    ├──N Template 1───N Version 1───N Pillar 1───N Question
    │
    └──1 WorkCatalog 1───N WorkUnitType 1───N WorkLog N───1 Employee
                                                │
                                                │ 0..1
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
  id: string;                   // "p1", "p2", "p3" (trong context của version)
  type: "quantitative" | "qualitative" | "feedback";  // Cố định 3 loại
  weight: number;               // 0-100
  questions: Question[];
};
```

**Constraints:**
- Mỗi Version có **đúng 3 pillars**, mỗi loại 1
- `weight` là số nguyên 0-100
- Σ weight của 3 pillars = 100 (để publish được)

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
  id: string;                   // Internal ID: "wt_d1"
  code: string;                 // Stable code: "LAP_DH" — dùng trong API
  name: string;                 // "Lắp đặt điều hòa"
  points: number;               // Điểm công cơ bản, có thể là số thực (0.5, 1.5)
  note?: string;
  active: boolean;
};
```

**Constraints:**
- `(departmentId, code)` UNIQUE
- Code là stable identifier, không đổi. Muốn thay thế → mark `active = false`, tạo code mới.
- Điểm công có thể chỉnh (không làm invalidate Work Logs cũ — chúng vẫn giữ số điểm đã tính)

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

## Audit & History

Các entity sau cần **audit log** (không xóa, append-only):

- Event status change (pending → confirmed/disputed)
- Version publish
- Employee active/inactive
- API key create/revoke
- WorkUnitType points change (để theo dõi đã điều chỉnh bao giờ)

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

Khi chấm điểm cuối kỳ cho một nhân viên:

### Pillar 1 (Quantitative)

Với mỗi Question trong Pillar 1:

```
if type == "work_points":
    score = Σ pointsSnapshot của WorkLog (filter theo workTypeIds, completedAt trong kỳ)

if type == "work_count":
    score = Σ quantity của WorkLog (filter theo workTypeIds)

if type == "work_quality":
    score = (Σ quantity where status == "completed_ontime") / (Σ quantity total) × 100
```

### Pillar 2 (Qualitative)

Thu thập từ form 360° (phạm vi ngoài scope phần mềm này — có thể là Google Form). Mỗi câu hỏi `scale` trung bình điểm từ các người chấm.

Các chỉ số `scale` có `linkedEventCategories` có thể được **điều chỉnh** bởi điểm sự vụ tương ứng (VD: điểm "Chăm chỉ" bị trừ nếu có nhiều sự vụ `absence`).

### Pillar 3 (Feedback)

Với mỗi Question trong Pillar 3:

```
event_score = Σ severity_multiplier for events matching linkedEventCategories,
              where status = "confirmed" and occurredAt in period
              (positive categories cộng, negative categories trừ)

# Normalize về thang 0-100 của pillar
normalized = normalize(event_score)
```

### Tổng điểm

```
total = (pillar1_score × pillar1_weight
       + pillar2_score × pillar2_weight
       + pillar3_score × pillar3_weight) / 100
```

Xếp hạng từ total: A (≥85), B (70-84), C (55-69), D (<55) — threshold có thể chỉnh.

## Suggested Storage

- **Relational DB (Postgres/MySQL):** phù hợp cho tất cả entities trên
- **JSON column** cho `pillars` (embedded trong Version) và `unitTypes` (embedded trong WorkCatalog) — vì không query trực tiếp, chỉ cần lấy cả nested object
- **Indexes cần thiết:**
  - `Employee.externalId` UNIQUE
  - `WorkLog.externalId + source` UNIQUE nếu có
  - `WorkLog.employeeId + completedAt` (query theo NV + thời gian)
  - `Event.employeeId + occurredAt`
  - `Event.status`
- **Audit logs** có thể dùng table riêng hoặc service chuyên biệt (VD: events to Kafka)
