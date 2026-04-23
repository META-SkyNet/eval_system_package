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

## Đọc tiếp

- `02-template-va-versioning.md` — lifecycle của CriterionTree (draft → active → archived)
- `spec/business-rules.md` mục 17 — Distribution Analysis thresholds và quy tắc calibration
- `spec/data-model.md` — `ScoringConfig`, `EvalPeriod.mode`, `CriterionTree.calibrationNotes`
