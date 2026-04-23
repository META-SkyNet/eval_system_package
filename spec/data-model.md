# Data Model Specification

## Entity Relationship Overview

```
Organization
    │
    └──N PresetLibrary  (thư viện tiêu chí mẫu — tuỳ chọn, không bắt buộc)
           │ "copy from preset"
           ▼
Department 1───N Employee
    │
    │ 1
    │
    └──N CriterionTree (versioned)
           │
           └──N CriterionNode (recursive: folder hoặc leaf)
                  │
                  ├── is_leaf=false → Folder (aggregates children)
                  └── is_leaf=true  → Leaf (measurement source)
                         │
                         ├── eval_type=quantitative → WorkLog N───1 Employee
                         ├── eval_type=event        → Event N───1 Employee
                         ├── eval_type=qualitative_360 → QualitativeScore
                         ├── eval_type=manual       → ManualScore
                         └── eval_type=ai           → AIEvaluation
```

## Khái niệm cốt lõi: mô hình file/folder

CriterionTree của một phòng giống hệt một cây thư mục:

```
Giao hàng
└── Folder: Kết quả (weight 50%)
      ├── Leaf: Số đơn giao (weight 60% | eval_type: quantitative)
      └── Leaf: Tỷ lệ đúng hạn (weight 40% | eval_type: quantitative)
└── Folder: Chất lượng (weight 30%)
      ├── Leaf: Phản hồi khách (weight 50% | eval_type: event)
      └── Folder: Đánh giá 360 (weight 50%)
            ├── Leaf: QL chấm (weight 70% | eval_type: qualitative_360)
            └── Leaf: Đồng nghiệp (weight 30% | eval_type: qualitative_360)
└── Leaf: Tuân thủ (weight 20% | eval_type: manual)
```

Quy tắc:
- `is_leaf = false` → Folder: chỉ tổng hợp điểm con theo trọng số, không có eval_type
- `is_leaf = true` → Leaf: nguồn đo lường thực sự, phải có eval_type
- `weight` = % so với các node cùng cha (siblings phải cộng lại = 100%)
- Root nodes: nodes không có parent_id, siblings của nhau trong cùng tree

---

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
  id: string;                   // Internal ID
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

---

### CriterionTree

Cây tiêu chí đánh giá của một phòng. Có versioning — mỗi thay đổi tạo version mới, không sửa version đang active.

```typescript
type CriterionTree = {
  id: string;
  departmentId: string;         // FK → Department
  version: number;              // 1, 2, 3, ... monotonic
  status: "draft" | "active" | "archived";
  activatedAt?: ISO8601;        // Thời điểm chuyển sang active
  calibrationNotes?: string;    // Ghi chú thay đổi so với version trước (cho audit)
  createdBy: string;            // FK → Employee
  createdAt: ISO8601;
};
```

**Constraints:**
- `(departmentId, version)` UNIQUE
- Chỉ 1 tree có `status = "active"` mỗi phòng
- Tree với status `active` hoặc `archived` **immutable** — không sửa nodes
- Muốn thay đổi → clone tree, tạo draft mới, publish

### CriterionNode

Node trong cây — có thể là folder (nhóm) hoặc leaf (tiêu chí đo thực sự).

```typescript
type CriterionNode = {
  id: string;
  treeId: string;               // FK → CriterionTree
  parentId: string | null;      // null = root node
  name: string;                 // "Kết quả", "Số đơn giao", ...
  weight: number;               // % so với siblings (0 < weight <= 100)
  isLeaf: boolean;
  evalType:
    | null                      // nếu isLeaf = false (folder)
    | "quantitative"            // tính từ work_logs
    | "qualitative_360"         // thu thập qua form 360°
    | "event"                   // tính từ events confirmed
    | "manual"                  // QL nhập trực tiếp
    | "ai";                     // AI chấm từ input_data JSON
  description?: string;         // Mô tả cho người dùng — không dùng để tính điểm
  scoringConfig?: ScoringConfig; // Chỉ dùng khi evalType = "quantitative"
  sortOrder: number;            // Thứ tự hiển thị trong cùng cha
  externalRef?: string;         // Tag tuỳ chọn để map với CRM/ERP field
  createdAt: ISO8601;
};

type ScoringConfig = {
  formula: "target_based" | "ratio" | "passthrough";
  // target_based : volume_score = clamp(Σ điểm_công / target_points × 100, floor, cap)
  // ratio        : volume_score = Σ(score × điểm_công) / Σ điểm_công  (logs phải có score)
  // passthrough  : volume_score = score của WorkLog cuối kỳ (CRM tự tính gửi 1 lần)

  base_unit_points: number;     // Điểm công mặc định mỗi đơn vị (default: 1)
  target_points: number;        // Mục tiêu điểm công/kỳ (VD: 200)
  unit: string;                 // Đơn vị hiển thị: "chuyến", "pallet", "ticket"

  cap: number;                  // Điểm tối đa (default: 100)
  floor: number;                // Điểm tối thiểu (default: 0)

  no_data_policy: "zero" | "exclude" | "neutral";
  // zero    : không làm = 0 điểm (tiêu chí bắt buộc)
  // exclude : loại khỏi tính toán, phân bổ lại weight cho anh em
  // neutral : 50 điểm (không phạt, không thưởng)

  quality_weight: number;       // 0–100: % điểm lá từ quality vs. volume
  // 0  = thuần volume (chỉ đếm điểm công)
  // 30 = 70% volume + 30% quality (trung bình điểm từng WorkLog)
  // 100 = thuần quality (bỏ qua thể tích)
};
```

**Constraints:**
- Nếu `isLeaf = false`: `evalType` phải null
- Nếu `isLeaf = true`: `evalType` phải thuộc enum trên
- `scoringConfig` bắt buộc khi `evalType = "quantitative"`, null khi eval_type khác
- Tất cả siblings (cùng `parentId` trong cùng `treeId`) phải có Σ weight = 100
- Root siblings (cùng `treeId`, `parentId = null`) cũng phải Σ weight = 100
- Không quá 4 cấp depth (root = level 1)
- Không orphan nodes — mọi non-root node phải có `parentId` tồn tại trong cùng tree

---

### EvalPeriod

Kỳ đánh giá của một phòng, gắn với CriterionTree đang active tại thời điểm mở kỳ.

```typescript
type EvalPeriod = {
  id: string;
  departmentId: string;         // FK → Department
  name: string;                 // "Tháng 4/2026", "Q2 2026"
  periodStart: Date;
  periodEnd: Date;
  criterionTreeId: string;      // FK → CriterionTree (phải là active hoặc archived)
  mode: "calibration" | "official";  // calibration = tính điểm nhưng không có hậu quả HR
  status: "open" | "closed" | "finalized";
  createdAt: ISO8601;
};
```

**Constraints:**
- `criterionTreeId` gắn tại thời điểm mở kỳ, không thay đổi dù tree sau đó bị archive
- `status = finalized` → không nhận work_logs hay events mới

---

### WorkLog

Ghi nhận một đơn công việc đo được (eval_type = quantitative).

```typescript
type WorkLog = {
  id: string;
  employeeId: string;           // FK → Employee
  periodId: string;             // FK → EvalPeriod
  criterionNodeId: string;      // FK → CriterionNode (phải là leaf, eval_type=quantitative)
  externalId?: string;          // Từ CRM/ERP, dùng cho idempotency
  source?: string;              // "manual" | "crm" | "erp"
  quantity: number;             // Số lượng đơn vị (thường 1, > 0)
  unitPoints?: number;          // Điểm công mỗi đơn vị — override leaf.scoringConfig.base_unit_points
  unit?: string;                // "đơn", "km", "ca", ...
  score?: number;               // 0-100 normalized, tính hoặc cung cấp sẵn (quality)
  rawData?: object;             // JSON gốc từ CRM/ERP
  loggedAt: ISO8601;
  createdAt: ISO8601;
};
```

**Constraints:**
- `(externalId, source)` UNIQUE nếu cả hai đều có
- Khi CRM gọi lại với cùng `externalId + source` → UPDATE (idempotent)
- `criterionNodeId` phải trỏ đến leaf node có `evalType = "quantitative"`

### Event (sự vụ)

```typescript
type Event = {
  id: string;
  employeeId: string;           // FK → Employee
  periodId: string;             // FK → EvalPeriod
  criterionNodeId?: string;     // FK → CriterionNode (leaf, eval_type=event) — nullable: một số event là general
  externalId?: string;
  source?: string;              // "crm" | "erp" — dùng cho idempotency
  category: EventCategory;
  severity: "light" | "normal" | "heavy";
  direction: "positive" | "negative";
  scoreImpact: number;          // Điểm tác động (đã tính sẵn, dùng khi aggregate)
  title: string;
  description?: string;
  reporterId: string;           // FK → Employee — không ẩn danh
  status: "pending" | "confirmed" | "disputed" | "resolved";
  occurredAt: ISO8601;
  createdAt: ISO8601;
};

type EventCategory =
  | "commendation"       // khen thưởng
  | "complaint"          // phàn nàn
  | "incident"           // sự cố
  | "initiative"         // sáng kiến
  | "campaign_reward";   // phần thưởng từ campaign
```

**Constraints:**
- Chỉ event `status = "confirmed"` được tính vào scoring
- `reporterId` bắt buộc — không cho phép ẩn danh
- `criterionNodeId` nullable: event general không cần gắn với node cụ thể

### QualitativeScore

Điểm đánh giá 360° cho một leaf node (eval_type = qualitative_360).

```typescript
type QualitativeScore = {
  id: string;
  employeeId: string;           // FK → Employee (người được chấm)
  periodId: string;             // FK → EvalPeriod
  criterionNodeId: string;      // FK → CriterionNode (leaf, eval_type=qualitative_360)
  evaluatorId: string;          // FK → Employee (người chấm)
  evaluatorRole: "manager" | "peer" | "cross_dept" | "self";
  score: number;                // 0-100
  comment?: string;
  scoredAt: ISO8601;
};
```

**Constraints:**
- `(employeeId, periodId, criterionNodeId, evaluatorId)` UNIQUE — mỗi người chỉ chấm 1 lần/kỳ/node
- `employeeId != evaluatorId` (không tự chấm mình, trừ role = "self")
- Điểm cuối cho leaf = mean(tất cả scores của node đó trong kỳ)

### ManualScore

Điểm QL nhập trực tiếp cho leaf node (eval_type = manual).

```typescript
type ManualScore = {
  id: string;
  employeeId: string;           // FK → Employee
  periodId: string;             // FK → EvalPeriod
  criterionNodeId: string;      // FK → CriterionNode (leaf, eval_type=manual)
  score: number;                // 0-100
  rationale?: string;           // Lý do / ghi chú
  scoredBy: string;             // FK → Employee (QL nhập)
  scoredAt: ISO8601;
};
```

**Constraints:**
- `(employeeId, periodId, criterionNodeId)` UNIQUE — mỗi kỳ chỉ có 1 manual score/node
- Muốn sửa → UPDATE record cũ (có audit log)

### AIEvaluation

Kết quả AI chấm cho leaf node (eval_type = ai).

```typescript
type AIEvaluation = {
  id: string;
  employeeId: string;           // FK → Employee
  periodId: string;             // FK → EvalPeriod
  criterionNodeId: string;      // FK → CriterionNode (leaf, eval_type=ai)
  externalId?: string;
  source?: string;
  inputData: object;            // JSON input từ hệ thống nghiệp vụ
  aiScore?: number;             // 0-100, AI đề xuất
  aiReasoning?: string;         // Giải thích của AI
  aiModel?: string;             // Model đã dùng
  finalScore?: number;          // 0-100, sau khi QL confirm/override
  status: "pending_review" | "confirmed" | "overridden" | "discarded";
  reviewedBy?: string;          // FK → Employee
  reviewedAt?: ISO8601;
  createdAt: ISO8601;
};
```

**Constraints:**
- `(externalId, source)` UNIQUE
- Status ban đầu luôn là `pending_review` — AI **không bao giờ** tự confirm
- `finalScore` chỉ có sau khi QL confirm hoặc override

---

### PresetLibrary

Thư viện tiêu chí mẫu — không bắt buộc. Phòng có thể "copy from preset" để khởi tạo CriterionTree nhanh, hoặc xây từ đầu.

```typescript
type PresetLibrary = {
  id: string;
  name: string;                 // "Preset: Giao hàng chuẩn"
  description: string;
  targetDepartmentType?: string; // "delivery", "warehouse", "accounting", ...
};

type PresetNode = {
  id: string;
  presetId: string;             // FK → PresetLibrary
  parentId: string | null;      // Cấu trúc cây giống CriterionNode
  name: string;
  weight: number;
  isLeaf: boolean;
  evalType?: string;
  description?: string;
  sortOrder: number;
};
```

**Notes:**
- PresetLibrary là dữ liệu seed, không phải runtime entity bắt buộc
- "Copy from preset" = clone toàn bộ PresetNode thành CriterionNode trong CriterionTree mới (draft)
- Phòng có thể chỉnh sửa thoải mái sau khi copy — preset chỉ là điểm khởi đầu
- Preset tương đương với bộ "Standard Pillar Library" cũ, nhưng không ràng buộc schema

**Preset mẫu (seed data):**

| Preset | Mô tả |
|--------|-------|
| Giao hàng chuẩn | Kết quả (50%) + Chất lượng (30%) + Tuân thủ (20%) |
| Kho chuẩn | Kết quả nhập/xuất (45%) + Độ chính xác (35%) + An toàn (20%) |
| Bảo hành chuẩn | Kết quả ca (35%) + Tay nghề (25%) + Chất lượng (25%) + Phản hồi (15%) |
| Kế toán chuẩn | Độ chính xác (40%) + Tiến độ (30%) + Tuân thủ (20%) + Phát triển (10%) |

---

### ScorecardSnapshot

Kết quả đánh giá cuối kỳ, lưu cứng để không tính lại khi xem lịch sử.

```typescript
type ScorecardSnapshot = {
  id: string;
  employeeId: string;           // FK → Employee
  periodId: string;             // FK → EvalPeriod
  criterionTreeId: string;      // FK → CriterionTree (snapshot tại thời điểm tính)
  totalScore: number;           // 0-100
  rank: "A" | "B" | "C" | "D";
  completeness: "full" | "partial" | "none";
  detail: object;               // JSONB: breakdown từng node, score trace
  calculatedAt: ISO8601;
};
```

**Constraints:**
- `(employeeId, periodId)` UNIQUE
- `detail` lưu toàn bộ score trace để audit: node_id → score, source, contributing data

---

### Campaign

Sự kiện kích hoạt tinh thần theo dịp. Xem `docs/06-campaign-kich-hoat-tinh-than.md`.

```typescript
type Campaign = {
  id: string;
  name: string;
  description: string;
  type: "team_goal" | "individual_awards" | "recognition_week" | "milestone_celebration" | "skill_challenge";
  status: "draft" | "active" | "completed" | "cancelled";
  period: { from: ISO8601; to: ISO8601; };
  scope: { departmentIds?: string[]; employeeIds?: string[]; };
  goals?: CampaignGoal[];
  awards?: CampaignAward[];
  rewardDescription: string;
  rewardBudget?: number;
  createdBy: string;
  createdAt: ISO8601;
  completedAt?: ISO8601;
  endingRitualDone: boolean;
};
```

### PeerRecognition

```typescript
type PeerRecognition = {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  reason: string;               // Min 20 ký tự
  campaignId?: string;
  generatedEventId?: string;    // FK → Event
  createdAt: ISO8601;
};
```

### APIKey / AuditLog / DeadLetterQueue

Giữ nguyên từ thiết kế cũ — không thay đổi.

---

## Scoring Calculation

### Công thức cốt lõi: tree traversal

```
score(leaf)   = normalized score từ nguồn dữ liệu (0–100)
score(folder) = Σ (child.score × child.weight / 100)  ∀ child in children
score(tree)   = Σ (root.score  × root.weight  / 100)  ∀ root in root nodes
```

Điểm cuối cùng của nhân viên = score(tree) = số trong khoảng 0–100.

### Bước 1: Tính điểm leaf theo eval_type

**eval_type = "quantitative"**

Lấy tất cả WorkLog của NV trong kỳ có `criterionNodeId = leaf.id`, tính score:

```
raw_score = Σ(workLog.score × workLog.quantity) / Σ(workLog.quantity)
```

Nếu WorkLog chưa có score field (legacy data) → normalize bằng rule riêng (VD: tỷ lệ đúng hạn × 100).

**eval_type = "event"**

Lấy tất cả Event `status = "confirmed"` của NV trong kỳ có `criterionNodeId = leaf.id`:

```python
net_score = 0
for event in confirmed_events_for_node:
    multiplier = {"light": 1, "normal": 2, "heavy": 4}[event.severity]
    if event.direction == "positive":
        net_score += multiplier
    else:
        net_score -= multiplier

# Normalize về 0-100: baseline 50, mỗi đơn = ±5 điểm, clamp [0, 100]
score = clamp(50 + net_score × 5, 0, 100)
```

**eval_type = "qualitative_360"**

```python
scores = QualitativeScore where criterionNodeId = leaf.id and periodId = period.id
score = mean(s.score for s in scores)  # Đã trên thang 0-100
```

**eval_type = "manual"**

```python
ms = ManualScore where criterionNodeId = leaf.id and periodId = period.id
score = ms.score  # QL đã nhập sẵn 0-100
```

**eval_type = "ai"**

```python
ae = AIEvaluation where criterionNodeId = leaf.id and status in ("confirmed", "overridden")
score = ae.finalScore  # Đã được QL duyệt
# AIEvaluation ở pending_review → chưa tính vào score
```

### Bước 2: Rollup lên folder

```python
def score_node(node, period, employee_id):
    if node.is_leaf:
        return get_leaf_score(node, period, employee_id)  # Theo eval_type
    else:
        total = 0
        for child in node.children:
            child_score = score_node(child, period, employee_id)
            total += child_score * child.weight / 100
        return total

department_score = 0
for root in tree.root_nodes:
    department_score += score_node(root, period, employee_id) * root.weight / 100
```

### Bước 3: Xếp hạng

```
A: total_score >= 85
B: 70 <= total_score < 85
C: 55 <= total_score < 70
D: total_score < 55
```

Ngưỡng có thể cấu hình theo org.

### Completeness

Nếu có leaf chưa có dữ liệu (VD: AI evaluation vẫn `pending_review`, hoặc không có qualitative_score nào):

- Leaf thiếu dữ liệu: score = `null` → tính `completeness = "partial"`
- Khi tính rollup với null: bỏ qua leaf đó, redistribute weight lên các siblings còn lại
- Nếu mọi leaf đều null: `completeness = "none"`, không tạo snapshot

---

## Audit & History

Các entity cần audit log (append-only):

- CriterionTree publish (draft → active)
- CriterionTree archive
- Event status change
- ManualScore create / update
- AIEvaluation status change (review action)
- Employee active/inactive
- API key create / revoke
- Campaign create / publish / complete
- PeerRecognition create

---

## Suggested Storage

- **PostgreSQL:** phù hợp cho tất cả entities
- **Indexes cần thiết:**
  - `Employee.external_id` UNIQUE
  - `CriterionNode.(tree_id, parent_id)` — query children
  - `WorkLog.(external_id, source)` UNIQUE WHERE NOT NULL
  - `WorkLog.(employee_id, period_id, criterion_node_id)` — scoring query
  - `Event.(external_id, source)` UNIQUE WHERE NOT NULL
  - `Event.(employee_id, period_id, status)`
  - `QualitativeScore.(employee_id, period_id, criterion_node_id)`
  - `ManualScore.(employee_id, period_id, criterion_node_id)` UNIQUE
  - `AIEvaluation.(external_id, source)` UNIQUE WHERE NOT NULL
  - `AIEvaluation.(employee_id, period_id, criterion_node_id)`
  - `Campaign.(status, period_from)`
  - `PeerRecognition.(to_employee_id, created_at)`
