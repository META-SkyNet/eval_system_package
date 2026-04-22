# Hệ thống Đánh giá Nhân viên — Employee Evaluation System

> **Triết lý cốt lõi:** Không chờ công nghệ để bắt đầu. Framework đánh giá phải "flat" và "tao nhã" — cùng một ngôn ngữ áp được cho mọi phòng ban, mọi loại công việc, với khả năng tích hợp side-by-side cùng CRM/ERP có sẵn.

## Bối cảnh

Đây là bản thiết kế hệ thống đánh giá nhân viên được xây dựng từ yêu cầu thực tế: nhà quản lý đã nắm 70-80% hiệu quả nhân viên qua quan sát hàng ngày, phần còn lại có thể khách quan hóa bằng dữ liệu vận hành sẵn có (đơn giao, đơn nhập, đơn lắp đặt, km, phản hồi khách hàng). Vấn đề không phải là thiếu công nghệ — mà là thiếu khung có cấu trúc để tập hợp những dữ liệu này lại và đưa ra xếp hạng công bằng.

Hệ thống được thiết kế để:

- **Triển khai được ngay** với Excel/Sheets nếu chưa có software, nhưng có sẵn data model phần mềm khi muốn scale
- **Bao phủ mọi phòng ban** đặc thù khác nhau (Giao hàng, Kho, Bảo hành, Kế toán...) qua cùng một framework
- **Tích hợp với CRM/ERP có sẵn** qua REST API — không bắt công ty phải thay đổi hệ thống nghiệp vụ chính
- **Phiên bản hoá** (versioning) để template đánh giá thay đổi theo thời gian mà vẫn giữ lịch sử kiểm chứng
- **AI chấm điểm hỗ trợ** — gắn tiêu chí vào từng loại công việc để AI đọc JSON nghiệp vụ và đánh giá, với QL review trước khi tính điểm

## Cấu trúc thư mục

```
eval_system_package/
├── README.md                                    # File này
├── docs/
│   ├── 01-triet-ly-va-khung-danh-gia.md        # Triết lý + Standard Pillar Library
│   ├── 02-template-va-versioning.md            # Cách template hoạt động
│   ├── 03-su-vu-va-ghi-nhan.md                 # Module sự vụ / incidents
│   ├── 04-khai-quat-hoa-cong-viec.md           # Work Unit catalog + điểm công
│   ├── 05-tich-hop-crm-erp.md                  # Side-by-side integration
│   ├── 06-campaign-kich-hoat-tinh-than.md      # Campaign + peer recognition
│   └── 07-ai-evaluation-va-criteria.md         # AI chấm điểm từ JSON nghiệp vụ
├── spec/
│   ├── data-model.md                           # Entities, relationships, constraints
│   ├── api-specification.md                    # REST API contract đầy đủ
│   ├── business-rules.md                       # Logic nghiệp vụ, tính điểm, validation
│   └── schema.sql                              # PostgreSQL DDL — chạy trực tiếp
└── artifacts/
    ├── evaluation_template_system.jsx           # UI admin: Template, Work Logs, Scorecard
    └── api_integration_design.jsx              # UI developer: API docs, playground
```

### Docs — Triết lý & Thiết kế

| File | Nội dung |
|------|----------|
| [01 — Triết lý & Standard Pillar Library](docs/01-triet-ly-va-khung-danh-gia.md) | Why của hệ thống, N-pillar linh hoạt, so sánh OKR/BSC |
| [02 — Template & Versioning](docs/02-template-va-versioning.md) | Cách template hoạt động, version lifecycle |
| [03 — Sự vụ & Ghi nhận](docs/03-su-vu-va-ghi-nhan.md) | Module incidents, event categories, trạng thái |
| [04 — Khái quát hóa Công việc](docs/04-khai-quat-hoa-cong-viec.md) | Work Unit catalog, điểm công, đa phòng ban |
| [05 — Tích hợp CRM/ERP](docs/05-tich-hop-crm-erp.md) | Side-by-side integration pattern |
| [06 — Campaign & Peer Recognition](docs/06-campaign-kich-hoat-tinh-than.md) | Event-based motivation, giới hạn đạo đức |
| [07 — AI Evaluation & Criteria](docs/07-ai-evaluation-va-criteria.md) | AI chấm điểm từ JSON nghiệp vụ, criteria versioning, pilot workflow |

### Spec — Kỹ thuật

| File | Nội dung |
|------|----------|
| [data-model.md](spec/data-model.md) | Entities, relationships, constraints, scoring formula |
| [api-specification.md](spec/api-specification.md) | REST API contract, request/response, error codes |
| [business-rules.md](spec/business-rules.md) | Idempotency, event lifecycle, validation, AI evaluation rules |
| [schema.sql](spec/schema.sql) | PostgreSQL DDL — chạy trực tiếp để tạo database |

## Đọc gì trước?

**Nếu bạn là Product Owner / Quản lý:**
1. [Triết lý & Standard Pillar Library](docs/01-triet-ly-va-khung-danh-gia.md) — hiểu why, N-pillar linh hoạt
2. [Khái quát hóa Công việc](docs/04-khai-quat-hoa-cong-viec.md) — cách mô hình hóa công việc đặc thù
3. [Campaign & Peer Recognition](docs/06-campaign-kich-hoat-tinh-than.md) — kích hoạt tinh thần đội ngũ theo dịp
4. [AI Evaluation & Criteria](docs/07-ai-evaluation-va-criteria.md) — cách viết tiêu chí để AI chấm điểm
5. Chạy artifact [`artifacts/evaluation_template_system.jsx`](artifacts/evaluation_template_system.jsx) để thấy UI

**Nếu bạn là Developer Backend:**
1. [data-model.md](spec/data-model.md) — entities, relationships, fields
2. [schema.sql](spec/schema.sql) — PostgreSQL DDL, chạy trực tiếp
3. [api-specification.md](spec/api-specification.md) — endpoints cần implement
4. [business-rules.md](spec/business-rules.md) — logic tính điểm, validation, idempotency, AI rules
5. Chạy artifact [`artifacts/api_integration_design.jsx`](artifacts/api_integration_design.jsx) để thấy contract + playground

**Nếu bạn là Developer Frontend:**
1. Hai artifact JSX là reference implementation: [`evaluation_template_system.jsx`](artifacts/evaluation_template_system.jsx), [`api_integration_design.jsx`](artifacts/api_integration_design.jsx)
2. [Template & Versioning](docs/02-template-va-versioning.md) + [Sự vụ & Ghi nhận](docs/03-su-vu-va-ghi-nhan.md) cho logic UI

**Nếu bạn là Integration Engineer (phía CRM/ERP):**
1. [Tích hợp CRM/ERP](docs/05-tich-hop-crm-erp.md) — tổng quan side-by-side
2. [api-specification.md](spec/api-specification.md) — contract đầy đủ
3. Chạy artifact [`artifacts/api_integration_design.jsx`](artifacts/api_integration_design.jsx) để test payload

**Nếu bạn implement AI Evaluation Engine:**
1. [AI Evaluation & Criteria](docs/07-ai-evaluation-va-criteria.md) — triết lý, cấu trúc criteria, ví dụ 3 phòng
2. [data-model.md](spec/data-model.md) phần `EvaluationCriteria`, `AIEvaluation`
3. [business-rules.md](spec/business-rules.md) mục 15 — AI evaluation lifecycle, accuracy phase

## Kiến trúc tổng quan

```
┌─────────────────────┐    POST /work-events      ┌──────────────────────────┐
│                     │──────────────────────────▶│                          │
│   CRM / ERP         │    POST /incidents        │   Evaluation System      │
│  (system of record) │──────────────────────────▶│   (system of             │
│                     │◀──────────────────────────│    aggregation)          │
│  - đơn hàng         │    GET  /scorecard        │                          │
│  - công việc        │                           │  - work logs + điểm công │
│  - khiếu nại        │    POST /ai-evaluations   │  - sự vụ & ghi nhận      │
│                     │──────────────────────────▶│  - bảng điểm             │
└─────────────────────┘                           │  - campaign & recognition│
                                                  │  - AI evaluation         │
┌─────────────────────┐                           └──────────────────────────┘
│  Chat / Agent AI    │    POST /ai-evaluations              │
│  (Zalo, Facebook,   │──────────────────────────────────────┘
│   nội bộ)           │
└─────────────────────┘
```

## Triết lý đánh giá: Standard Pillar Library

Mọi nhân viên ở mọi phòng đều được đánh giá theo cùng **ngôn ngữ** — bộ Standard Pillar Library. Mỗi template phòng chọn 2–6 pillar từ library đó, tự quyết trọng số (tổng = 100%).

**Default set (phòng mới dùng mặc định):**

| Pillar | Trọng số mặc định | Nguồn dữ liệu |
|--------|-------------------|---------------|
| **Kết quả định lượng** | 50% | Work logs (tự động từ CRM/ERP) |
| **Chất lượng & Thái độ** | 30% | Đánh giá 360° (QL + đồng nghiệp + phòng liên quan) |
| **Phản hồi & Sự cố** | 20% | Events (khách khen/phàn nàn, sự cố, sáng kiến) |

**Library đầy đủ (phòng đặc thù có thể chọn thêm hoặc thay thế):**

| Pillar ID | Tên | Phù hợp với |
|-----------|-----|-------------|
| `QUANTITATIVE` | Kết quả định lượng | Giao hàng, Kho, Bảo hành, Kế toán |
| `QUALITY_360` | Chất lượng & Thái độ | Mọi phòng |
| `FEEDBACK` | Phản hồi & Sự cố | Phòng tiếp xúc khách |
| `SKILL_MASTERY` | Năng lực chuyên môn | Kỹ thuật, Bảo hành |
| `COMPLIANCE` | Tuân thủ & An toàn | An toàn lao động, Tài chính |
| `LEARNING` | Đào tạo & Phát triển | Mọi phòng muốn đo learning |
| `INNOVATION` | Sáng kiến & Cải tiến | R&D, kỹ thuật cấp cao |

Xem chi tiết và so sánh với OKR/Balanced Scorecard tại [docs/01](docs/01-triet-ly-va-khung-danh-gia.md).

## Bổ sung: Campaign — Kích hoạt tinh thần theo dịp

Hệ thống pillar chạy ổn định tháng/quý, nhưng thiếu cao trào. **Campaign** bổ sung cơ chế **event-based motivation**:

- Chạy **theo dịp** (cao điểm, mục tiêu lớn, sau khó khăn), không phải gamification liên tục
- **Mục tiêu tập thể** hoặc **giải thưởng theo chủ đề**, không xếp hạng công khai cá nhân
- **Reward tách biệt** khỏi lương cơ bản — chỉ là "gia vị", không phải "bữa chính"
- Tận dụng dữ liệu sẵn có (work logs, events), không cần nhập liệu thêm

5 loại campaign: Team Goal, Individual Awards, Recognition Week, Milestone Celebration, Skill Challenge. Xem chi tiết tại [docs/06](docs/06-campaign-kich-hoat-tinh-than.md).

## Bổ sung: AI Evaluation — Chấm điểm từ JSON nghiệp vụ

Mỗi loại công việc có thể gắn một bộ **tiêu chí đánh giá** (Evaluation Criteria) để AI đọc JSON từ hệ thống nghiệp vụ và chấm điểm tự động:

- QL viết tiêu chí bằng ngôn ngữ nghiệp vụ — AI tự dịch thành logic chấm
- AI tạo WorkLog và Event ở trạng thái `pending` — **QL review trước khi tính điểm**
- Criteria có versioning — thay đổi tiêu chí không ảnh hưởng lịch sử đã chấm
- Pilot workflow 3 giai đoạn: Observation → Calibration → Production

Xem chi tiết tại [docs/07](docs/07-ai-evaluation-va-criteria.md).

## Quick start cho developer

1. Đọc [data-model.md](spec/data-model.md) để hiểu entities
2. Chạy [schema.sql](spec/schema.sql) để tạo PostgreSQL database
3. Implement endpoints theo [api-specification.md](spec/api-specification.md)
4. Áp dụng logic từ [business-rules.md](spec/business-rules.md) — idempotency, scoring, validation, AI rules
5. Frontend: dùng 2 artifact JSX làm reference, hoặc build lại theo ý muốn
6. Test integration bằng playground trong [`artifacts/api_integration_design.jsx`](artifacts/api_integration_design.jsx)

## Nguyên tắc không được phá vỡ

1. **Pillar Library là ngôn ngữ chung** — pillar mới phải qua library, không tự đặt tên ngoài library
2. **External ID là trái tim** — mọi tham chiếu cross-system qua external_id, không qua tên
3. **Idempotent APIs** — gửi cùng event 10 lần = 1 lần
4. **Published version không sửa** — chỉ tạo version mới (template, criteria, đều thế)
5. **Sự vụ luôn có reporter** — không ẩn danh, chống vu khống
6. **Không blocking trong integration** — CRM không đợi Eval System
7. **Campaign là bonus, không phải base pay** — reward campaign không tích hợp vào hệ thống lương
8. **Campaign phải có ending ritual** — không được close campaign mà không có buổi tổng kết
9. **Không shame-based motivation** — không leaderboard public bottom, không so sánh trực tiếp NV với NV
10. **AI không tự confirm** — mọi AI evaluation ở pending, QL review trước khi tính điểm
11. **Heavy severity luôn manual** — không auto-confirm sự vụ nặng dù accuracy AI cao đến đâu
