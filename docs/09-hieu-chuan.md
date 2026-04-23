# 09 · Hiệu chuẩn hệ thống đánh giá

## Tại sao cần hiệu chuẩn

Khi triển khai lần đầu, ba tham số quan trọng nhất trong `scoringConfig` đều là **ước tính**:

| Tham số | Sai theo hướng nào | Hậu quả nếu không hiệu chỉnh |
|---------|-------------------|------------------------------|
| `target_points` | Thường đặt theo trực giác, không có dữ liệu thực | >80% NV đạt 100 (quá dễ) hoặc <20% vượt 50 (quá khó) |
| `base_unit_points` | Chưa đo thời gian thực tế từng loại việc | Công việc phức tạp bị định giá như công việc đơn giản |
| `weight` (trọng số node) | QL cảm tính — không phải từ dữ liệu | Tiêu chí không quan trọng chiếm quá nhiều điểm |

Không có hệ thống nào đặt đúng ngay từ đầu. Hiệu chuẩn là quy trình bình thường, không phải thất bại.

---

## Kỳ hiệu chuẩn (Calibration Period)

`EvalPeriod.mode` kiểm soát hậu quả HR:

```
mode = "calibration"  →  điểm được tính, NV xem được, KHÔNG gắn lương / xét thăng bậc
mode = "official"     →  đánh giá chính thức, có hậu quả HR đầy đủ
```

**Nguyên tắc**: chạy ít nhất **1–2 kỳ calibration** trước khi mở official, đặc biệt khi:
- Triển khai phòng ban lần đầu
- Thay đổi cấu trúc cây lớn (thêm/bỏ nhiều leaf)
- Thay đổi loại hình công việc (sáp nhập nhóm, thêm sản phẩm mới)

---

## Vòng đời hiệu chuẩn đầy đủ

```
Phase 0: Khởi tạo
──────────────────
Clone preset phù hợp (hoặc build từ đầu)
Đặt scoringConfig ban đầu — dựa trên kinh nghiệm + ước tính
Publish CriterionTree v1

Phase 1: Calibration × 1–2 kỳ
────────────────────────────────
Mở EvalPeriod (mode=calibration)
CRM/ERP gửi WorkLog bình thường
Events được ghi nhận bình thường
NV thấy điểm của mình → tạo feedback tự nhiên

Kỳ đóng → xem Distribution Analysis
   hint=OK mọi leaf → Phase 3
   hint có vấn đề → Phase 2

Phase 2: Điều chỉnh
────────────────────
Clone tree v1 → draft v2
Điều chỉnh theo gợi ý Distribution Analysis:
  TARGET_TOO_LOW  → tăng target_points
  TARGET_TOO_HIGH → giảm target_points hoặc tăng base_unit_points
  Trọng số lệch   → điều chỉnh weight các node
Ghi calibrationNotes: lý do thay đổi cụ thể
Publish v2
Chạy thêm 1 kỳ calibration với v2 → quay lại Phase 1

Phase 3: Chính thức
────────────────────
Mở EvalPeriod (mode=official)
Điểm tổng hợp vào lương / xét thăng bậc
```

---

## Distribution Analysis — đọc hiểu kết quả

Sau mỗi kỳ đóng, hệ thống sinh phân tích phân phối điểm cho từng leaf:

### Các chỉ số cần xem

| Chỉ số | Ý nghĩa | Ngưỡng cảnh báo |
|--------|---------|-----------------|
| `pct_above90` | % NV đạt ≥90 | >80% → target_points quá thấp |
| `pct_below50` | % NV dưới 50 | >50% → target_points quá cao |
| `mean` | Điểm trung bình | Lý tưởng 65–80 trong official |
| `p25 / p75` | Khoảng tứ phân vị | Quá hẹp = phân phối dồn cục |

### Ví dụ đọc Distribution Analysis

**Leaf "Số chuyến giao" — tháng 4 (calibration):**

```
count:        12 NV
mean:         96.4
p25:          94.0
p75:          100.0
pct_above90:  92%   ← CẢNH BÁO: TARGET_TOO_LOW
pct_below50:  0%
```

Gợi ý: `target_points` hiện tại 150 → nên tăng lên ~200 để phân biệt được NV tốt vs. rất tốt.

**Leaf "Tỷ lệ hàng nguyên vẹn" — tháng 4 (calibration):**

```
count:        12 NV
mean:         38.2
p25:          22.0
p75:          55.0
pct_above90:  8%
pct_below50:  67%   ← CẢNH BÁO: TARGET_TOO_HIGH
```

Gợi ý: Target quá cao hoặc `base_unit_points` chưa tính đúng độ khó. Xem xét giảm target hoặc tăng `base_unit_points` cho loại đơn hàng dễ hỏng.

---

## Câu hỏi hiệu chuẩn theo từng tham số

### `target_points` — mục tiêu điểm công/kỳ

**Câu hỏi**: NV hoàn thành tốt công việc (không xuất sắc, không kém) trong 1 kỳ bình thường đạt bao nhiêu điểm công?

**Cách xác định ban đầu**:
1. Lấy 3–5 NV được QL đánh giá là "đạt yêu cầu"
2. Tính tổng điểm công của họ trong 1 tháng thử
3. Đặt `target_points` = trung bình của nhóm này × 0.9 (hơi dễ hơn cho kỳ đầu)

**Tín hiệu cần điều chỉnh sau calibration**:
- Nếu NV "đạt yêu cầu" theo QL thực tế chỉ đạt 60 điểm trong hệ thống → target quá cao
- Nếu NV kém cũng đạt 95 → target quá thấp

### `base_unit_points` — điểm công mỗi đơn vị

**Câu hỏi**: Các loại công việc khác nhau trong cùng một leaf có độ phức tạp khác nhau bao nhiêu?

**Cách xác định**:
1. Liệt kê các loại đơn trong leaf
2. Với mỗi loại, hỏi: "Loại này tốn gấp mấy lần so với loại đơn giản nhất?"
3. Dùng tỷ lệ đó làm `unit_points` ban đầu

**Ví dụ thực tế:**

```
Phòng Giao hàng:
  Giao đơn nhỏ (< 5kg)       → unit_points = 1   (chuẩn)
  Giao đơn lớn (nội thất)    → unit_points = 2   (2× nặng hơn)
  Giao + lắp đặt điều hòa    → unit_points = 5   (cần 2 người, ~3-4 giờ)
  Giao liên tỉnh             → unit_points = 3   (xa, mất ngày)
```

**Tín hiệu cần điều chỉnh**: NV chỉ nhận đơn đơn giản để đạt target dễ hơn. Nếu CRM thấy pattern "tránh đơn phức tạp", `unit_points` đang sai.

### `quality_weight` — tỷ lệ chất lượng trong điểm lá

**Câu hỏi**: Với leaf này, "làm nhiều" hay "làm tốt" quan trọng hơn?

| Loại công việc | quality_weight gợi ý | Lý do |
|---------------|---------------------|-------|
| Bảo vệ, vệ sĩ | 10–20% | Quan trọng nhất là hiện diện |
| Giao hàng phổ thông | 20–30% | Volume là chính, quality phụ |
| Kỹ thuật, lắp đặt | 40–50% | Chất lượng quan trọng ngang volume |
| CSKH, tư vấn | 60–70% | Chất lượng giao tiếp > số lượng cuộc gọi |
| Kiểm soát chất lượng | 70–80% | Sai sót là thất bại |

### `weight` của node — trọng số trong folder

**Câu hỏi**: Nếu NV đạt 100% ở tiêu chí X nhưng 0% ở tiêu chí Y, tổng điểm có chấp nhận được không?

**Bài test trực quan** (làm với QL phòng đó):
1. Đặt mỗi tiêu chí = 100, các tiêu chí còn lại = 0
2. Tính điểm tổng với weight hiện tại
3. Hỏi QL: "Điểm tổng này có phản ánh đúng thực tế không?"
4. Điều chỉnh weight đến khi QL đồng ý với kết quả bài test

---

## Retroactive Comparison — so sánh v1 vs. v2

Sau khi publish tree v2, admin có thể chạy shadow recalculation trên kỳ calibration đã đóng:

```
Kỳ tháng 4 đã dùng tree v1
  → Chạy lại với v2 trên cùng bộ WorkLog/Events
  → So sánh side-by-side: ai thay đổi điểm, thay đổi bao nhiêu, theo hướng nào

Không thay thế điểm gốc — chỉ là công cụ phân tích
```

Dùng để xác nhận: "v2 có cho kết quả hợp lý hơn v1 không?" trước khi mở official.

---

## Quy tắc bất biến trong hiệu chuẩn

1. **Kỳ `official` đã `finalized` → không bao giờ thay đổi điểm** — dù phát hiện target sai
2. **Kỳ đang `open` giữ nguyên `criterionTreeId`** — không thể swap tree giữa chừng
3. **Calibration period không tính vào lương** — phải document rõ trong thông báo nội bộ
4. **NV biết mình đang ở kỳ calibration** — không được ẩn, tránh hiểu nhầm
5. **Mỗi thay đổi tree phải có `calibrationNotes`** — để audit trail sau này hiểu lý do

---

## Thông báo nội bộ khi mở calibration period

Mẫu thông báo cho nhân viên:

> **[Thông báo] Kỳ thử nghiệm đánh giá tháng 4/2026**
>
> Tháng này, hệ thống đánh giá sẽ hoạt động ở chế độ **thử nghiệm**. Điểm số sẽ được tính và bạn có thể xem kết quả của mình, nhưng kết quả này **chưa ảnh hưởng đến lương hay xét thăng bậc**.
>
> Mục đích: kiểm tra xem các tiêu chí và trọng số có phù hợp với thực tế chưa.
>
> Nếu bạn thấy điểm chưa phản ánh đúng công việc thực tế, hãy phản hồi với quản lý trực tiếp.

---

---

## Cách hệ thống "suy nghĩ" khi phân tích 3 kỳ — dành cho người không làm kỹ thuật

> Phần này giải thích thuật toán bằng ngôn ngữ đời thường. Không có code, không có công thức.

### Hình dung đơn giản: chiếc cân cần chỉnh

Khi bạn mua một chiếc cân mới về, lần đầu bạn đặt 1kg lên — cân có thể chỉ 1.2kg. Không phải cân sai vĩnh viễn, chỉ là cần **hiệu chỉnh lại**. Hệ thống đánh giá cũng vậy: lần đầu triển khai, mục tiêu đặt ra là ước tính. Sau vài tháng có dữ liệu thực, hệ thống sẽ "nhìn lại" và đề xuất chỉnh cho đúng hơn.

---

### Hệ thống làm gì với 3 tháng dữ liệu?

Hãy tưởng tượng bạn là quản lý phòng Giao hàng, và bạn có bảng điểm của 12 nhân viên trong 3 tháng thử nghiệm vừa rồi.

**Bước 1 — Nhìn vào từng tháng, đặt câu hỏi đơn giản:**

Với tiêu chí "Số chuyến giao", hệ thống hỏi:

> *"Tháng này, bao nhiêu người đạt điểm rất cao (≥90/100)? Bao nhiêu người điểm rất thấp (dưới 50/100)?"*

Nếu câu trả lời là **"gần như tất cả đều ≥90"** → mục tiêu đang đặt quá dễ, như thi mà ai cũng đỗ thì đề thi vô nghĩa.

Nếu câu trả lời là **"hơn nửa số người dưới 50"** → mục tiêu đang đặt quá khó, như thi mà ai cũng rớt thì đề thi cũng vô nghĩa.

**Bước 2 — Kiểm tra xem có phải "chuyện tháng đó thôi" không:**

Một tháng bất thường không đủ để kết luận. Hệ thống xem cả 3 tháng:

- Nếu **chỉ 1 tháng** bất thường → có thể do dịp lễ, nhân sự biến động. Hệ thống **bỏ qua**, không đề xuất gì.
- Nếu **2 hoặc 3 tháng** cùng có vấn đề → đây là xu hướng thật. Hệ thống **đề xuất điều chỉnh**.

Mức độ tự tin:
- 2/3 tháng cùng có vấn đề → "có thể cần chỉnh" (tự tin 67%)
- 3/3 tháng cùng có vấn đề → "chắc chắn cần chỉnh" (tự tin 100%)

**Bước 3 — Hỏi thêm: "Tình hình đang tự cải thiện không?"**

Hệ thống so sánh điểm trung bình của tháng 1 và tháng 3:

- Nếu điểm đang tăng dần tự nhiên qua 3 tháng → nhân viên đang tự thích nghi, cần **điều chỉnh ít thôi** để không làm họ nản.
- Nếu điểm ổn định không đổi → vấn đề không tự giải quyết, cần **điều chỉnh mạnh hơn**.

**Bước 4 — Tính con số cụ thể cần thay đổi:**

Hệ thống tính toán và đưa ra một con số điều chỉnh. Ví dụ cụ thể:

| Tình huống quan sát được | Hệ thống đề xuất |
|--------------------------|-----------------|
| 3 tháng liên tiếp >90% nhân viên đạt ≥90 điểm, điểm ổn định | Tăng mục tiêu lên +50% |
| 2 tháng >80% nhân viên đạt ≥90 điểm, điểm ổn định | Tăng mục tiêu lên +30% |
| 3 tháng >90% nhân viên đạt ≥90 điểm, nhưng điểm đang giảm dần | Tăng mục tiêu lên +13% thôi (đang tự điều chỉnh) |
| 3 tháng >70% nhân viên dưới 50 điểm, điểm ổn định | Giảm mục tiêu xuống -40% |
| 2 tháng >50% nhân viên dưới 50 điểm, điểm đang tăng dần | Giảm mục tiêu xuống -8% thôi (đang tự cải thiện) |

---

### Ví dụ từ đầu đến cuối — Phòng Giao hàng

**Dữ liệu 3 tháng thử nghiệm, tiêu chí "Số chuyến giao":**

| | Tháng 2 | Tháng 3 | Tháng 4 |
|-|---------|---------|---------|
| Điểm trung bình | 95.1 | 94.8 | 96.2 |
| % nhân viên đạt ≥90 | 91% | 88% | 94% |
| % nhân viên dưới 50 | 0% | 0% | 0% |
| Nhận xét | Quá dễ | Quá dễ | Quá dễ |

**Hệ thống suy luận:**

> "Cả 3 tháng đều có >80% nhân viên đạt ≥90 điểm. Tự tin 100%. Điểm trung bình tháng 4 (96.2) gần bằng tháng 2 (95.1) — không có xu hướng tự cải thiện, tình hình ổn định. Mục tiêu hiện tại (150 điểm công) quá dễ. Đề xuất tăng lên +30% → 195 điểm công (làm tròn 200)."

**Kết quả hiển thị cho quản lý:**

```
Tiêu chí:    Số chuyến giao
Vấn đề:      Mục tiêu quá thấp — 3/3 tháng hầu hết nhân viên đạt tối đa
Đề xuất:     Tăng mục tiêu từ 150 → 200 điểm công/tháng
Tự tin:      Cao (3/3 tháng đều thấy vấn đề)
Xu hướng:    Ổn định (không tự cải thiện)
Lý do:       Khi ai cũng đạt 95+/100, điểm số không còn phân biệt
             được ai làm tốt hơn ai. Thước đo mất ý nghĩa.
```

**Quản lý quyết định:**

- "Đồng ý tăng lên 200" → chấp nhận đề xuất
- "Tôi muốn tăng lên 180 thôi vì team mới tuyển thêm người mới" → ghi đè giá trị
- "Bỏ qua tiêu chí này — tháng tới có thay đổi quy trình" → bỏ qua

Sau khi quản lý chọn xong → bấm **"Tạo phiên bản mới"** → hệ thống tự động tạo bản nháp với các thay đổi đã chọn. Quản lý xem lại lần cuối rồi kích hoạt.

---

### Điều hệ thống KHÔNG làm

Để tránh hiểu nhầm:

- **Không tự động kích hoạt** — manager phải bấm nút mới chạy phân tích
- **Không tự áp dụng** — dù đề xuất rõ ràng đến đâu, manager vẫn phải bấm "Tạo phiên bản mới"
- **Không thay đổi điểm cũ** — các tháng đã tính xong không bị ảnh hưởng
- **Không đề xuất thay trọng số** — trọng số (cái gì quan trọng hơn cái gì) phụ thuộc vào chiến lược kinh doanh, máy không biết được
- **Không chạy nếu chưa đủ 3 tháng** — dữ liệu ít hơn không đủ để kết luận

---

## Phân tích tự động 3 kỳ — Calibration Proposal

Thay vì tự đọc Distribution Analysis và điều chỉnh thủ công, manager có thể bấm nút để hệ thống phân tích 3 kỳ calibration gần nhất và sinh ra **đề xuất cụ thể** (CalibrationProposal).

### Điều kiện kích hoạt

- Đã có **ít nhất 3 kỳ calibration** đã đóng (`status = closed` hoặc `finalized`)
- Cả 3 kỳ phải dùng **cùng một CriterionTree version**
- Cả 3 kỳ phải **liên tiếp** (không có kỳ nào xen giữa)
- Mỗi kỳ có ít nhất **3 NV** có WorkLog để đủ ý nghĩa thống kê

### Cách hệ thống phân tích

Với mỗi leaf `eval_type=quantitative`, hệ thống:

1. **Phân loại** từng kỳ: `TARGET_TOO_LOW` / `TARGET_TOO_HIGH` / `OK`
2. **Kiểm tra nhất quán**: vấn đề phải xuất hiện ≥2/3 kỳ → mới đề xuất
3. **Đo xu hướng** (trend): điểm trung bình đang tăng (improving), ổn định, hay giảm?
4. **Tính hệ số điều chỉnh** dựa trên mức độ nghiêm trọng và xu hướng:

| Tình huống | Hệ số đề xuất |
|-----------|--------------|
| >90% NV đạt ≥90, trend stable | target × 1.50 (+50%) |
| >80% NV đạt ≥90, trend stable | target × 1.30 (+30%) |
| >90% NV đạt ≥90, trend improving | target × 1.13 (+13%, thận trọng) |
| >70% NV dưới 50, trend stable | target × 0.60 (-40%) |
| >50% NV dưới 50, trend stable | target × 0.75 (-25%) |
| >50% NV dưới 50, trend improving | target × 0.92 (-8%, thận trọng) |

### Kết quả đề xuất

Mỗi thay đổi trong đề xuất bao gồm:

```
node:           "Số chuyến giao"
thay đổi:       target_points: 150 → 200
confidence:     1.0  (3/3 kỳ đều thấy vấn đề)
trend:          stable
lý do:          "3/3 kỳ có >94% NV đạt ≥90. Trend ổn định.
                 Đề xuất tăng target +33% để phân biệt tốt–xuất sắc."
```

### Workflow sau khi có đề xuất

```
[Manager bấm "Phân tích 3 kỳ gần nhất"]
         │
         ▼
[Hệ thống sinh CalibrationProposal]
  Danh sách leaf cần điều chỉnh
  Với lý do + confidence + trend
         │
         ▼
[Manager review từng thay đổi]
  ✓ Chấp nhận — dùng giá trị đề xuất
  ✓ Chấp nhận — ghi đè giá trị khác (override)
  ✗ Bỏ qua — giữ nguyên leaf này
         │
         ▼
[Manager bấm "Tạo phiên bản draft"]
         │
         ▼
[Hệ thống clone tree hiện tại]
  Áp dụng các thay đổi được chấp nhận
  Ghi calibrationNotes tự động
  Tree mới = draft, chưa active
         │
         ▼
[Manager review draft → POST /criterion-trees/{id}/publish]
         │
         ▼
[Mở kỳ calibration tiếp theo với tree mới]
```

### Lưu ý quan trọng

- Proposal có hiệu lực **30 ngày** — sau đó hết hạn, cần phân tích lại
- Một tree chỉ có thể có **1 proposal đang pending** tại một thời điểm
- Hệ thống chỉ đề xuất thay đổi `target_points` — `weight` và `base_unit_points` vẫn cần điều chỉnh thủ công (đòi hỏi domain knowledge)
- Manager luôn là người quyết định cuối — hệ thống chỉ đề xuất, không tự áp dụng

---

## Đọc tiếp

- `02-template-va-versioning.md` — lifecycle của CriterionTree (draft → active → archived)
- `spec/business-rules.md` mục 17, 18 — Distribution Analysis + thuật toán 3 kỳ
- `spec/api-specification.md` nhóm "Calibration" — `POST /calibration/analyze`, `POST /calibration/proposals/{id}/accept`
- `spec/data-model.md` — `ScoringConfig`, `CalibrationProposal`, `EvalPeriod.mode`
