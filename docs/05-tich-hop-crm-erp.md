# 05 · Tích hợp Side-by-side với CRM / ERP

## Triết lý

Hệ thống đánh giá này không thay thế CRM/ERP — nó **đứng cạnh** và **lắng nghe** sự kiện từ CRM/ERP.

- **CRM/ERP**: System of Record (nguồn sự thật về đơn hàng, công việc, khiếu nại)
- **Evaluation System**: System of Aggregation (chỉ quan tâm *ai đã làm việc gì, kết quả ra sao*)

## Kiến trúc

```
┌─────────────────────┐         webhook          ┌──────────────────────┐
│                     │  POST /work-events       │                      │
│   CRM / ERP         │─────────────────────────▶│  Evaluation System   │
│  (source of truth)  │  POST /incidents         │                      │
│                     │                          │                      │
│  đơn hàng           │  POST /employee-mapping  │  work logs           │
│  công việc          │─────────────────────────▶│  events              │
│  khiếu nại          │                          │  scorecards          │
│  nhân viên          │  GET /scorecard          │                      │
│                     │◀─────────────────────────│                      │
└─────────────────────┘                          └──────────────────────┘
     port 80/443                                      port 443 only
```

## 6 nguyên tắc thiết kế

### 1. Event-driven, không polling

CRM đẩy sự kiện sang khi có thay đổi — Evaluation System không đi query CRM. Lợi ích:

- Độ trễ thấp (< 2 giây)
- Không phụ thuộc lịch trình
- CRM không phải hở API nội bộ cho bên ngoài

### 2. Idempotent qua external_id

Mỗi event có `external_id` do CRM tự sinh. Gửi lại cùng id = cập nhật, không tạo trùng.

**Tại sao quan trọng:** Network có thể lỗi, CRM retry, race condition... Idempotent đảm bảo mọi sự kiện chỉ được tính **đúng một lần** dù được gửi nhiều lần.

### 3. External ID first

Mọi tham chiếu cross-system qua `external_id` (employee, work). Tên nhân viên có thể đổi, dấu có thể sai — ID thì bền.

### 4. Dead Letter Queue

Event lỗi (sai format, NV chưa map, loại việc chưa định nghĩa) đưa vào DLQ, không mất. Có thể replay khi đã fix.

### 5. HMAC signing + API key

- Mỗi hệ thống nguồn (CRM, ERP, POS) có **API key riêng** — tách biệt, dễ revoke
- Mỗi request có **HMAC signature** tính trên timestamp + body → chống giả mạo
- Timestamp trong request, reject nếu lệch > 5 phút → chống replay attack
- Chỉ qua HTTPS, không bao giờ qua HTTP

### 6. Một chiều chính

Chiều **từ CRM sang Evaluation** là chiều chính (events). Chiều ngược lại chỉ có 1 endpoint GET (lấy scorecard) để CRM hiển thị trên dashboard riêng.

**Không** có endpoint từ Evaluation *điều khiển* CRM — giữ ranh giới sạch.

## Bốn endpoints tối thiểu

### 1. `POST /api/v1/work-events`

CRM báo có công việc vừa xảy ra / thay đổi.

**Use case:** Đơn hàng đóng → CRM gọi endpoint này với `employee_external_id`, `external_ref`, `status`.

### 2. `POST /api/v1/incidents`

CRM báo có sự vụ (khen, phàn nàn, sự cố...).

**Use case:** Khách gọi khiếu nại qua hotline → CSKH lưu vào CRM → CRM gọi endpoint này.

### 3. `POST /api/v1/employee-mapping`

Đồng bộ map giữa employee ID của CRM và employee nội bộ.

**Use case:** Gọi một lần lúc setup (bulk). Sau đó gọi mỗi khi HR thêm/đổi/nghỉ nhân viên.

### 4. `GET /api/v1/employees/{id}/scorecard`

CRM kéo bảng điểm về hiển thị trên dashboard riêng.

**Use case:** Dashboard CRM hiện "Điểm kỳ này" cho QL xem realtime.

## Quick start cho dev CRM/ERP

1. **Lấy API key** từ admin Evaluation System
2. **Đồng bộ nhân viên một lần** qua bulk import — gọi `POST /employee-mapping` cho mọi NV hiện có
3. **Gắn webhook trong CRM:**
   - Mỗi khi đơn chuyển sang "Hoàn thành" → gọi `POST /work-events`
   - Mỗi khiếu nại / khen từ khách → gọi `POST /incidents`
4. **Test qua Playground** trước khi đẩy lên production (xem artifact `api_integration_design.jsx`)
5. **Theo dõi Integration Logs** để debug

## Xử lý lỗi phía CRM

### Retry strategy

```
HTTP 2xx → Thành công, xoá khỏi retry queue
HTTP 4xx → Lỗi validation, KHÔNG retry, log lại để fix
HTTP 5xx → Lỗi server, retry với exponential backoff (3 lần trong 24h)
Network error → Retry tương tự 5xx
```

### Đảm bảo không mất event

CRM nên có **local retry queue riêng** để xử lý trường hợp Evaluation System down. Events chưa gửi được lưu vào queue, retry 3 lần trong 24h. Nếu vẫn fail → alert cho dev.

Idempotent qua `external_id` đảm bảo retry an toàn, không gây duplicate.

## Các câu hỏi CRM team thường hỏi

### "Làm sao biết event đã xử lý xong?"

Response đồng bộ với HTTP status 201/200/422/400. Nếu cần async hoàn toàn, có thể nâng cấp lên pattern queue + callback sau.

### "Nếu Evaluation System down thì sao?"

CRM có local retry queue (xem trên). Evaluation System đóng vai trò *aggregation*, không phải nghiệp vụ chính — down 1-2 giờ không ảnh hưởng bán hàng. Chỉ cần backfill sau.

### "Phải đồng bộ lịch sử cũ không?"

Có thể thêm endpoint `POST /api/v1/bulk-import` cho migration ban đầu (VD import 6 tháng lịch sử). Khác với `/work-events` thông thường — không validate nghiêm, không trigger side effects.

Hiện chưa đặc tả trong v1, có thể thêm khi cần.

### "Employee mapping tự động thế nào?"

Hai cách:

**a)** CRM đẩy qua `/employee-mapping` mỗi khi có thay đổi HR (webhook trong CRM) — khuyên dùng

**b)** Evaluation System pull định kỳ từ HR API — phức tạp hơn, cần thêm kết nối HR

### "Mapping giữa phòng trong CRM và department_code ra sao?"

Department code là string tự do phía Evaluation (DELIVERY, WAREHOUSE, WARRANTY, ...). CRM team phối hợp với admin Evaluation để chốt mapping này **một lần**. Sau đó CRM luôn gửi đúng code.

## Bảo mật

### HMAC signing

```python
# Python example
import hmac, hashlib, time, json

secret = "evk_secret_..."
timestamp = str(int(time.time()))
body = json.dumps(payload, separators=(',', ':'))

payload_to_sign = f"{timestamp}.{body}"
signature = hmac.new(
    secret.encode(),
    payload_to_sign.encode(),
    hashlib.sha256
).hexdigest()

headers = {
    "X-API-Key": "evk_live_...",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
    "Content-Type": "application/json"
}
```

### Best practices

1. Mỗi hệ thống nguồn (CRM, ERP, POS) có API key riêng
2. Key secret không bao giờ commit vào git — dùng env var hoặc secret manager
3. Rotate key định kỳ 6-12 tháng, support 2 key cùng lúc để rollover
4. Giới hạn IP whitelist nếu CRM chạy ở server cố định
5. Log mọi request ở phía Evaluation (Integration Logs)

## Đọc tiếp

- `spec/api-specification.md` — contract đầy đủ với request/response mẫu cho 4 endpoints
- `spec/business-rules.md` — logic xử lý khi nhận event
- Artifact `api_integration_design.jsx` — playground để test payload
