# 01 · Triết lý & Khung Đánh giá

## Vấn đề xuất phát

Trong mọi tổ chức có nhiều phòng ban, bài toán đánh giá nhân viên thường gặp hai cực đoan:

**Cực 1 — Cảm tính hoàn toàn.** Quản lý trực tiếp "chấm" dựa trên cảm nhận. Ưu điểm: nhanh, bắt được tinh thần. Nhược điểm: thiên vị, không minh bạch, nhân viên không hiểu tại sao mình được/không được tăng lương.

**Cực 2 — Chờ hệ thống "khoa học".** Đợi IT build dashboard, đợi AI phân tích, đợi quy trình chuẩn. Kết quả: chờ mãi không ra, thời điểm vàng trôi qua (đặc biệt lúc cao điểm như nắng nóng, mùa lễ).

Triết lý hệ thống này nằm ở giữa: **quản lý đã nắm 70-80% bức tranh bằng cảm nhận — phần 20-30% còn lại có thể khách quan hóa ngay bằng dữ liệu vận hành sẵn có, không cần chờ ai.**

## Khung đánh giá: Standard Pillar Library

### Tại sao không phải "3 trụ cột cứng"?

Thiết kế ban đầu dùng đúng 3 trụ cột cố định. Đó là heuristic tốt cho phần lớn trường hợp, nhưng có những vấn đề thực tế:

- **Đội an toàn lao động / kiểm soát nội bộ**: công việc chính là *ngăn chặn* sự cố — "định lượng" gần như vô nghĩa với họ
- **Đội R&D / sáng tạo**: "định lượng" mờ; tác động của một ý tưởng không đếm được bằng số đơn
- **Đội bán hàng đã có commission**: phần định lượng đã được trả bằng tiền trực tiếp — template chỉ cần 2 trụ cột còn lại
- **Buộc phải "nhét" chỉ số không tự nhiên**: "Tay nghề kỹ thuật" ép vào Pillar Chất lượng là thoả hiệp, không phải thiết kế

Giải pháp: thay vì cứng 3, tổ chức duy trì một **Standard Pillar Library** — bộ định nghĩa trụ cột dùng chung. Mỗi template phòng *chọn* 2–6 pillar từ library đó, tự quyết trọng số, miễn tổng = 100%.

Tính "flat" và "tao nhã" được giữ bằng cách khác: **dùng cùng ngôn ngữ** (cùng library), không phải cùng số lượng.

### Standard Pillar Library (mặc định của hệ thống)

| ID | Tên | Nguồn dữ liệu | Phù hợp với |
|----|-----|--------------|-------------|
| `QUANTITATIVE` | Kết quả định lượng | Work logs (tự động từ CRM/ERP) | Giao hàng, Kho, Bảo hành, Kế toán |
| `QUALITY_360` | Chất lượng & Thái độ | Đánh giá 360° (form) | Mọi phòng |
| `FEEDBACK` | Phản hồi & Sự cố | Module Sự vụ | Mọi phòng tiếp xúc khách |
| `SKILL_MASTERY` | Năng lực chuyên môn | 360° hoặc manual | Kỹ thuật, Bảo hành, IT |
| `COMPLIANCE` | Tuân thủ quy trình & An toàn | Audit checklist / sự vụ | An toàn lao động, Tài chính |
| `LEARNING` | Đào tạo & Phát triển | Manual (QL nhập) | Mọi phòng muốn đo learning |
| `INNOVATION` | Sáng kiến & Cải tiến | Sự vụ (initiative) + manual | R&D, kỹ thuật cấp cao |

**Default set cho phòng mới:** `QUANTITATIVE (50%) + QUALITY_360 (30%) + FEEDBACK (20%)` — đây là "3 trụ cột" ban đầu, nhưng giờ là *mặc định*, không phải *bắt buộc*.

### Ví dụ template theo từng loại phòng

**Phòng Giao hàng** (3 pillar, default):
- QUANTITATIVE 50% — số đơn, km, tỷ lệ đúng giờ
- QUALITY_360 30% — thái độ, tác phong, hợp tác
- FEEDBACK 20% — khách khen/phàn nàn, sự cố

**Đội An toàn lao động** (2 pillar):
- COMPLIANCE 60% — tuân thủ checklist an toàn, số lần vi phạm
- QUALITY_360 40% — thái độ huấn luyện, phản hồi từ phòng ban

**Đội Kỹ thuật / Bảo hành** (4 pillar):
- QUANTITATIVE 35% — số ca xử lý, tỷ lệ sửa tại chỗ
- SKILL_MASTERY 25% — tay nghề, đánh giá kỹ thuật
- QUALITY_360 25% — thái độ, giao tiếp khách
- FEEDBACK 15% — phản hồi khách sau bảo hành

**Đội Bán hàng** (2 pillar — commission đã cover phần định lượng):
- QUALITY_360 55% — thái độ, quy trình tư vấn
- COMPLIANCE 45% — tuân thủ quy trình báo giá, CRM

### Governance: Ai được thêm pillar vào library?

Đây là câu hỏi quan trọng nhất khi triển khai N-pillar. Gợi ý:

- **HR / Ban điều hành** phê duyệt pillar mới vào library (tránh mỗi phòng tự đặt tên lung tung)
- **QL phòng** chọn pillar từ library và set trọng số cho template của mình
- **Pillar tuỳ chỉnh** (ngoài library chuẩn) chỉ cho phép với quyền admin, và phải có lý do rõ ràng

Cơ chế này đảm bảo: linh hoạt ở cấp template, nhưng vẫn có "ngôn ngữ chung" ở cấp tổ chức.

---

## Ba loại nguồn dữ liệu

Dù có bao nhiêu pillar, dữ liệu chỉ đến từ 4 nguồn:

| Nguồn | Mô tả | Dùng cho |
|-------|-------|----------|
| `quantitative` | Tổng hợp từ work logs (tự động) | QUANTITATIVE |
| `qualitative_360` | Form đánh giá chéo (manual, có thể là Google Form) | QUALITY_360, SKILL_MASTERY |
| `event_driven` | Tổng hợp từ sự vụ confirmed | FEEDBACK, COMPLIANCE (một phần), INNOVATION |
| `manual` | QL nhập trực tiếp điểm số | LEARNING, và bất kỳ pillar nào chưa có data source tự động |

Mỗi pillar definition trong library khai báo `data_source` của nó. Khi tính điểm, hệ thống biết cần lấy dữ liệu từ đâu.

---

## So sánh với OKR và Balanced Scorecard

### OKR (Objectives & Key Results)

OKR là công cụ **định hướng chiến lược** — xác định *cái gì cần làm* và đặt mục tiêu đo được.

| | OKR | Hệ thống này |
|---|-----|-------------|
| **Mục đích** | Alignment chiến lược, đặt mục tiêu | Đánh giá hiệu suất cá nhân |
| **Chu kỳ** | Quarterly, có thể annual | Monthly + quarterly |
| **Đơn vị** | Team / org-level chủ yếu | Cá nhân |
| **Khi nào dùng** | "Chúng ta cần đạt gì?" | "Anh ấy làm tốt đến đâu?" |
| **Điểm yếu** | Không đo *cách* làm, không bắt được thái độ | Không aspirational, không link trực tiếp với chiến lược |

**Kết luận:** OKR và hệ thống này **bổ sung, không thay thế nhau**. OKR đặt hướng đi cho phòng/tổ chức; hệ thống này đánh giá cá nhân thực thi như thế nào. Nhiều công ty dùng cả hai: OKR cho chiến lược, scorecard kiểu này cho đánh giá cá nhân định kỳ.

*Rủi ro nếu chỉ dùng OKR để đánh giá cá nhân:* KR của team không đạt → khó quy trách nhiệm công bằng cho từng người vì KR thường là tập thể. Hệ thống này giải quyết đúng điểm đó: granularity cá nhân, traceable.

### Balanced Scorecard (Kaplan-Norton)

BSC dùng 4 perspectives: Financial, Customer, Internal Process, Learning & Growth.

| | BSC | Hệ thống này |
|---|-----|-------------|
| **Thiết kế cho** | Quản trị tổ chức (org-level) | Đánh giá nhân viên (individual) |
| **Granularity** | KPI phòng/công ty | Work log, sự vụ từng người |
| **Nguồn dữ liệu** | Báo cáo tài chính, survey | CRM/ERP, form 360°, sự vụ |
| **Cập nhật** | Quarterly / annually | Real-time (work logs) + monthly |

BSC là cảm hứng thiết kế (tư duy "multi-perspective"), nhưng hệ thống này hoạt động ở tầng thấp hơn nhiều — individual contributor, không phải strategic management unit.

### Tóm lại: Khi nào dùng cái gì?

```
Chiến lược tổ chức → OKR
Quản trị phòng/BU  → Balanced Scorecard
Đánh giá cá nhân   → Hệ thống này (Pillar Library + Work Logs + Events)
```

## Quy trình vận hành hàng tháng / hàng quý

### Hàng tháng

**Cuối tháng, QL trực tiếp (1-2 tiếng):**
1. Mở dữ liệu work logs + events — hầu hết đã có sẵn
2. Chấm Trụ cột 1 (định lượng) từ số liệu
3. Chấm Trụ cột 3 (phản hồi/sự cố) từ events đã xác nhận
4. Tổng hợp sơ bộ, đề xuất điều chỉnh thu nhập

### Hàng quý

**Chạy thêm các pillar dạng 360° / manual:**
1. Gửi form đánh giá chéo (Google Form hoặc trong phần mềm) cho phòng liên quan, 2-3 ngày điền
2. Tổng hợp bằng Sheets hoặc hệ thống
3. Kết hợp tất cả pillar theo trọng số → xếp hạng A/B/C/D
4. Quyết định tăng lương, thưởng, cảnh báo

**Tổng thời gian công sức quản lý:** 1-2 tiếng/tháng + nửa ngày/quý.

## Rào cản thực tế cần nhận diện

Nếu khung này đã khả thi trong vài tiếng, rào cản thực sự không phải là kỹ thuật mà là:

1. **Thẩm quyền** — QL trực tiếp có quyền quyết lương không, hay phải qua nhiều tầng?
2. **Đồng thuận giữa các QL** — các phòng khác có cùng thực hiện không, hay mình lẻ loi?
3. **Ngân sách cho điều chỉnh** — có ngân sách để tăng lương cho nhân viên xếp hạng A không?

Mỗi rào cản sẽ có cách xử lý khác nhau. Nhận diện đúng rào cản sẽ quyết định ai cần được thuyết phục trước.

## Đọc tiếp

- [02-template-va-versioning.md](02-template-va-versioning.md) — cách biểu diễn pillar library thành template có thể phiên bản hoá
- [04-khai-quat-hoa-cong-viec.md](04-khai-quat-hoa-cong-viec.md) — cách mô hình hóa "1 đơn giao" vs "1 ca bảo hành kéo dài 3 ngày"
