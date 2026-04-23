# 01 · Triết lý & Khung Đánh giá

## Vấn đề xuất phát

Trong mọi tổ chức có nhiều phòng ban, bài toán đánh giá nhân viên thường gặp hai cực đoan:

**Cực 1 — Cảm tính hoàn toàn.** Quản lý trực tiếp "chấm" dựa trên cảm nhận. Ưu điểm: nhanh, bắt được tinh thần. Nhược điểm: thiên vị, không minh bạch, nhân viên không hiểu tại sao mình được/không được tăng lương.

**Cực 2 — Chờ hệ thống "khoa học".** Đợi IT build dashboard, đợi AI phân tích, đợi quy trình chuẩn. Kết quả: chờ mãi không ra, thời điểm vàng trôi qua (đặc biệt lúc cao điểm như nắng nóng, mùa lễ).

Triết lý hệ thống này nằm ở giữa: **quản lý đã nắm 70-80% bức tranh bằng cảm nhận — phần 20-30% còn lại có thể khách quan hóa ngay bằng dữ liệu vận hành sẵn có, không cần chờ ai.**

---

## Khung đánh giá: Mô hình file/folder (CriterionTree)

### Tại sao không phải "3 trụ cột cứng"?

Thiết kế ban đầu dùng đúng 3 trụ cột cố định. Đó là heuristic tốt cho phần lớn trường hợp, nhưng thực tế cho thấy có những vấn đề:

- **Đội an toàn lao động / kiểm soát nội bộ**: công việc chính là *ngăn chặn* sự cố — "định lượng" gần như vô nghĩa với họ
- **Đội R&D / sáng tạo**: "định lượng" mờ; tác động của một ý tưởng không đếm được bằng số đơn
- **Đội bán hàng đã có commission**: phần định lượng đã được trả bằng tiền trực tiếp — template chỉ cần 2 tiêu chí còn lại
- **Buộc phải "nhét" chỉ số không tự nhiên**: "Tay nghề kỹ thuật" ép vào một nhóm chung là thoả hiệp, không phải thiết kế

Giải pháp: thay vì giữ một lớp "Pillar Library" bắt buộc, mỗi phòng tự xây **CriterionTree** của mình — một cây tiêu chí theo mô hình file/folder. Cây này có thể copy từ **Preset Library** (bộ mẫu sẵn có) hoặc xây từ đầu.

### Mô hình file/folder

Hãy tưởng tượng tiêu chí đánh giá của một phòng như một cây thư mục:

```
Phòng Giao hàng
├── Folder: Kết quả (weight 50%)
│     ├── File: Số đơn giao (60% | quantitative)
│     └── File: Tỷ lệ đúng hạn (40% | quantitative)
├── Folder: Chất lượng (weight 30%)
│     ├── File: Phản hồi khách (50% | event)
│     └── Folder: Đánh giá 360 (50%)
│           ├── File: QL chấm (70% | qualitative_360)
│           └── File: Đồng nghiệp (30% | qualitative_360)
└── File: Tuân thủ (weight 20% | manual)
```

**Quy tắc:**

- **Folder** (`is_leaf = false`): nhóm tiêu chí, điểm = trung bình có trọng số của con
- **File / Leaf** (`is_leaf = true`): tiêu chí đo thực sự, có `eval_type` xác định nguồn dữ liệu
- **Weight**: % so với anh em cùng cấp (siblings phải cộng lại = 100%)
- **Depth**: tối đa 4 cấp

### Năm loại nguồn dữ liệu (eval_type)

| eval_type | Mô tả | Tự động? |
|-----------|-------|---------|
| `quantitative` | Tính từ work logs (đơn, km, ca...) | Tự động từ CRM/ERP |
| `qualitative_360` | Thu thập qua form đánh giá chéo | Manual (Google Form hoặc tích hợp) |
| `event` | Tổng hợp từ sự vụ confirmed (khen/phàn nàn/sự cố) | Bán tự động |
| `manual` | QL nhập điểm trực tiếp mỗi kỳ | Hoàn toàn manual |
| `ai` | AI chấm từ JSON nghiệp vụ, QL review | Bán tự động |

---

## Preset Library — Thư viện tiêu chí mẫu

**Preset Library là gợi ý, không phải ràng buộc.** Bộ mẫu cung cấp điểm khởi đầu nhanh cho các loại phòng phổ biến:

| Preset | Phù hợp với | Cấu trúc mặc định |
|--------|-------------|-------------------|
| Giao hàng chuẩn | Delivery, logistics | Kết quả (50%) + Chất lượng (30%) + Tuân thủ (20%) |
| Kho chuẩn | Warehouse, nhập/xuất | Kết quả (45%) + Độ chính xác (35%) + An toàn (20%) |
| Bảo hành chuẩn | Kỹ thuật, field service | Kết quả ca (35%) + Tay nghề (25%) + Chất lượng (25%) + Phản hồi (15%) |
| Kế toán chuẩn | Finance, accounting | Độ chính xác (40%) + Tiến độ (30%) + Tuân thủ (20%) + Phát triển (10%) |

**Quy trình sử dụng preset:**

1. QL chọn preset phù hợp
2. Hệ thống clone cây preset thành CriterionTree mới (status = `draft`)
3. QL chỉnh sửa thoải mái: đổi tên, thêm/bớt node, điều chỉnh weight
4. Publish tree khi đã hài lòng

Không có ràng buộc nào bắt phòng phải "chọn từ preset" hay "giải thích lý do custom". Preset chỉ là công cụ tiết kiệm thời gian.

### Khác với Pillar Library cũ như thế nào?

| | Pillar Library (cũ) | Preset Library (mới) |
|--|--------------------|--------------------|
| **Vai trò** | Bắt buộc — template phải chọn từ đây | Tuỳ chọn — gợi ý khởi đầu |
| **Ràng buộc** | Tên pillar phải thuộc library | Không ràng buộc sau khi copy |
| **Governance** | HR/admin kiểm soát library | Admin quản lý preset; phòng tự do build tree |
| **Khi muốn custom** | Phải xin thêm pillar vào library | Tự chỉnh cây, không cần xin |
| **Ngôn ngữ chung** | Enforced qua library ID | Khuyến khích qua preset, không bắt buộc |

---

## Ví dụ cây tiêu chí theo từng loại phòng

**Phòng Giao hàng** — copy từ preset rồi chỉnh nhẹ:
```
Kết quả (50%)
  ├── Số đơn giao (60% | quantitative)
  └── Tỷ lệ đúng hạn (40% | quantitative)
Chất lượng (30%)
  ├── Phản hồi khách (50% | event)
  └── Đánh giá QL (50% | qualitative_360)
Tuân thủ (20% | manual)
```

**Đội An toàn lao động** — xây từ đầu, không có quantitative:
```
Tuân thủ checklist (60% | event)
Thái độ & Hợp tác (40% | qualitative_360)
```

**Đội Kỹ thuật / Bảo hành** — 4 folder phức tạp:
```
Kết quả ca (35% | quantitative)
Tay nghề (25%)
  ├── Đánh giá kỹ thuật QL (70% | qualitative_360)
  └── AI chấm từ repair log (30% | ai)
Giao tiếp khách (25% | qualitative_360)
Phản hồi sau bảo hành (15% | event)
```

**Đội Bán hàng** — commission đã cover định lượng, chỉ cần 2 nhóm:
```
Chất lượng tư vấn (55% | qualitative_360)
Tuân thủ quy trình (45% | event)
```

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

**Kết luận:** OKR và hệ thống này **bổ sung, không thay thế nhau**. OKR đặt hướng đi cho phòng/tổ chức; hệ thống này đánh giá cá nhân thực thi như thế nào. Nhiều công ty dùng cả hai.

### Balanced Scorecard (Kaplan-Norton)

BSC dùng 4 perspectives: Financial, Customer, Internal Process, Learning & Growth.

| | BSC | Hệ thống này |
|---|-----|-------------|
| **Thiết kế cho** | Quản trị tổ chức (org-level) | Đánh giá nhân viên (individual) |
| **Granularity** | KPI phòng/công ty | Work log, sự vụ từng người |
| **Nguồn dữ liệu** | Báo cáo tài chính, survey | CRM/ERP, form 360°, sự vụ |

BSC là cảm hứng thiết kế (tư duy "multi-perspective"), nhưng hệ thống này hoạt động ở tầng cá nhân.

### Tóm lại: Khi nào dùng cái gì?

```
Chiến lược tổ chức → OKR
Quản trị phòng/BU  → Balanced Scorecard
Đánh giá cá nhân   → Hệ thống này (CriterionTree + Work Logs + Events)
```

---

## Quy trình vận hành hàng tháng / hàng quý

### Hàng tháng

**Cuối tháng, QL trực tiếp (1-2 tiếng):**
1. Mở dữ liệu work logs + events — hầu hết đã có sẵn
2. Chấm các leaf `quantitative` từ số liệu tự động
3. Chấm các leaf `event` từ sự vụ đã xác nhận
4. Nhập điểm cho leaf `manual` nếu có
5. Tổng hợp sơ bộ, đề xuất điều chỉnh thu nhập

### Hàng quý

**Chạy thêm các leaf dạng 360° / AI:**
1. Gửi form đánh giá chéo cho leaf `qualitative_360` (2-3 ngày điền)
2. Review AIEvaluation pending nếu có leaf `ai`
3. Kết hợp tất cả leaf → rollup lên folder → tổng điểm
4. Xếp hạng A/B/C/D → quyết định tăng lương, thưởng, cảnh báo

**Tổng thời gian công sức quản lý:** 1-2 tiếng/tháng + nửa ngày/quý.

---

## Rào cản thực tế cần nhận diện

Nếu khung này đã khả thi trong vài tiếng, rào cản thực sự không phải là kỹ thuật mà là:

1. **Thẩm quyền** — QL trực tiếp có quyền quyết lương không, hay phải qua nhiều tầng?
2. **Đồng thuận giữa các QL** — các phòng khác có cùng thực hiện không, hay mình lẻ loi?
3. **Ngân sách cho điều chỉnh** — có ngân sách để tăng lương cho nhân viên xếp hạng A không?

Mỗi rào cản sẽ có cách xử lý khác nhau. Nhận diện đúng rào cản sẽ quyết định ai cần được thuyết phục trước.

---

## Đọc tiếp

- [02-template-va-versioning.md](02-template-va-versioning.md) — cách CriterionTree có versioning và publish workflow
- [04-khai-quat-hoa-cong-viec.md](04-khai-quat-hoa-cong-viec.md) — cách mô hình hóa "1 đơn giao" vs "1 ca bảo hành kéo dài 3 ngày"
