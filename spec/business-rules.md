# Business Rules

Tài liệu này mô tả logic nghiệp vụ chi tiết của hệ thống — những gì không đặc tả được trong data model hay API contract.

## 1. Tính điểm leaf (Leaf Scoring)

Mỗi leaf node có `eval_type` xác định cách tính điểm. Kết quả luôn là số trong khoảng **0–100**.

### eval_type = "quantitative"

Tính điểm dựa trên **điểm công tích lũy** trong kỳ, theo `leaf.scoringConfig`:

```python
logs = WorkLog where employee_id = X and period_id = P and criterion_node_id = leaf.id
cfg  = leaf.scoringConfig  # ScoringConfig — bắt buộc với eval_type="quantitative"

# --- Không có WorkLog nào ---
if not logs:
    return {"zero": 0, "exclude": None, "neutral": 50}[cfg.no_data_policy]

# --- Bước 1: Điểm công mỗi log ---
# unitPoints trên WorkLog override base_unit_points của leaf
for log in logs:
    log.earned = log.quantity × (log.unitPoints ?? cfg.base_unit_points ?? 1)

total_earned = Σ(log.earned for log in logs)

# --- Bước 2: Volume score (dựa trên điểm công tích lũy) ---
if cfg.formula == "target_based":
    # So sánh điểm công thực tế với mục tiêu
    volume_score = clamp(total_earned / cfg.target_points × 100, cfg.floor, cfg.cap)

elif cfg.formula == "ratio":
    # Mỗi log có score — weighted mean theo earned points
    scored = [l for l in logs if l.score is not None]
    volume_score = Σ(l.score × l.earned for l in scored) / Σ(l.earned for l in scored)

elif cfg.formula == "passthrough":
    # CRM tự tính và gửi score — dùng WorkLog cuối kỳ
    volume_score = max(logs, key=lambda l: l.loggedAt).score

# --- Bước 3: Quality score + kết hợp (nếu quality_weight > 0) ---
q = cfg.quality_weight / 100   # 0.0 → 1.0
v = 1 - q

if q > 0:
    scored = [l for l in logs if l.score is not None]
    if scored:
        quality_score = Σ(l.score × l.earned for l in scored) / Σ(l.earned for l in scored)
    else:
        quality_score = volume_score  # fallback: không có quality data
    leaf_score = volume_score × v + quality_score × q
else:
    leaf_score = volume_score

return leaf_score
```

**Ví dụ: Phòng Giao hàng, NV Long, tháng 4**

```
scoringConfig = { formula: "target_based", base_unit_points: 1,
                  target_points: 200, quality_weight: 30, no_data_policy: "zero" }

WorkLogs:
  80 giao nhỏ   → quantity=1, unitPoints=null→1,  score=null  → earned=80
  20 lắp nội thất → quantity=1, unitPoints=3,     score=92    → earned=60
   8 lắp điều hòa → quantity=1, unitPoints=5,     score=88    → earned=40

total_earned  = 180 điểm công
volume_score  = min(180/200×100, 100) = 90
quality_score = (92×60 + 88×40) / (60+40) = 90.4   # chỉ logs có score

leaf_score = 90×0.7 + 90.4×0.3 = 90.12
```

### eval_type = "event"

Lấy tất cả Event `status = "confirmed"` của NV trong kỳ có `criterion_node_id = leaf.id`:

```python
events = Event where employee_id = X and period_id = P
              and criterion_node_id = leaf.id and status = "confirmed"

SEVERITY_MULTIPLIER = {"light": 1, "normal": 2, "heavy": 4}

net_score = 0
for event in events:
    w = SEVERITY_MULTIPLIER[event.severity]
    if event.direction == "positive":
        net_score += w
    else:
        net_score -= w

# Normalize về 0-100: baseline 50, mỗi đơn = ±5 điểm, clamp [0, 100]
leaf_score = clamp(50 + net_score × 5, 0, 100)
```

Hệ số `5` và baseline `50` có thể cấu hình theo org.

### eval_type = "qualitative_360"

```python
scores = QualitativeScore where employee_id = X and period_id = P
                             and criterion_node_id = leaf.id

if len(scores) == 0:
    leaf_score = None  # Chưa có dữ liệu
else:
    leaf_score = mean(s.score for s in scores)  # Thang 0-100
```

Điểm cuối là trung bình cộng bình thường của tất cả evaluators, không phân biệt vai trò (trừ khi có cấu hình weight theo role).

### eval_type = "manual"

```python
ms = ManualScore where employee_id = X and period_id = P and criterion_node_id = leaf.id

if ms exists:
    leaf_score = ms.score
else:
    leaf_score = None  # QL chưa nhập
```

### eval_type = "ai"

```python
ae = AIEvaluation where employee_id = X and period_id = P
                   and criterion_node_id = leaf.id
                   and status IN ("confirmed", "overridden")

if ae exists:
    leaf_score = ae.final_score
else:
    leaf_score = None  # pending_review hoặc discarded → không tính
```

AIEvaluation ở `pending_review` **không được dùng** để tính điểm, ngay cả khi đã có `ai_score`.

---

## 2. Tính điểm folder và tree (Tree Traversal)

### Công thức rollup

```python
def score_node(node, period_id, employee_id):
    if node.is_leaf:
        return get_leaf_score(node, period_id, employee_id)  # Theo eval_type, kết quả 0-100 hoặc None

    children = CriterionNode where parent_id = node.id  # order by sort_order
    scored_children = [(child, score_node(child, period_id, employee_id)) for child in children]
    available = [(child, score) for child, score in scored_children if score is not None]

    if len(available) == 0:
        return None  # Toàn bộ con đều thiếu dữ liệu

    # Redistribute weight: bỏ qua node thiếu dữ liệu, chia lại trọng số
    total_available_weight = sum(child.weight for child, _ in available)
    folder_score = sum(score × child.weight / total_available_weight for child, score in available)
    return folder_score


def score_tree(tree, period_id, employee_id):
    roots = CriterionNode where tree_id = tree.id and parent_id IS NULL
    scored_roots = [(root, score_node(root, period_id, employee_id)) for root in roots]
    available = [(root, score) for root, score in scored_roots if score is not None]

    if len(available) == 0:
        return None, "none"

    total_weight = sum(root.weight for root, _ in available)
    total_score = sum(score × root.weight / total_weight for root, score in available)

    all_scored = len(available) == len(roots)
    completeness = "full" if all_scored else "partial"
    return total_score, completeness
```

### Xếp hạng

```
A: total_score >= 85
B: 70 <= total_score < 85
C: 55 <= total_score < 70
D: total_score < 55
```

Ngưỡng có thể cấu hình theo org. Completeness = "none" → không xếp hạng, không tạo snapshot.

---

## 3. Idempotency

### External ID là chìa khoá

Mọi POST endpoint xử lý idempotent qua `external_id`:

```
if exists(external_id, source):
    UPDATE existing record
    return 200 OK, action="updated"
else:
    CREATE new record
    return 201 Created, action="created"
```

### Uniqueness scope

`external_id` unique trong phạm vi `(entity_type, source)`:

- WorkLog: `(external_id, source)` unique
- Event: `(external_id, source)` unique
- AIEvaluation: `(external_id, source)` unique

CRM khác ERP có thể có cùng external_id — không conflict vì source khác.

### Race condition

```
BEGIN;
SELECT ... FOR UPDATE WHERE external_id = ? AND source = ?;
IF found → UPDATE
ELSE → INSERT
COMMIT;
```

Nếu DB không support, dùng distributed lock (Redis) theo `(entity_type, external_id, source)`.

---

## 4. Vòng đời Event (sự vụ)

### Trạng thái

```
pending → confirmed    (QL xác nhận → tính vào điểm)
pending → disputed     (QL/NV tranh luận → tạm giữ)
disputed → confirmed   (sau khi giải quyết)
disputed → resolved    (kết thúc, không tính điểm)
```

### Quy tắc tính điểm

**CHỈ event `status = "confirmed"` được tính vào scoring.**

- `pending` — chưa tính
- `disputed` — không tính, chờ giải quyết
- `resolved` — không tính (đã xử lý nhưng không confirm)

### Tự động confirm (tuỳ chọn)

Có thể cấu hình: event từ nguồn hệ thống tự sinh (`source = "internal"`) với `severity = "light"` tự động confirm. Event nặng hoặc từ khách phải manual confirm.

### Reporter bắt buộc

`reporter_id` luôn phải trỏ đến một Employee tồn tại. Không cho phép event ẩn danh.

---

## 5. CriterionTree lifecycle rules

### Publish (activate) conditions

Một CriterionTree chỉ được chuyển sang `active` khi:

1. Có ít nhất 1 root node (node với `parent_id = NULL`)
2. Tất cả siblings (cùng cha) có Σ weight = 100.00 (±0.01 tolerance)
3. Root nodes có Σ weight = 100.00
4. Không có orphan node (mọi non-root node có parent_id tồn tại trong cùng tree)
5. Mọi leaf node có `eval_type` hợp lệ và không null
6. Mọi folder node có `eval_type = null`
7. Không quá 4 cấp độ depth (root = level 1)

### Publish side effects

Khi activate CriterionTree V của Department D:

1. Set `V.status = "active"`, `V.activated_at = now()`
2. Nếu có tree cũ đang active của phòng D → chuyển thành `archived`
3. Tạo audit log: `{ entity: "criterion_tree", action: "activated", ... }`

### Immutability

CriterionTree với status `active` hoặc `archived` **không được sửa**:

- Không UPDATE, INSERT, DELETE nodes
- Không chuyển về `draft`

Muốn thay đổi → clone tree hiện tại thành draft mới (version + 1), modify, activate.

---

## 6. WorkLog validation

### Hard reject (400)

- Thiếu field bắt buộc (`employee_id`, `criterion_node_id`, `quantity`, `logged_at`)
- `quantity <= 0`
- `logged_at` format sai

### Dead letter (422)

- `criterion_node_id` không tồn tại
- `criterion_node_id` trỏ đến node không phải leaf hoặc `eval_type != "quantitative"`
- `employee_id` không tồn tại trong hệ thống

### Business warning (vẫn accept)

- `period_id` không tồn tại hoặc đã `finalized` → tạo DLQ entry, báo admin

---

## 7. Event validation

### Hard reject (400)

- `category` không trong enum
- `severity` không trong enum
- `title` rỗng
- `reporter_id` rỗng hoặc không tồn tại

### Dead letter (422)

- `employee_id` không tồn tại
- `criterion_node_id` có nhưng không phải leaf hoặc `eval_type != "event"`

### Warning (vẫn accept)

- `criterion_node_id` rỗng → tạo event general, không gắn với leaf cụ thể

---

## 8. Dead Letter Queue (DLQ)

### Khi nào vào DLQ

Event không xử lý được nhưng không phải lỗi client rõ ràng — có thể fix bằng data:

- `UNKNOWN_NODE_REF` → admin thêm/map node reference đúng
- `EMPLOYEE_NOT_FOUND` → admin đồng bộ NV từ CRM
- `PERIOD_FINALIZED` → admin mở lại hoặc tạo kỳ mới

### Khi nào không vào DLQ

- Lỗi auth → 401, client phải fix
- Payload sai format → 400, client phải fix
- Race condition không giải quyết → 409, client retry

### Replay

Admin trigger replay sau khi fix root cause. Nếu thành công → `processed`. Nếu thất bại → giữ trong DLQ, có thể `discarded` thủ công.

---

## 9. Employee mapping lifecycle

### Khi active = false

NV nghỉ việc: CRM gọi `/employee-mapping` với `active = false`.

- NV không xuất hiện trong form 360° mới
- Work logs / events cũ vẫn giữ (lịch sử)
- Scorecard vẫn query được (kỳ cuối cùng)
- Không nhận work_logs/events mới → 422 `EMPLOYEE_INACTIVE`

### Khi đổi phòng

- Work logs/events cũ gắn với kỳ/phòng cũ (qua `period_id`)
- Work logs mới gắn với phòng mới (kỳ mới của phòng mới)
- Scorecard tính riêng cho từng phòng theo `period_id`

---

## 10. Rate limiting & quotas

### Per API key

Default: **100 req/s**. Vượt → HTTP 429 với header `Retry-After`.

### Burst

Cho phép burst gấp 2 lần (200 req/s) trong 10 giây.

### Per-endpoint

GET scorecard nặng hơn → rate limit riêng (VD: 20 req/s).

---

## 11. Data retention

- **Work logs, events:** giữ vĩnh viễn (tối thiểu 5 năm)
- **Audit logs:** tối thiểu 3 năm
- **API keys:** revoked keys vẫn giữ record để audit
- **DLQ:** tối thiểu 30 ngày, sau đó có thể archive

---

## 12. Periodic tasks

### Hàng ngày

- Tính lại scorecard cache cho mỗi NV active (dựa trên dữ liệu mới nhất trong kỳ đang open)
- Alert nếu DLQ > threshold

### Hàng tuần

- Report event `pending` quá 7 ngày (chưa xác nhận) → reminder cho QL

### Hàng tháng

- Snapshot scoring cuối kỳ → lưu vào `scorecard_snapshots`
- Auto-generate eval_period mới nếu cấu hình

---

## 13. Security rules

### API key

- Prefix `evk_live_` cho production, `evk_test_` cho staging
- Key secret không hiển thị lại sau khi tạo
- Revoke key phải có confirm 2 bước

### HMAC

- Signature mismatch → 401 + log
- Timestamp lệch > 5 phút → 401
- Cùng signature dùng 2 lần trong 10 giây → 401 (replay detection)

### CORS

- API endpoints không hỗ trợ CORS (không gọi từ browser)
- Dashboard frontend có endpoint riêng

---

## 14. Campaign lifecycle rules

### Vòng đời

```
draft → active → completed
          │
          └──→ cancelled
```

### Activate conditions

1. Có tên, mô tả, period hợp lệ (from < to)
2. `type = "team_goal"` → có ít nhất 1 goal
3. `type = "individual_awards"` → có ít nhất 1 award
4. `period_from > now()`
5. `reward_description` không rỗng

### Soft warnings khi activate

- Campaign cùng scope active trong 4 tuần qua → cảnh báo
- Period > 3 tháng → cảnh báo
- `reward_budget = 0` → cảnh báo

### Complete conditions

1. `period_to` đã trôi qua hoặc admin force complete
2. `ending_ritual_done = true` — bắt buộc
3. `type = "individual_awards"` → `winners` phải được điền

### Tương tác với CriterionTree

Campaign **không trực tiếp** ảnh hưởng đến scoring của CriterionTree. Thay vào đó:

- Winner awards → tạo Event positive → event này tính vào leaf `eval_type=event` như bình thường
- PeerRecognition → tạo Event `commendation` → tính vào leaf tương ứng nếu gắn node

---

## 15. PeerRecognition rules

### Validation

- `from_employee_id != to_employee_id`
- `reason.length >= 20` ký tự
- Nếu có `campaign_id` loại Recognition Week → enforce quota (mặc định 5/người/campaign)

### Anti-abuse

- NV A gửi > 10 recognition trong 24h → rate limit
- A → B > 5 lần liên tiếp → flag để admin review
- A và B gửi qua lại đều đặn → flag (possible collusion)
- Reason text giống hệt nhau nhiều lần → flag (copy-paste spam)

Flagged recognition không bị xoá tự động.

### Auto-generate event

```
Event {
  category: "commendation",
  severity: "light",
  direction: "positive",
  source: "internal",
  status: "confirmed",
  reporter_id: from_employee_id,
  title: "Lời cảm ơn từ <from_employee.full_name>",
  description: recognition.reason,
  employee_id: recognition.to_employee_id,
}
```

---

## 16. AI Evaluation Rules

### Luồng xử lý

```
POST /ai-evaluations
    │
    ├── Validate: criterion_node_id có tồn tại, is_leaf=true, eval_type="ai"?
    │       Không → 422 INVALID_NODE
    │
    ├── Validate: input_data có đủ fields không? (dựa trên leaf.description hoặc external_ref)
    │       Không → 422 INSUFFICIENT_DATA
    │
    ├── Idempotency check: (external_id, source) đã tồn tại?
    │       Có → return existing ai_evaluation_id, 200
    │
    ├── Build AI prompt từ leaf context + input_data
    ├── Call AI API
    ├── Parse result → ai_score + ai_reasoning + red_flags
    │
    ├── Tạo AIEvaluation (status = "pending_review")
    ├── Tạo AIAlert cho mỗi red flag phát hiện
    └── Return ai_evaluation_id
```

### Immutability của leaf node

Khi CriterionTree đã active, leaf nodes là immutable. Muốn thay đổi tiêu chí AI chấm → tạo tree version mới. Lý do: criteria thay đổi hồi tố làm điểm cũ mất ý nghĩa.

### Review rules

QL có 3 hành động với mỗi AIEvaluation:

1. `confirm` — đồng ý với AI. `final_score = ai_score`, `status = "confirmed"`. Tính điểm.
2. `override` — tự nhập kết quả mới. `final_score = manual_value`, `override_reason` bắt buộc, `status = "overridden"`.
3. `discard` — không cần chấm (nhầm người, trùng...). `status = "discarded"`, không tính điểm.

### Thời hạn review

| Severity | Thời hạn | Quá hạn |
|----------|----------|---------|
| light    | 7 ngày   | Auto-confirm nếu accuracy đạt ngưỡng (xem bên dưới) |
| normal   | 3 ngày   | Archive, không tính điểm |
| heavy    | Không giới hạn | QL phải xử lý thủ công |

### Soft launch và accuracy phase

**Giai đoạn 1 (tháng 1–2): Observation**

- Tất cả AI evaluation ở `pending_review`, chờ QL review
- Điểm chưa tính vào scorecard thật
- Đo: `accuracy = confirm / (confirm + override)` theo từng leaf node

**Giai đoạn 2 (từ tháng 3): Production theo threshold**

```python
if accuracy(node_id, severity="light") >= 0.90:
    light_cases → auto_confirm sau 7 ngày không review

if accuracy(node_id, severity="normal") >= 0.85:
    normal_cases → nhắc QL review trong 3 ngày, không auto

# heavy luôn manual — không exception
```

Threshold tính riêng theo từng `criterion_node_id`, không gộp chung.

### Red flags

Red flags không tạo WorkLog hay Event — chỉ tạo AIAlert:

```
AIAlert {
  ai_evaluation_id: ...,
  alert_type: "red_flag",
  message: "Pattern bất thường: ...",
  status: "open"
}
```

Admin review thủ công, quyết định có tạo Event hay không.

### Anti-gaming

NV không được xem nội dung `leaf.description` chi tiết về cách AI chấm (scoring logic) — chỉ xem kết quả tổng quan. Tránh optimize cho AI thay vì optimize cho công việc thật.

### Idempotency

`(external_id, source)` unique cho AIEvaluation — cùng input gửi 2 lần chỉ chấm 1 lần.

---

## 17. Calibration Period — Hiệu chuẩn tham số

### Khái niệm

`EvalPeriod.mode` kiểm soát hậu quả HR của kỳ đánh giá:

| mode | Điểm được tính | Hiển thị cho NV | Gắn vào lương/xét thăng |
|------|---------------|-----------------|------------------------|
| `calibration` | Có | Có (để feedback) | **Không** |
| `official` | Có | Có | **Có** |

Calibration period cho phép QL và NV quan sát điểm thực tế trước khi hệ thống có hậu quả chính thức. Sau 1–2 kỳ calibration, điều chỉnh `scoringConfig` rồi chuyển sang official.

### Quy tắc

1. Kỳ `mode=calibration` vẫn tính đầy đủ: WorkLog, Event, Scorecard — chỉ khác ở nhãn
2. Snapshot của calibration period được lưu với `is_calibration=true` để phân biệt
3. Không giới hạn số kỳ calibration trước khi chuyển official
4. QL có thể xem distribution report sau khi kỳ calibration đóng

### Distribution Analysis — gợi ý hiệu chỉnh

Sau khi một kỳ (`calibration` hoặc `official`) đóng, hệ thống tính phân phối điểm mỗi leaf:

```python
for leaf in tree.leaves:
    scores = [scorecard.leaf_scores[leaf.id]
              for scorecard in period.scorecards
              if leaf.id in scorecard.leaf_scores]
    if not scores: continue

    analysis = {
        "leaf_id":    leaf.id,
        "count":      len(scores),
        "mean":       mean(scores),
        "p25":        percentile(scores, 25),
        "p75":        percentile(scores, 75),
        "pct_above90": len([s for s in scores if s >= 90]) / len(scores),
        "pct_below50": len([s for s in scores if s < 50]) / len(scores),
    }

    # Sinh gợi ý hiệu chỉnh
    if analysis.pct_above90 > 0.80:
        hint = "TARGET_TOO_LOW"    # >80% đạt ≥90 → target_points cần tăng
    elif analysis.pct_below50 > 0.50:
        hint = "TARGET_TOO_HIGH"   # >50% dưới 50 → target_points cần giảm
    elif analysis.mean > 90 and analysis.p25 > 85:
        hint = "CONSIDER_HARDER"   # Phân phối dồn về đỉnh — cân nhắc tăng độ khó
    elif analysis.mean < 40:
        hint = "CONSIDER_EASIER"   # Quá khắt khe — hầu hết NV thất bại
    else:
        hint = "OK"
```

Gợi ý được lưu vào bảng `calibration_hints` và hiển thị cho admin khi review kỳ.

### Workflow hiệu chuẩn chuẩn

```
[Tạo CriterionTree v1 — dựa trên preset hoặc kinh nghiệm]
         │
         ▼
[Calibration period × 1–2 kỳ]
   NV làm việc bình thường, CRM gửi dữ liệu
   Điểm hiển thị nhưng không có hậu quả HR
         │
         ▼ Kỳ đóng → xem Distribution Analysis
         │
    ┌────┴────────────────────────────┐
    │ hint=OK cho đa số leaf          │ hint có vấn đề
    ▼                                 ▼
[Mở official period]       [Clone tree → v2]
                           Điều chỉnh: target_points,
                           base_unit_points, quality_weight, weight
                           Ghi calibrationNotes: "Lý do thay đổi"
                           Publish v2
                                │
                                ▼
                   [Calibration period thêm 1 kỳ với v2]
                                │
                                ▼
                         [Mở official period]
```

### Điều chỉnh không cần tạo tree version mới

Một số tham số của `scoringConfig` không ảnh hưởng đến cấu trúc cây — có thể điều chỉnh trong kỳ `draft` mới mà không cần redesign toàn bộ:

| Điều chỉnh | Cần version mới? | Lý do |
|-----------|-----------------|-------|
| `target_points` | Có (clone tree) | Thay đổi scoring rule → immutability |
| `base_unit_points` | Có (clone tree) | Ảnh hưởng tất cả WorkLog cũ |
| `quality_weight` | Có (clone tree) | Thay đổi cách combine score |
| `weight` của node | Có (clone tree) | Thay đổi tầm quan trọng tương đối |
| `calibrationNotes` | Không | Chỉ là ghi chú, không ảnh hưởng score |

### Retroactive comparison (không thay thế điểm cũ)

Sau khi publish tree v2, admin có thể chạy **shadow recalculation** trên kỳ calibration đã đóng:

- Tính lại điểm của kỳ cũ bằng v2 (không thay thế điểm gốc của v1)
- So sánh side-by-side: v1 vs. v2 trên cùng tập dữ liệu
- Đây là tool phân tích, không phải thay thế lịch sử

Điểm official đã finalized **không bao giờ thay đổi** — lịch sử bất biến.

---

## 18. Giới hạn hiện tại (v2)

**Chưa support:**

- Multi-tenancy (mỗi company dùng 1 instance riêng)
- Real-time streaming (chỉ có webhook, chưa có WebSocket)
- Multi-currency hay i18n sâu (hiện chỉ Việt)
- Workflow approval phức tạp

**Có thể thêm sau:**

- Bulk import endpoint cho migration
- Webhook ngược (Evaluation → CRM)
- SDK client cho các ngôn ngữ phổ biến
- Copy-from-preset API endpoint (clone PresetLibrary → CriterionTree draft)
- Weight-by-evaluator-role trong qualitative_360 (hiện tại trung bình bình thường)
