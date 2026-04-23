# 08 — Ví dụ CriterionTree theo Phòng & Vai trò

Mỗi phòng ban có **3 template**:
- **NV** — đánh giá cá nhân nhân viên
- **QL** — đánh giá quản lý phòng
- **Team** — bảng điểm tập thể cả đội

Ký hiệu `eval_type`: `Q` = quantitative · `360` = qualitative_360 · `E` = event · `M` = manual · `AI` = ai

---

## 1. Bán hàng

> Nhận đơn từ CRM, thuyết phục khách, kiểm tra tồn/khả năng nhập, thay đổi đơn theo yêu cầu phát sinh.

### NV — Bán hàng

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Kết quả bán hàng** | 50% | |
| ↳ Số đơn xử lý/ngày | 30% | Q |
| ↳ Tỷ lệ chốt đơn | 35% | Q |
| ↳ Tốc độ xử lý đơn (giờ/đơn) | 35% | Q |
| **📁 Chất lượng & Khách hàng** | 30% | |
| ↳ Phản hồi khách (khen/phàn nàn) | 50% | E |
| ↳ Tỷ lệ đơn sai/hủy do lỗi NV | 50% | Q |
| **📁 Thái độ & Quy trình** | 20% | |
| ↳ QL trực tiếp đánh giá | 60% | 360 |
| ↳ Phòng liên quan (Kho, Thu mua) | 40% | 360 |

### QL — Bán hàng

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả đội** | 45% | |
| ↳ Tổng đơn đội/kỳ | 35% | Q |
| ↳ Tỷ lệ chốt đơn đội | 35% | Q |
| ↳ Tỷ lệ đơn lỗi đội | 30% | Q |
| **📁 Quản trị nhân sự** | 30% | |
| ↳ BGĐ & cấp trên đánh giá | 50% | 360 |
| ↳ NV trong đội đánh giá ngược | 50% | 360 |
| **📁 Phối hợp liên phòng** | 25% | |
| ↳ Kho/Thu mua đánh giá phối hợp | 60% | 360 |
| ↳ Sự cố leo thang từ khách | 40% | E |

### Team — Bán hàng

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Doanh số & Tăng trưởng** | 50% | |
| ↳ Tổng đơn hoàn thành | 35% | Q |
| ↳ Tỷ lệ chốt đơn đội | 35% | Q |
| ↳ Tăng trưởng so kỳ trước | 30% | Q |
| **📁 Chất lượng dịch vụ** | 30% | |
| ↳ Khiếu nại khách hàng đội | 50% | E |
| ↳ Tỷ lệ đơn lỗi đội | 50% | Q |
| **📁 Phối hợp nội bộ** | 20% | |
| ↳ Kho + Thu mua + Kiểm soát đánh giá | 100% | 360 |

---

## 2. Kiểm soát

> Kiểm soát quy trình các team, chăm sóc sau bán hàng, nhận yêu cầu bảo hành.

### NV — Kiểm soát

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Kiểm soát & Audit** | 40% | |
| ↳ Số lần audit/kiểm tra hoàn thành | 40% | Q |
| ↳ Tỷ lệ phát hiện lỗi có xử lý | 60% | Q |
| **📁 Chăm sóc sau bán hàng** | 35% | |
| ↳ Số case CSKH xử lý | 35% | Q |
| ↳ Tỷ lệ giải quyết trong SLA | 35% | Q |
| ↳ Phản hồi khách sau xử lý | 30% | E |
| **📁 Bảo hành** | 25% | |
| ↳ Số yêu cầu tiếp nhận | 50% | Q |
| ↳ Thời gian xử lý bảo hành | 50% | Q |

### QL — Kiểm soát

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả kiểm soát đội** | 40% | |
| ↳ Tỷ lệ audit hoàn thành đúng kỳ | 35% | Q |
| ↳ Lỗi quy trình tái phát sau audit | 35% | E |
| ↳ Cải tiến quy trình được duyệt | 30% | M |
| **📁 Quản trị nhân sự** | 35% | |
| ↳ BGĐ đánh giá | 50% | 360 |
| ↳ NV đánh giá ngược | 50% | 360 |
| **📁 Hài lòng liên phòng** | 25% | |
| ↳ Các team được kiểm soát đánh giá | 100% | 360 |

### Team — Kiểm soát

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất kiểm soát** | 40% | |
| ↳ Tổng audit hoàn thành | 30% | Q |
| ↳ Tỷ lệ lỗi phát hiện & xử lý | 40% | Q |
| ↳ SLA CSKH đội | 30% | Q |
| **📁 Phòng ngừa & Cải tiến** | 30% | |
| ↳ Sự cố lặp lại sau audit | 50% | E |
| ↳ Quy trình mới đề xuất thành công | 50% | M |
| **📁 Đánh giá nội bộ** | 30% | |
| ↳ Các team đánh giá Kiểm soát | 100% | 360 |

---

## 3. Thu mua

> Nhập hàng theo đơn, nhập tồn kho, kiểm tra khả năng nhập.

### NV — Thu mua

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Kết quả nhập hàng** | 50% | |
| ↳ Số đơn thu mua hoàn thành | 35% | Q |
| ↳ Tỷ lệ nhập đúng số lượng/chủng loại | 35% | Q |
| ↳ Tỷ lệ nhập đúng hạn | 30% | Q |
| **📁 Hiệu quả mua hàng** | 30% | |
| ↳ Tiết kiệm so ngân sách kế hoạch | 50% | Q |
| ↳ Sự cố từ nhà cung cấp (hàng kém/trễ) | 50% | E |
| **📁 Thái độ & Quy trình** | 20% | |
| ↳ QL đánh giá | 60% | 360 |
| ↳ Kho đánh giá phối hợp | 40% | 360 |

### QL — Thu mua

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả đội thu mua** | 40% | |
| ↳ Tỷ lệ nhập đúng hạn đội | 40% | Q |
| ↳ Tỷ lệ nhập đúng số lượng/chất lượng | 30% | Q |
| ↳ Tiết kiệm ngân sách đội | 30% | Q |
| **📁 Quản trị nhà cung cấp** | 35% | |
| ↳ Đánh giá nhà cung cấp định kỳ | 50% | M |
| ↳ Sự cố nhà cung cấp gây hậu quả | 50% | E |
| **📁 Phối hợp** | 25% | |
| ↳ Kho đánh giá | 50% | 360 |
| ↳ Bán hàng đánh giá hàng sẵn có | 50% | 360 |

### Team — Thu mua

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất nhập hàng** | 50% | |
| ↳ Tổng đơn hoàn thành | 35% | Q |
| ↳ Tỷ lệ đúng hạn | 35% | Q |
| ↳ Tỷ lệ đúng số lượng | 30% | Q |
| **📁 Chi phí & Chất lượng** | 30% | |
| ↳ Tiết kiệm ngân sách tổng | 50% | Q |
| ↳ Sự cố hàng kém chất lượng | 50% | E |
| **📁 Phối hợp nội bộ** | 20% | |
| ↳ Kho + Bán hàng đánh giá đội | 100% | 360 |

---

## 4. Kho

> Xuất, nhập, kiểm kho.

### NV — Kho

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Năng suất kho** | 50% | |
| ↳ Số lần xuất/nhập hoàn thành | 35% | Q |
| ↳ Tốc độ xử lý đơn (phút/đơn) | 30% | Q |
| ↳ Tỷ lệ chính xác kiểm kho | 35% | Q |
| **📁 Chính xác & An toàn** | 30% | |
| ↳ Xuất/nhập nhầm hàng | 50% | E |
| ↳ Hàng hỏng/mất trong kho | 50% | E |
| **📁 Thái độ** | 20% | |
| ↳ QL đánh giá | 60% | 360 |
| ↳ Giao hàng + Bán hàng đánh giá | 40% | 360 |

### QL — Kho

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất kho** | 45% | |
| ↳ Throughput tổng (đơn/ngày) | 30% | Q |
| ↳ Tỷ lệ sai lệch kiểm kho định kỳ | 40% | Q |
| ↳ Thời gian xử lý trung bình | 30% | Q |
| **📁 Quản trị kho** | 30% | |
| ↳ Sự cố hàng hỏng/mất | 50% | E |
| ↳ Tổ chức & sắp xếp kho | 50% | M |
| **📁 Phối hợp** | 25% | |
| ↳ Giao hàng đánh giá | 50% | 360 |
| ↳ Bán hàng + Thu mua đánh giá | 50% | 360 |

### Team — Kho

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất vận hành** | 50% | |
| ↳ Tổng xuất/nhập hoàn thành | 35% | Q |
| ↳ Tỷ lệ sai lệch kiểm kho | 35% | Q |
| ↳ Thời gian xử lý trung bình | 30% | Q |
| **📁 Chất lượng hàng hóa** | 30% | |
| ↳ Sự cố hàng hỏng/nhầm | 50% | E |
| ↳ Tỷ lệ claim do lỗi kho | 50% | E |
| **📁 Phối hợp nội bộ** | 20% | |
| ↳ Giao hàng + Bán hàng đánh giá kho | 100% | 360 |

---

## 5. Giao hàng

> Giao hàng, lắp đặt; đi nhập hàng về kho; nhập rồi ship thẳng cho khách.

### NV — Giao hàng

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Kết quả giao/nhập** | 50% | |
| ↳ Số chuyến hoàn thành | 30% | Q |
| ↳ Tỷ lệ giao đúng hạn | 40% | Q |
| ↳ Tỷ lệ giao đúng địa chỉ/đúng khách | 30% | Q |
| **📁 Chất lượng & An toàn** | 30% | |
| ↳ Phản hồi khách (khen/phàn nàn) | 40% | E |
| ↳ Hàng hỏng trong quá trình giao | 30% | E |
| ↳ Vi phạm an toàn/quy trình | 30% | E |
| **📁 Thái độ** | 20% | |
| ↳ QL đánh giá | 60% | 360 |
| ↳ Kho đánh giá phối hợp bốc xếp | 40% | 360 |

### QL — Giao hàng

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất đội** | 45% | |
| ↳ Tổng chuyến hoàn thành | 30% | Q |
| ↳ Tỷ lệ đúng hạn đội | 40% | Q |
| ↳ Chi phí vận chuyển/chuyến | 30% | Q |
| **📁 Quản lý rủi ro & An toàn** | 30% | |
| ↳ Sự cố giao hàng (hỏng, mất, tai nạn) | 60% | E |
| ↳ Kiểm tra phương tiện định kỳ | 40% | M |
| **📁 Phối hợp** | 25% | |
| ↳ Kho đánh giá | 50% | 360 |
| ↳ Bán hàng/Kiểm soát đánh giá | 50% | 360 |

### Team — Giao hàng

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất giao hàng** | 50% | |
| ↳ Tổng chuyến đội | 30% | Q |
| ↳ Tỷ lệ đúng hạn đội | 40% | Q |
| ↳ Tỷ lệ giao thành công (không hoàn) | 30% | Q |
| **📁 Chất lượng & An toàn** | 30% | |
| ↳ Hàng hỏng trong giao | 35% | E |
| ↳ Phản hồi khách hàng đội | 35% | E |
| ↳ Vi phạm an toàn đội | 30% | E |
| **📁 Phối hợp nội bộ** | 20% | |
| ↳ Kho + Bán hàng đánh giá đội | 100% | 360 |

---

## 6. Kế toán

### NV — Kế toán

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Năng suất & Tiến độ** | 50% | |
| ↳ Số chứng từ/giao dịch xử lý | 30% | Q |
| ↳ Tỷ lệ hoàn thành đúng deadline | 40% | Q |
| ↳ Số báo cáo nộp đúng hạn | 30% | Q |
| **📁 Chính xác & Tuân thủ** | 35% | |
| ↳ Sai sót sổ sách cần sửa | 60% | E |
| ↳ Tuân thủ quy định kế toán/thuế | 40% | M |
| **📁 Thái độ** | 15% | |
| ↳ QL đánh giá | 100% | 360 |

### QL — Kế toán

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả tài chính đội** | 40% | |
| ↳ Deadline báo cáo tài chính | 40% | Q |
| ↳ Sai sót kế toán đội | 35% | E |
| ↳ Tỷ lệ hoàn thành kế hoạch tài chính | 25% | Q |
| **📁 Tuân thủ & Kiểm soát nội bộ** | 35% | |
| ↳ Kết quả audit nội bộ/bên ngoài | 50% | M |
| ↳ Sự cố tài chính nghiêm trọng | 50% | E |
| **📁 Phục vụ tổ chức** | 25% | |
| ↳ BGĐ/CFO đánh giá | 60% | 360 |
| ↳ Phòng ban đánh giá hỗ trợ kế toán | 40% | 360 |

### Team — Kế toán

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất xử lý tài chính** | 50% | |
| ↳ Deadline báo cáo đội | 35% | Q |
| ↳ Tổng giao dịch xử lý | 30% | Q |
| ↳ Tỷ lệ hoàn thành đúng hạn | 35% | Q |
| **📁 Chính xác & Rủi ro** | 35% | |
| ↳ Sai sót kế toán đội | 50% | E |
| ↳ Vi phạm tuân thủ phát sinh | 50% | E |
| **📁 Phục vụ nội bộ** | 15% | |
| ↳ Các phòng ban đánh giá kế toán | 100% | 360 |

---

## 7. Biên tập

> Edit nội dung, ảnh, video sản phẩm; chương trình quảng cáo; banner; trả lời hỏi đáp website.

### NV — Biên tập

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Sản lượng sáng tạo** | 40% | |
| ↳ Số asset hoàn thành (ảnh/video/bài) | 35% | Q |
| ↳ Tỷ lệ hoàn thành đúng deadline | 35% | Q |
| ↳ Số câu hỏi website được trả lời | 30% | Q |
| **📁 Chất lượng nội dung** | 40% | |
| ↳ Tỷ lệ duyệt không cần sửa lại | 40% | Q |
| ↳ Phản hồi về nội dung từ khách/web | 30% | E |
| ↳ QL đánh giá chất lượng sáng tạo | 30% | 360 |
| **📁 Thái độ & Phối hợp** | 20% | |
| ↳ QL đánh giá | 60% | 360 |
| ↳ Data Marketing đánh giá phối hợp | 40% | 360 |

### QL — Biên tập

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất đội biên tập** | 40% | |
| ↳ Tổng asset đội hoàn thành | 30% | Q |
| ↳ Tỷ lệ duyệt không sửa | 35% | Q |
| ↳ Deadline chiến dịch marketing | 35% | Q |
| **📁 Chất lượng & Hiệu quả nội dung** | 35% | |
| ↳ Data Marketing đánh giá chất lượng | 50% | 360 |
| ↳ Hiệu suất nội dung (CTR/engagement nếu đo được) | 50% | Q |
| **📁 Phối hợp chiến lược** | 25% | |
| ↳ BGĐ/stakeholder đánh giá | 50% | 360 |
| ↳ Data Marketing đánh giá phối hợp | 50% | 360 |

### Team — Biên tập

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Sản lượng đội** | 40% | |
| ↳ Tổng asset hoàn thành | 35% | Q |
| ↳ Tỷ lệ đúng deadline | 35% | Q |
| ↳ Tổng bài trả lời hỏi đáp | 30% | Q |
| **📁 Chất lượng đội** | 40% | |
| ↳ Tỷ lệ duyệt không sửa | 50% | Q |
| ↳ Phản hồi nội dung từ ngoài | 50% | E |
| **📁 Phối hợp** | 20% | |
| ↳ Data Marketing + BGĐ đánh giá | 100% | 360 |

---

## 8. Data Marketing

### NV — Data Marketing

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Sản lượng phân tích & Campaign** | 40% | |
| ↳ Số báo cáo/insight hoàn thành | 35% | Q |
| ↳ Số campaign triển khai | 35% | Q |
| ↳ Deadline báo cáo định kỳ | 30% | Q |
| **📁 Hiệu quả Marketing** | 40% | |
| ↳ KPI campaign (ROAS/CPC/conversion) | 50% | Q |
| ↳ Đề xuất được implement thành công | 30% | Q |
| ↳ Sự cố campaign (sai target/ngân sách) | 20% | E |
| **📁 Thái độ & Phối hợp** | 20% | |
| ↳ QL đánh giá | 60% | 360 |
| ↳ Biên tập đánh giá phối hợp | 40% | 360 |

### QL — Data Marketing

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả Marketing đội** | 45% | |
| ↳ KPI tổng hợp campaign đội | 40% | Q |
| ↳ ROI ngân sách marketing | 35% | Q |
| ↳ Số insight có giá trị thực thi | 25% | Q |
| **📁 Lãnh đạo đội** | 30% | |
| ↳ BGĐ đánh giá | 50% | 360 |
| ↳ NV trong đội đánh giá ngược | 50% | 360 |
| **📁 Phối hợp chiến lược** | 25% | |
| ↳ Bán hàng đánh giá chất lượng lead | 50% | 360 |
| ↳ Biên tập đánh giá yêu cầu sáng tạo | 50% | 360 |

### Team — Data Marketing

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả campaign tổng hợp** | 50% | |
| ↳ KPI campaign đội | 40% | Q |
| ↳ ROI ngân sách | 30% | Q |
| ↳ Số campaign thành công | 30% | Q |
| **📁 Chất lượng insight** | 30% | |
| ↳ Đề xuất được thực thi | 50% | Q |
| ↳ Sự cố campaign đội | 50% | E |
| **📁 Phối hợp** | 20% | |
| ↳ Bán hàng + Biên tập đánh giá đội | 100% | 360 |

---

## 9. Công Nghệ (IT)

> Quản lý hệ thống điện thoại, internet nội bộ, máy chủ, website; sửa chữa máy tính làm việc.

### NV — Công Nghệ

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Năng suất hỗ trợ** | 40% | |
| ↳ Số ticket/yêu cầu xử lý | 30% | Q |
| ↳ Tỷ lệ xử lý trong SLA | 40% | Q |
| ↳ Thời gian giải quyết trung bình | 30% | Q |
| **📁 Ổn định hệ thống** | 40% | |
| ↳ Uptime hệ thống phụ trách | 40% | Q |
| ↳ Sự cố hệ thống (downtime) | 40% | E |
| ↳ Sự cố bảo mật | 20% | E |
| **📁 Thái độ & Phục vụ** | 20% | |
| ↳ QL đánh giá | 60% | 360 |
| ↳ User/phòng ban đánh giá | 40% | 360 |

### QL — Công Nghệ

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Ổn định & Hiệu suất hệ thống** | 45% | |
| ↳ Uptime tổng thể | 40% | Q |
| ↳ Sự cố nghiêm trọng (downtime/breach) | 35% | E |
| ↳ Số dự án IT hoàn thành đúng hạn | 25% | Q |
| **📁 Quản trị đội IT** | 30% | |
| ↳ BGĐ đánh giá | 50% | 360 |
| ↳ SLA trung bình toàn đội | 50% | Q |
| **📁 Phục vụ nội bộ** | 25% | |
| ↳ Các phòng ban đánh giá IT | 100% | 360 |

### Team — Công Nghệ

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Độ tin cậy hệ thống** | 50% | |
| ↳ Uptime tổng | 35% | Q |
| ↳ Sự cố nghiêm trọng đội | 35% | E |
| ↳ Tổng ticket giải quyết | 30% | Q |
| **📁 Hiệu suất hỗ trợ** | 30% | |
| ↳ Tỷ lệ SLA đội | 50% | Q |
| ↳ Thời gian phản hồi trung bình | 50% | Q |
| **📁 Phục vụ nội bộ** | 20% | |
| ↳ Các phòng ban đánh giá đội IT | 100% | 360 |

---

## 10. Hành chính Nhân sự

> Tuyển dụng, hành chính, quản lý lao công/bảo vệ.

### NV — HCNS

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Kết quả tuyển dụng & Hành chính** | 40% | |
| ↳ Số hồ sơ tuyển xử lý | 30% | Q |
| ↳ Tỷ lệ tuyển đúng deadline | 35% | Q |
| ↳ Số công việc hành chính hoàn thành | 35% | Q |
| **📁 Chất lượng phục vụ** | 40% | |
| ↳ Sai sót hành chính (hợp đồng, lương...) | 50% | E |
| ↳ Phòng ban đánh giá hỗ trợ HR | 50% | 360 |
| **📁 Thái độ** | 20% | |
| ↳ QL đánh giá | 100% | 360 |

### QL — HCNS

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu quả nhân sự & Hành chính** | 40% | |
| ↳ Tỷ lệ lấp đầy vị trí đúng hạn | 35% | Q |
| ↳ Tỷ lệ giữ chân nhân viên (retention) | 35% | Q |
| ↳ Sai sót hành chính đội | 30% | E |
| **📁 Quản lý lao công & Bảo vệ** | 25% | |
| ↳ Sự cố an ninh/vệ sinh phát sinh | 50% | E |
| ↳ Đánh giá chất lượng dịch vụ bảo vệ/lao công | 50% | M |
| **📁 Phục vụ tổ chức** | 35% | |
| ↳ BGĐ đánh giá | 50% | 360 |
| ↳ Phòng ban đánh giá HR | 50% | 360 |

### Team — HCNS

| Node | Weight | eval_type |
|------|--------|-----------|
| **📁 Hiệu suất tuyển dụng & HC** | 45% | |
| ↳ Vị trí tuyển đúng deadline | 35% | Q |
| ↳ Tổng hồ sơ xử lý | 30% | Q |
| ↳ Sai sót hành chính đội | 35% | E |
| **📁 Phục vụ nhân sự** | 35% | |
| ↳ Retention toàn công ty | 50% | Q |
| ↳ Phòng ban đánh giá đội HR | 50% | 360 |
| **📁 An ninh & Hậu cần** | 20% | |
| ↳ Sự cố bảo vệ/lao công | 50% | E |
| ↳ Vệ sinh & An ninh (QL đánh giá) | 50% | M |

---

## Tóm tắt pattern chung

### NV — Nhân viên

| Folder | Weight điển hình | Nguồn |
|--------|-----------------|-------|
| Kết quả định lượng | 40–50% | `Q` — tự động từ CRM/ERP |
| Chất lượng/Sự cố | 25–40% | `E` — events (khen/chê/sự cố) |
| Thái độ/Phối hợp | 15–25% | `360` — QL + liên phòng |

### QL — Quản lý

| Folder | Weight điển hình | Nguồn |
|--------|-----------------|-------|
| Hiệu quả đội | 40–45% | `Q` — aggregate team metrics |
| Quản trị nhân sự | 25–35% | `360` — BGĐ + NV đánh giá ngược |
| Phối hợp liên phòng | 20–30% | `360` — phòng liên quan đánh giá |

### Team — Tập thể

| Folder | Weight điển hình | Nguồn |
|--------|-----------------|-------|
| Hiệu suất cốt lõi | 40–50% | `Q` — sum/avg của toàn đội |
| Chất lượng/Sự cố đội | 25–35% | `E` — sự cố tập thể |
| Phối hợp nội bộ | 15–25% | `360` — phòng ban khác đánh giá |

### Nguyên tắc trọng số

- **Phòng vận hành** (Giao hàng, Kho, Thu mua): `Q` cao hơn (dữ liệu tự động nhiều)
- **Phòng sáng tạo** (Biên tập, Data Marketing): `360` + `E` cao hơn (khó đo bằng số thuần)
- **Phòng kiểm soát/hỗ trợ** (Kiểm soát, IT, HCNS, Kế toán): cân bằng `Q`+`360`+`E`
- **Quản lý** luôn có `360` từ NV đánh giá ngược (không optional) — tránh one-way evaluation
- **Team template** không có `M` (manual) trừ khi có lý do đặc thù — team score phải có thể tính tự động

### Trọng số event âm vs dương

Event leaf (`E`) gộp cả khen lẫn phàn nàn trong cùng một node — score được tính:

```
score(leaf_event) = 50 + (positive_events × impact_pos − negative_events × impact_neg)
clamp(score, 0, 100)
```

Baseline 50 = không có event nào. Khen đẩy lên, sự cố kéo xuống.
