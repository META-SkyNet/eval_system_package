# Business Rules

Tài liệu này mô tả logic nghiệp vụ chi tiết của hệ thống — những gì không đặc tả được trong data model hay API contract.

## 1. Tính điểm công (Work Points)

### Quy tắc cốt lõi

Khi một WorkLog được tạo:

```
points_snapshot = workType.points × workLog.quantity
```

**Quan trọng:** Snapshot này được **lưu cứng** vào WorkLog, không tính lại mỗi lần query.

### Tại sao dùng snapshot?

Admin có thể chỉnh `workType.points` theo thời gian (VD: từ 10 → 12 vì thấy thực tế mất nhiều giờ hơn). Nếu tính lại mỗi lần query, điểm của các WorkLog cũ sẽ thay đổi → "viết lại lịch sử" → không công bằng.

**Nguyên tắc:** điểm đã ghi là điểm đã chốt. Chỉnh points chỉ ảnh hưởng WorkLog mới từ đó về sau.

### Khi UPDATE WorkLog (idempotent)

Khi CRM gọi lại với cùng `external_id`:

- Nếu chỉ đổi `status` (VD: từ completed_ontime → completed_late) → cập nhật, giữ `points_snapshot` cũ
- Nếu đổi `quantity` → tính lại `points_snapshot`
- Nếu đổi `workTypeId` → tính lại `points_snapshot`

## 2. Idempotency

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

- WorkLog: `(externalId, source)` unique
- Event: `(externalId, source_system)` unique

CRM khác ERP có thể có cùng external_id — không conflict vì source khác.

### Race condition

Nếu 2 request cùng `external_id` đến đồng thời:

```
BEGIN;
SELECT ... FOR UPDATE WHERE external_id = ?;
IF found → UPDATE
ELSE → INSERT
COMMIT;
```

Nếu DB không support, dùng distributed lock (Redis) theo `external_id`.

## 3. Vòng đời Event (sự vụ)

### Trạng thái

```
pending → confirmed    (QL xác nhận → tính vào điểm)
pending → disputed     (QL/NV tranh luận → tạm giữ)
disputed → confirmed   (sau khi giải quyết)
disputed → deleted     (nếu sai)
```

### Quy tắc tính điểm

**CHỈ event với `status = "confirmed"` được tính vào scoring.**

- `pending` — chưa tính, chờ xác nhận
- `disputed` — không tính, chờ giải quyết
- `deleted` — soft delete, không tính

### Tự động confirm (tuỳ chọn)

Có thể cấu hình: event từ nguồn `automatic` (hệ thống sinh) và `severity = light` tự động confirm. Event nặng hoặc từ khách phải manual confirm.

### Audit

Mọi thay đổi status phải ghi audit log với actor và timestamp.

## 4. Tính điểm sự vụ (Event Scoring)

### Điểm ròng của NV trong kỳ

```python
positive_score = 0
negative_score = 0

for event in events where employeeId = X 
                    and occurredAt in [from, to] 
                    and status = "confirmed":
    
    polarity = CATEGORY_POLARITY[event.category]  # + hoặc -
    weight = SEVERITY_MULTIPLIER[event.severity]   # 1, 2, 4
    
    if polarity == "+":
        positive_score += weight
    else:
        negative_score += weight

net_score = positive_score - negative_score
```

### Mapping event → pillar / question

Khi scoring một Question có `linkedEventCategories`:

```python
question_event_score = 0
for event in confirmed_events:
    if event.category in question.linkedEventCategories:
        polarity = CATEGORY_POLARITY[event.category]
        multiplier = SEVERITY_MULTIPLIER[event.severity]
        
        if polarity == "+":
            question_event_score += multiplier
        else:
            question_event_score -= multiplier

# Normalize về thang 0-100
# (Tuỳ chọn scheme: sigmoid, clamp, hoặc so với baseline của phòng)
```

### Category polarity (cố định)

```
customer_praise      → +
customer_complaint   → −
incident_damage      → −
initiative           → +
extra_effort         → +
absence              → −
teamwork             → +
skill_issue          → −
```

### Severity multiplier

```
light   → 1
medium  → 2
heavy   → 4
```

**Lưu ý:** Hệ số có thể hiệu chỉnh theo ngành/công ty. Ví dụ công ty trong lĩnh vực y tế có thể set heavy = 10.

## 5. Version lifecycle rules

### Publish conditions

Một Version chỉ được publish khi:

1. Tổng trọng số 3 pillars = 100
2. Có ít nhất 1 question trong mỗi pillar
3. Không có question nào có `weight = 0`
4. Question type `work_count` phải có `workTypeIds` không rỗng

### Publish side effects

Khi publish Version V của Template T:

1. Set `T.activeVersionId = V.id`
2. Nếu có version cũ active, set nó thành `archived`
3. Ghi `V.publishedAt = now()`
4. Tạo audit log

### Immutability

Version với status `published` hoặc `archived` KHÔNG được sửa:

- Không UPDATE pillars/questions
- Không được chuyển về `draft` lại

Muốn thay đổi → tạo Version mới (clone, modify, publish).

## 6. Employee mapping lifecycle

### Khi active = false

NV nghỉ việc: CRM gọi `/employee-mapping` với `active = false`.

**Hiệu ứng:**
- NV không xuất hiện trong form 360° mới
- Work logs / events cũ của NV vẫn giữ (lịch sử)
- Scorecard của NV vẫn có thể query (để đánh giá cho kỳ cuối cùng)
- Không nhận work events mới cho NV này → trả 422 `EMPLOYEE_INACTIVE`

### Khi đổi phòng

Trường hợp NV chuyển phòng: `department_code` thay đổi.

**Quy tắc:**
- Work logs cũ vẫn gắn với phòng cũ (qua workTypeId → catalog của phòng cũ)
- Work logs mới (sau khi đổi) gắn với phòng mới
- Scorecard tính riêng cho mỗi phòng trong kỳ tương ứng

## 7. Validation rules

### Work events

**Hard reject (400):**
- Thiếu field bắt buộc
- `quantity <= 0`
- `status` không trong enum
- `completed_at` format sai

**Dead letter (422):**
- `job_code` không có trong catalog của phòng NV
- `employee_external_id` không tồn tại

### Incidents

**Hard reject (400):**
- `category` không trong enum 8 loại
- `severity` không trong enum 3 mức
- `description.length < 10`
- `reported_by` rỗng

**Warning (nhưng vẫn accept):**
- `related_work_external_id` không tồn tại → vẫn tạo event, nhưng không link

## 8. Dead Letter Queue (DLQ)

### Khi nào vào DLQ

Event không xử lý được nhưng **không phải lỗi client** rõ ràng — có thể fix bằng data:

- `UNKNOWN_JOB_CODE` → admin thêm job_code vào catalog
- Future: schema migration, v.v.

### Khi nào KHÔNG vào DLQ

- Lỗi auth → 401, client phải fix
- Payload sai format → 400, client phải fix
- Race condition không giải quyết → 409, client retry

### Replay

Admin có thể trigger replay một event từ DLQ sau khi fix root cause. Replay dùng lại payload gốc, đi qua validation lại.

Nếu replay thành công → đánh dấu event DLQ là `processed`, move khỏi queue.

Nếu replay thất bại → giữ trong DLQ, có thể xoá manual nếu xác định không cần.

## 9. Rate limiting & quotas

### Per API key

Default: **100 req/s**. Vượt → HTTP 429 với header `Retry-After`.

Có thể tăng theo nhu cầu bằng cách cấp lại API key với rate limit cao hơn.

### Burst

Cho phép burst gấp 2 lần (200 req/s) trong 10 giây.

### Per-endpoint

GET scorecard nặng hơn POST events → rate limit riêng, VD 20 req/s.

## 10. Data retention

- **Work logs, events:** giữ vĩnh viễn (hoặc tối thiểu 5 năm)
- **Audit logs:** tối thiểu 3 năm
- **API keys:** revoked keys vẫn giữ record để audit
- **DLQ:** tối thiểu 30 ngày, sau đó có thể archive

## 11. Periodic tasks

### Hàng ngày

- Tính lại scorecard cache cho mỗi NV active
- Alert nếu DLQ > threshold

### Hàng tuần

- Report sự vụ `pending` quá 7 ngày (chưa xác nhận) → reminder cho QL

### Hàng tháng

- Snapshot scoring cuối kỳ → lưu vào bảng `scorecard_snapshots` để không phải tính lại khi xem lịch sử
- Auto-generate evaluation period

## 12. Security rules

### API key

- Prefix `evk_live_` cho production, `evk_test_` cho staging
- Key secret không hiển thị lại sau khi tạo — admin phải lưu
- Revoke key phải có confirm 2 bước

### HMAC

- Signature mismatch → 401 + log để detect brute force
- Timestamp lệch > 5 phút → 401
- Cùng signature dùng 2 lần trong 10 giây → 401 (replay detection)

### CORS

- API endpoints **không** hỗ trợ CORS (không cho gọi từ browser)
- Dashboard frontend có endpoint riêng (ngoài scope spec này)

## 13. Giới hạn hiện tại (v1)

**Chưa support:**
- Multi-tenancy (mỗi company dùng 1 instance riêng)
- Real-time streaming (chỉ có webhook, chưa có WebSocket)
- Multi-currency hay i18n sâu (hiện chỉ Việt)
- Workflow approval phức tạp (chỉ có pending/confirmed/disputed đơn giản)

**Có thể thêm sau:**
- Version hoá WorkCatalog (hiện tại chỉ CRUD)
- Bulk import endpoint cho migration
- Webhook ngược (Evaluation → CRM)
- SDK client cho các ngôn ngữ phổ biến
