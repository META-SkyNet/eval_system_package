# CLAUDE.md — Context cho Claude Code

Đây là project **Hệ thống Đánh giá Nhân viên** (Employee Evaluation System) — dự án nội bộ Việt Nam, ngôn ngữ giao tiếp là Tiếng Việt.

## Project overview

Hệ thống đánh giá nhân viên đa phòng ban, tích hợp side-by-side với CRM/ERP có sẵn qua REST API. Hiện đang ở giai đoạn **design-complete**, chưa có code production.

## Đã có gì

- `README.md` — tổng quan dự án, cấu trúc thư mục, quick start theo role
- `docs/` — 7 file markdown mô tả triết lý, thiết kế, framework (tiếng Việt):
  - 01: Triết lý & Standard Pillar Library (N trụ cột linh hoạt, default là 3)
  - 02: Template & versioning
  - 03: Sự vụ & ghi nhận
  - 04: Work Unit catalog (khái quát hóa công việc đặc thù)
  - 05: Tích hợp CRM/ERP side-by-side
  - 06: Campaign — kích hoạt tinh thần theo dịp (peer recognition, team goal, awards)
  - 07: AI Evaluation & Criteria — AI chấm điểm từ JSON nghiệp vụ, pilot workflow
- `spec/` — 4 file đặc tả kỹ thuật:
  - `data-model.md` — entities, relationships, constraints, scoring formula
  - `api-specification.md` — REST API contract đầy đủ
  - `business-rules.md` — logic validation, idempotency, scoring, AI evaluation rules
  - `schema.sql` — PostgreSQL DDL đầy đủ, ready to run
- `artifacts/` — 2 file React JSX, là **reference implementation** của UI:
  - `evaluation_template_system.jsx` — UI admin (template, catalog, work logs, events, scorecard)
  - `api_integration_design.jsx` — UI developer (API docs, playground, integration logs)

## Chưa có gì

- Backend code (implement endpoints trong `spec/api-specification.md`)
- AI Evaluation Engine (logic gọi AI API, build prompt từ criteria, parse result)
- Deployment config
- Frontend hoàn chỉnh ngoài 2 artifact reference
- Test suite

## Nếu được yêu cầu...

### "Implement backend"

Đọc theo thứ tự:
1. `spec/data-model.md` — entities, relationships, constraints
2. `spec/schema.sql` — chạy trực tiếp để tạo PostgreSQL database
3. `spec/api-specification.md` — endpoints cần implement
4. `spec/business-rules.md` — logic validation, idempotency, scoring, AI evaluation

Khuyên dùng: Node.js + Express/Fastify hoặc Python + FastAPI, Postgres, Redis cho rate limiting + distributed lock.

### "Implement AI Evaluation Engine"

Đọc theo thứ tự:
1. `docs/07-ai-evaluation-va-criteria.md` — triết lý, cấu trúc criteria, ví dụ 3 phòng
2. `spec/data-model.md` phần `EvaluationCriteria`, `ScoringRule`, `AIEvaluation`
3. `spec/api-specification.md` phần "Nhóm endpoints: AI Evaluation"
4. `spec/business-rules.md` mục 15

Luồng cốt lõi: load criteria (active version) → validate input_schema → build AI prompt → call AI API → parse result → tạo WorkLog + Event (status = `pending_review`) → QL review.

### "Build frontend"

Dùng 2 artifact JSX làm reference. Stack: React + TailwindCSS + Lucide icons, giống trong artifact. Nếu dùng framework khác (Vue, Svelte), vẫn bám theo UX flow trong artifact.

### "Giải thích design decision nào đó"

Đọc `docs/` để hiểu triết lý. Mỗi quyết định thiết kế đều có lý do được ghi rõ trong docs.

### "Mở rộng feature mới"

Trước khi thêm, kiểm tra "Nguyên tắc không được phá vỡ" trong `README.md`. Feature mới phải tương thích với các nguyên tắc: Pillar Library là ngôn ngữ chung, idempotent API, version immutability, AI là trợ lý không phải giám khảo.

## Terminology (Tiếng Việt ↔ English)

| Tiếng Việt | English | Ghi chú |
|-----------|---------|---------|
| Trụ cột | Pillar | 2–6 pillars/template, chọn từ Standard Pillar Library |
| Thư viện trụ cột | Pillar Library | Bộ định nghĩa pillar dùng chung toàn tổ chức |
| Sự vụ | Event / Incident | Khen, phàn nàn, sự cố, sáng kiến... |
| Loại công việc | Work Unit Type | Đơn vị trong catalog của phòng |
| Điểm công | Work Points / Effort Points | Độ nặng của 1 loại công việc |
| Bảng điểm | Scorecard | Tổng hợp điểm của NV trong kỳ |
| Phòng ban | Department | |
| Nhân viên | Employee | |
| Chiến dịch | Campaign | Event-based motivation (VD: "Chiến dịch Mùa hè") |
| Lời cảm ơn | Peer Recognition | NV gửi kudos cho đồng nghiệp |
| Giải thưởng | Award | Hạng mục trong individual_awards campaign |
| Mục tiêu đội | Team Goal | Trong team_goal campaign |
| Tuần lễ ghi nhận | Recognition Week | Loại campaign |
| Ăn mừng cột mốc | Milestone Celebration | Loại campaign |
| Thử thách kỹ năng | Skill Challenge | Loại campaign |
| Buổi tổng kết | Ending Ritual | Bắt buộc khi close campaign |
| Tiêu chí AI | Evaluation Criteria | JSON ruleset gắn với WorkUnitType để AI chấm |
| Chấm điểm AI | AI Evaluation | Kết quả AI chấm một công việc, luôn ở pending |
| Dấu hiệu bất thường | Red Flag | Pattern AI phát hiện, cần human review riêng |

## Coding conventions (nếu triển khai)

- Comments trong code có thể dùng tiếng Việt hoặc Anh, nhưng identifiers (tên biến, function) **dùng tiếng Anh**
- Error messages trả về qua API: **tiếng Việt** (end user là VN)
- Error codes (STRING_CODE): **tiếng Anh uppercase** (developer-facing)

## Nguyên tắc khi modify artifacts

Hai file JSX trong `artifacts/` đã được test kỹ, persistent storage hoạt động tốt. Khi chỉnh sửa:

1. Đừng đổi schema trong `STORAGE_KEY` mà không có migration — sẽ mất dữ liệu test của user
2. Giữ design system (font Fraunces + Inter + JetBrains Mono, màu stone/emerald/amber)
3. Không thêm localStorage — storage duy nhất là `window.storage` API

## Context hội thoại

Dự án bắt đầu từ bức xúc của một QL: "Tại sao phải chờ công nghệ? Chúng ta đã có đủ dữ liệu rồi!" — triết lý của toàn bộ hệ thống là **cho phép bắt đầu ngay** với dữ liệu sẵn có, phần mềm chỉ là công cụ hỗ trợ, không phải điều kiện tiên quyết.

Khi trao đổi với user về dự án này, nhớ giữ tinh thần đó: **thực dụng, tránh over-engineering, ưu tiên triển khai được sớm**.

## Cảnh báo về Campaign module

Module Campaign (`docs/06`) áp dụng "dopamine mechanics" theo kiểu event-based, có nguy cơ bị **lạm dụng** thành gamification độc hại. Các ranh giới đã được ghi rõ trong doc 06:

- **KHÔNG** dùng public leaderboard real-time hiển thị bottom
- **KHÔNG** dùng variable reward schedule kiểu slot machine
- **KHÔNG** spam notifications
- **KHÔNG** gắn Campaign reward vào base pay
- **KHÔNG** gamify việc nghiêm túc (tai nạn lao động, khiếu nại)
- **KHÔNG** shame-based motivation

Nếu user yêu cầu mở rộng Campaign theo hướng vi phạm các ranh giới này, **cảnh báo cho user về rủi ro** trước khi implement. Đặc biệt trong context lao động vận hành (giao hàng, kho, lắp đặt, bảo hành), gamification sai cách có thể dẫn đến tai nạn thật — NV vì chạy theo KPI mà bỏ qua an toàn, giấu sự cố để giữ streak.

## Cảnh báo về AI Evaluation module

Module AI Evaluation (`docs/07`) cho phép AI chấm điểm công việc từ JSON nghiệp vụ. Các nguyên tắc bất biến:

- **AI không bao giờ tự confirm** kết quả — mọi output đều ở `pending_review`, chờ QL duyệt
- **Không gắn AI evaluation vào lương ngay** — phải có soft launch 1–2 tháng observation trước
- **Criteria phải immutable khi active** — không sửa tiêu chí đang dùng, chỉ tạo version mới
- **NV không được xem scoring_rules chi tiết** — tránh gaming (optimize cho AI thay vì cho công việc thật)
- **Heavy severity luôn manual review** — không auto-confirm dù accuracy cao đến đâu
- **Red flags là alert, không phải event** — human phải quyết định có tạo sự vụ hay không

Nếu user yêu cầu cho AI tự confirm hoặc tự trừ điểm mà không qua QL, **cảnh báo về rủi ro** trước khi implement. AI sai một cách tự tin — sai mà không biết mình sai.
