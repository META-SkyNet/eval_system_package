# Hệ thống Đánh giá Nhân viên — Employee Evaluation System

> **Triết lý cốt lõi:** Không chờ công nghệ để bắt đầu. Framework đánh giá phải "flat" và "tao nhã" — một khung duy nhất áp được cho mọi phòng ban, mọi loại công việc, với khả năng tích hợp side-by-side cùng CRM/ERP có sẵn.

## Bối cảnh

Đây là bản thiết kế hệ thống đánh giá nhân viên được xây dựng từ yêu cầu thực tế: nhà quản lý đã nắm 70-80% hiệu quả nhân viên qua quan sát hàng ngày, phần còn lại có thể khách quan hóa bằng dữ liệu vận hành sẵn có (đơn giao, đơn nhập, đơn lắp đặt, km, phản hồi khách hàng). Vấn đề không phải là thiếu công nghệ — mà là thiếu khung có cấu trúc để tập hợp những dữ liệu này lại và đưa ra xếp hạng công bằng.

Hệ thống được thiết kế để:

- **Triển khai được ngay** với Excel/Sheets nếu chưa có software, nhưng có sẵn data model phần mềm khi muốn scale
- **Bao phủ mọi phòng ban** đặc thù khác nhau (Giao hàng, Kho, Bảo hành, Kế toán...) qua cùng một framework
- **Tích hợp với CRM/ERP có sẵn** qua REST API — không bắt công ty phải thay đổi hệ thống nghiệp vụ chính
- **Phiên bản hoá** (versioning) để template đánh giá thay đổi theo thời gian mà vẫn giữ lịch sử kiểm chứng

## Cấu trúc thư mục

```
eval_system_package/
├── README.md                          # File này
├── docs/
│   ├── 01-triet-ly-va-khung-danh-gia.md       # Triết lý + khung 3 trụ cột
│   ├── 02-template-va-versioning.md           # Cách template hoạt động
│   ├── 03-su-vu-va-ghi-nhan.md                # Module sự vụ / incidents
│   ├── 04-khai-quat-hoa-cong-viec.md          # Work Unit catalog + điểm công
│   ├── 05-tich-hop-crm-erp.md                 # Side-by-side integration
│   └── 06-campaign-kich-hoat-tinh-than.md     # Campaign + peer recognition
├── spec/
│   ├── data-model.md                  # Đặc tả data model (entities + relationships)
│   ├── api-specification.md           # REST API contract đầy đủ
│   └── business-rules.md              # Quy tắc nghiệp vụ, tính điểm, validation
└── artifacts/
    ├── evaluation_template_system.jsx # Artifact chính: Template + Sự vụ + Work Logs + Scorecard
    └── api_integration_design.jsx     # Artifact API: Endpoints + Playground + Logs + Security
```

## Đọc gì trước?

**Nếu bạn là Product Owner / Quản lý:**
1. `docs/01-triet-ly-va-khung-danh-gia.md` — hiểu why
2. `docs/04-khai-quat-hoa-cong-viec.md` — hiểu cách mô hình hóa công việc đặc thù
3. `docs/06-campaign-kich-hoat-tinh-than.md` — hiểu cách kích hoạt tinh thần đội ngũ theo dịp
4. Chạy artifact `artifacts/evaluation_template_system.jsx` để thấy UI

**Nếu bạn là Developer Backend:**
1. `spec/data-model.md` — entities, relationships, fields
2. `spec/api-specification.md` — 4 endpoints cần implement
3. `spec/business-rules.md` — logic tính điểm, validation, idempotency
4. Chạy artifact `artifacts/api_integration_design.jsx` để thấy contract + playground

**Nếu bạn là Developer Frontend:**
1. Hai artifact JSX trong `artifacts/` là reference implementation
2. `docs/02-template-va-versioning.md` + `docs/03-su-vu-va-ghi-nhan.md` cho logic UI

**Nếu bạn là Integration Engineer (phía CRM/ERP):**
1. `docs/05-tich-hop-crm-erp.md` — tổng quan side-by-side
2. `spec/api-specification.md` — contract đầy đủ
3. Chạy artifact `artifacts/api_integration_design.jsx` để test payload

## Kiến trúc tổng quan

```
┌─────────────────────┐         webhook          ┌──────────────────────┐
│                     │  POST /work-events       │                      │
│   CRM / ERP         │─────────────────────────▶│  Evaluation System   │
│  (system of record) │  POST /incidents         │  (system of          │
│                     │◀─────────────────────────│    aggregation)      │
│  - đơn hàng         │  GET  /scorecard         │                      │
│  - công việc        │                          │  - điểm công         │
│  - khiếu nại        │                          │  - sự vụ             │
│                     │                          │  - bảng điểm         │
└─────────────────────┘                          └──────────────────────┘
```

## Triết lý đánh giá: Khung 3 Trụ Cột

Mọi nhân viên ở mọi phòng đều được đánh giá theo cùng một khung:

| Trụ cột | Trọng số mặc định | Nguồn dữ liệu |
|---------|-------------------|---------------|
| **Kết quả định lượng** | 50% | Work logs (tự động từ CRM/ERP) |
| **Chất lượng & Thái độ** | 30% | Đánh giá 360° (QL + đồng nghiệp + phòng liên quan) |
| **Phản hồi & Sự cố** | 20% | Events (khách khen/phàn nàn, sự cố, sáng kiến) |

Trọng số có thể điều chỉnh theo phòng ban, nhưng khung 3 trụ cột là bất biến — tạo tính "flat" và công bằng xuyên tổ chức.

## Bổ sung: Campaign — Kích hoạt tinh thần theo dịp

Hệ thống 3 trụ cột chạy ổn định tháng/quý, nhưng thiếu cao trào. **Campaign** bổ sung cơ chế **event-based motivation**:

- Chạy **theo dịp** (cao điểm, mục tiêu lớn, sau khó khăn), không phải gamification liên tục
- **Mục tiêu tập thể** hoặc **giải thưởng theo chủ đề**, không xếp hạng công khai cá nhân
- **Reward tách biệt** khỏi lương cơ bản — chỉ là "gia vị", không phải "bữa chính"
- Tận dụng dữ liệu sẵn có (work logs, events), không cần nhập liệu thêm

5 loại campaign: Team Goal, Individual Awards, Recognition Week, Milestone Celebration, Skill Challenge. Xem chi tiết ở `docs/06-campaign-kich-hoat-tinh-than.md`.

## Quick start cho developer

1. Đọc `spec/data-model.md` để hiểu entities
2. Cài stack (Node/Python/Go/... tuỳ chọn), tạo schema theo `spec/data-model.md`
3. Implement 4 endpoints theo `spec/api-specification.md`
4. Frontend: dùng 2 artifact JSX làm reference, hoặc build lại theo ý muốn
5. Test integration bằng playground trong `artifacts/api_integration_design.jsx`

## Nguyên tắc không được phá vỡ

1. **Khung 3 trụ cột** — không thêm trụ cột thứ 4, không bỏ trụ cột nào
2. **External ID là trái tim** — mọi tham chiếu cross-system qua external_id, không qua tên
3. **Idempotent APIs** — gửi cùng event 10 lần = 1 lần
4. **Published version không sửa** — chỉ tạo version mới
5. **Sự vụ luôn có reporter** — không ẩn danh, chống vu khống
6. **Không blocking trong integration** — CRM không đợi Eval System
7. **Campaign là bonus, không phải base pay** — reward campaign không tích hợp vào hệ thống lương
8. **Campaign phải có ending ritual** — không được close campaign mà không có buổi tổng kết
9. **Không shame-based motivation** — không leaderboard public bottom, không so sánh trực tiếp NV với NV
