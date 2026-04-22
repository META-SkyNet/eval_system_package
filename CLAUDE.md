# CLAUDE.md — Context cho Claude Code

Đây là project **Hệ thống Đánh giá Nhân viên** (Employee Evaluation System) — dự án nội bộ Việt Nam, ngôn ngữ giao tiếp là Tiếng Việt.

## Project overview

Hệ thống đánh giá nhân viên đa phòng ban, tích hợp side-by-side với CRM/ERP có sẵn qua REST API. Hiện đang ở giai đoạn **design-complete**, chưa có code production.

## Đã có gì

- `README.md` — tổng quan dự án, cấu trúc thư mục, quick start theo role
- `docs/` — 6 file markdown mô tả triết lý, thiết kế, framework (tiếng Việt):
  - 01: Triết lý & khung 3 trụ cột
  - 02: Template & versioning
  - 03: Sự vụ & ghi nhận
  - 04: Work Unit catalog (khái quát hóa công việc đặc thù)
  - 05: Tích hợp CRM/ERP side-by-side
  - 06: Campaign — kích hoạt tinh thần theo dịp (peer recognition, team goal, awards)
- `spec/` — 3 file đặc tả kỹ thuật: data model, API contract, business rules
- `artifacts/` — 2 file React JSX, là **reference implementation** của UI:
  - `evaluation_template_system.jsx` — UI admin (template, catalog, work logs, events, scorecard)
  - `api_integration_design.jsx` — UI developer (API docs, playground, integration logs)

## Chưa có gì

- Backend code (cần implement 4 endpoints trong `spec/api-specification.md`)
- Database schema concrete (chỉ có data model abstract)
- Deployment config
- Frontend hoàn chỉnh ngoài 2 artifact reference
- Test suite

## Nếu được yêu cầu...

### "Implement backend"

Đọc theo thứ tự:
1. `spec/data-model.md` — entities, relationships, constraints
2. `spec/api-specification.md` — endpoints cần implement
3. `spec/business-rules.md` — logic validation, idempotency, scoring

Khuyên dùng: Node.js + Express/Fastify hoặc Python + FastAPI, Postgres, Redis cho rate limiting + distributed lock.

### "Build frontend"

Dùng 2 artifact JSX làm reference. Stack: React + TailwindCSS + Lucide icons, giống trong artifact. Nếu dùng framework khác (Vue, Svelte), vẫn bám theo UX flow trong artifact.

### "Giải thích design decision nào đó"

Đọc `docs/` để hiểu triết lý. Mỗi quyết định thiết kế đều có lý do được ghi rõ trong docs.

### "Mở rộng feature mới"

Trước khi thêm, kiểm tra "Nguyên tắc không được phá vỡ" trong `README.md`. Một số nguyên tắc là bất biến (khung 3 trụ cột, idempotent API, version immutability). Feature mới phải tương thích với các nguyên tắc này.

## Terminology (Tiếng Việt ↔ English)

| Tiếng Việt | English | Ghi chú |
|-----------|---------|---------|
| Trụ cột | Pillar | 3 trụ cột cố định: Định lượng / Chất lượng 360° / Phản hồi & Sự cố |
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
