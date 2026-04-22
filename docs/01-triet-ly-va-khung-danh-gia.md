# 01 · Triết lý & Khung Đánh giá

## Vấn đề xuất phát

Trong mọi tổ chức có nhiều phòng ban, bài toán đánh giá nhân viên thường gặp hai cực đoan:

**Cực 1 — Cảm tính hoàn toàn.** Quản lý trực tiếp "chấm" dựa trên cảm nhận. Ưu điểm: nhanh, bắt được tinh thần. Nhược điểm: thiên vị, không minh bạch, nhân viên không hiểu tại sao mình được/không được tăng lương.

**Cực 2 — Chờ hệ thống "khoa học".** Đợi IT build dashboard, đợi AI phân tích, đợi quy trình chuẩn. Kết quả: chờ mãi không ra, thời điểm vàng trôi qua (đặc biệt lúc cao điểm như nắng nóng, mùa lễ).

Triết lý hệ thống này nằm ở giữa: **quản lý đã nắm 70-80% bức tranh bằng cảm nhận — phần 20-30% còn lại có thể khách quan hóa ngay bằng dữ liệu vận hành sẵn có, không cần chờ ai.**

## Ba trụ cột — bất biến cho mọi phòng

### Trụ cột 1: Kết quả định lượng (~50%)

Những con số đo được, đếm được, không cần ý kiến:

- Giao hàng: số đơn, km, tỷ lệ đúng giờ
- Kho: số pick/pack, số lần kiểm kê chính xác
- Bảo hành: số ca xử lý, tỷ lệ sửa tại chỗ
- Bán hàng: doanh số, số đơn, tỷ lệ chốt
- Kế toán: số chứng từ xử lý, sai sót, đúng hạn

**Nguồn:** Work logs tự động từ CRM/ERP hoặc sổ sách Excel.

### Trụ cột 2: Chất lượng & Thái độ — Đánh giá 360° (~30%)

Những thứ định lượng không bao phủ được: tay nghề, chăm chỉ, tinh thần hợp tác, thái độ với khách, chủ động. Thay vì để một người (QL trực tiếp) quyết định, dùng **đánh giá chéo**:

- QL trực tiếp (trọng số cao nhất)
- Đồng nghiệp cùng bộ phận
- Các bộ phận có giao tiếp công việc (Bán hàng đánh giá Giao hàng, Kho đánh giá Giao hàng, v.v.)

Thang điểm 1-5, có ô ghi chú. Cùng bộ 5-7 câu hỏi áp cho mọi vị trí, chỉ khác trọng số câu hỏi theo đặc thù công việc.

### Trụ cột 3: Phản hồi & Sự cố (~20%)

Tín hiệu từ bên ngoài và các sự kiện đặc biệt:

- Khách khen, khách phàn nàn
- Sự cố, thiệt hại
- Sáng kiến vượt phạm vi công việc
- Khen thưởng, kỷ luật nội bộ

**Nguồn:** Module Sự vụ — xem `03-su-vu-va-ghi-nhan.md`

## Tại sao khung này "flat" và "tao nhã"?

- **Ba trụ cột không đổi xuyên phòng ban** → nhân viên mọi phòng hiểu luật chơi như nhau
- **Chỉ số con linh hoạt** → không gượng ép áp "doanh số" cho kế toán
- **Đánh giá chéo tạo đối trọng** với cảm tính của một mình QL → khách quan hơn
- **Không cần phần mềm để bắt đầu** — Excel/Sheets đủ, có phần mềm sau thì tốt

## Quy trình vận hành hàng tháng / hàng quý

### Hàng tháng

**Cuối tháng, QL trực tiếp (1-2 tiếng):**
1. Mở dữ liệu work logs + events — hầu hết đã có sẵn
2. Chấm Trụ cột 1 (định lượng) từ số liệu
3. Chấm Trụ cột 3 (phản hồi/sự cố) từ events đã xác nhận
4. Tổng hợp sơ bộ, đề xuất điều chỉnh thu nhập

### Hàng quý

**Chạy thêm Trụ cột 2 (đánh giá 360°):**
1. Gửi Google Form cho tất cả phòng liên quan, cho 2-3 ngày điền
2. Tổng hợp bằng Sheets
3. Kết hợp cả 3 trụ cột → xếp hạng A/B/C/D
4. Quyết định tăng lương, thưởng, cảnh báo

**Tổng thời gian công sức quản lý:** 1-2 tiếng/tháng + nửa ngày/quý.

## Rào cản thực tế cần nhận diện

Nếu khung này đã khả thi trong vài tiếng, rào cản thực sự không phải là kỹ thuật mà là:

1. **Thẩm quyền** — QL trực tiếp có quyền quyết lương không, hay phải qua nhiều tầng?
2. **Đồng thuận giữa các QL** — các phòng khác có cùng thực hiện không, hay mình lẻ loi?
3. **Ngân sách cho điều chỉnh** — có ngân sách để tăng lương cho nhân viên xếp hạng A không?

Mỗi rào cản sẽ có cách xử lý khác nhau. Nhận diện đúng rào cản sẽ quyết định ai cần được thuyết phục trước.

## Đọc tiếp

- `02-template-va-versioning.md` — cách biểu diễn khung 3 trụ cột thành template có thể phiên bản hoá
- `04-khai-quat-hoa-cong-viec.md` — cách mô hình hóa "1 đơn giao" vs "1 ca bảo hành kéo dài 3 ngày"
