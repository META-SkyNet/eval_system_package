# 04 · Khái quát hoá Công việc qua Work Unit Catalog

## Vấn đề cốt lõi

"Số đơn giao" là chỉ số tốt cho NV giao hàng đồ nhỏ. Nhưng:

- NV A giao 30 đơn nhỏ/ngày (mỗi đơn 10 phút)
- NV B lắp 3 máy điều hòa/ngày (mỗi máy 2 tiếng)
- NV C đi bảo hành 2 ca kéo dài 3 ngày

**Đếm thô thì A thắng 30:3:2** — nhưng thực tế B có thể làm nhiều hơn A về công sức.

Cần tầng trung gian: **đơn vị công việc (Work Unit)** với **"điểm công" (effort points)** riêng cho từng loại.

## Mô hình: Work Unit Catalog

### Ý tưởng cốt lõi

Mỗi phòng ban tự định nghĩa **danh mục loại công việc** của mình, mỗi loại có **điểm công** thể hiện độ nặng/phức tạp/thời gian chuẩn. Toàn bộ hệ thống đánh giá định lượng không đếm "số đơn" nữa mà đếm **tổng điểm công**.

### Ví dụ: Phòng Giao hàng

| Mã | Tên loại công việc | Điểm công | Ghi chú |
|----|-------------------|-----------|---------|
| `GIAO_NHO` | Giao đơn nhỏ (≤5kg) | 1 | đồ gia dụng nhỏ, giao nhanh |
| `GIAO_LON` | Giao đơn cồng kềnh | 3 | cần 2 người, xe tải |
| `LAP_CB` | Lắp đặt cơ bản | 5 | tủ lạnh, máy giặt đơn giản |
| `LAP_DH` | Lắp đặt điều hòa | 10 | bao gồm đi ống, test |
| `LAP_BNL` | Lắp bình nóng lạnh | 8 | cần đi điện/nước |
| `GIAO_LAP` | Giao + lắp trọn gói | 12 | cho SP cao cấp |

### Ví dụ: Phòng Kho

| Mã | Tên | Điểm |
|----|-----|------|
| `PICK_1` | Pick 1 SKU đơn lẻ | 0.5 |
| `PICK_N` | Pick đơn phức tạp (>5 SKU) | 2 |
| `NHAP_PL` | Nhập 1 pallet | 3 |
| `KIEM_KE` | Kiểm kê 1 khu | 8 |
| `SAP_XEP` | Sắp xếp, gộp vị trí | 1.5 |

### Ví dụ: Phòng Bảo hành

| Mã | Tên | Điểm |
|----|-----|------|
| `TV_PHONE` | Tư vấn qua điện thoại | 1 |
| `DI_KIEM` | Đến nhà khách kiểm tra | 4 |
| `SUA_TC` | Sửa chữa tại chỗ | 6 |
| `MANG_XUONG` | Mang về xưởng sửa | 10 |
| `THAY_BH` | Thay thế bảo hành | 5 |

## Work Log: Ghi nhận công việc đã làm

Khi NV hoàn thành một đơn vị công việc, hệ thống ghi một **Work Log**:

```typescript
type WorkLog = {
  id: string;
  employeeId: string;
  workTypeId: string;            // Tham chiếu vào Work Unit catalog
  quantity: number;              // Thường là 1, có thể > 1 nếu gộp
  status: WorkStatus;            // completed_ontime | completed_late | completed_issue | failed
  completedAt: ISO8601;
  note?: string;
  relatedEventId?: string;       // Nếu công việc này sinh ra sự vụ

  externalId?: string;           // Nếu đến từ CRM qua API — idempotency key
  source?: "manual" | "crm" | "erp" | string;
};
```

### Điểm công tính được

```
points = workType.points × quantity
```

**Ví dụ:** NV Long làm 1 `MANG_XUONG` (10 điểm/đv) × 1 = **10 điểm**.

## Liên kết với Template

Template có 3 loại chỉ số định lượng tự tính từ Work Logs:

### 1. `work_points` — Tổng điểm công

Công thức:
```
score = Σ (points) cho các WorkLog của NV trong kỳ
```

Field `workTypeIds`:
- `null` → tính trên tất cả loại công việc của phòng
- `["wt_d3", "wt_d4"]` → chỉ tính các loại cụ thể

### 2. `work_count` — Số việc loại cụ thể

Công thức:
```
score = Σ (quantity) cho các WorkLog thuộc workTypeIds trong kỳ
```

**Bắt buộc** có `workTypeIds` (khác `null`).

**Ví dụ:** "Số đơn lắp đặt" → `workTypeIds: ["LAP_CB", "LAP_DH", "LAP_BNL", "GIAO_LAP"]`

### 3. `work_quality` — Tỷ lệ đạt chất lượng

Công thức:
```
score = (Σ quantity where status == "completed_ontime") / (Σ quantity total) × 100
```

Trả về %, không phải số đếm.

## Lợi ích của mô hình

### 1. So sánh công bằng trong cùng phòng

NV A làm 30 điểm/ngày, NV B làm 28 điểm/ngày — rõ ràng ngay cả khi loại việc khác nhau.

### 2. Khung template không đổi

Chỉ số "Kết quả định lượng" luôn là *"Tổng điểm công"* — áp được cho mọi phòng. Khung 3 trụ cột 50/30/20 vẫn nguyên.

### 3. Điều chỉnh được theo thực tế

Ban đầu ước lượng *"lắp điều hòa = 10 điểm"* là phỏng đoán. Sau 2 tháng thấy thực tế mất nhiều thời gian hơn → chỉnh thành 12. Template không đổi, logs cũ vẫn còn — chỉ hệ số thay đổi.

### 4. Ghi nhận trạng thái đa chiều

Một work log không chỉ có "xong/chưa xong" mà còn *đúng giờ / trễ*, *đạt chất lượng / có lỗi*, *có phát sinh sự vụ đi kèm không* (qua `relatedEventId`).

## Vấn đề cần lưu ý khi triển khai

### Hiệu chỉnh điểm công định kỳ

Điểm công ước lượng ban đầu sẽ sai lệch so với thực tế. Cần quy trình **3-6 tháng review** lại tất cả điểm công dựa trên dữ liệu thực tế (số giờ trung bình mỗi loại, số NV cần thiết, v.v.).

**Version hoá catalog** có thể cần thiết nếu điều chỉnh thường xuyên — hiện tại trong artifact chưa làm, nhưng có thể thêm sau nếu muốn.

### Điểm công theo độ khó ngoài cảnh

Giao 1 đơn nội thành khác giao 30km ngoại thành. Hai cách mở rộng:

**Cách 1:** Tách thành nhiều loại công việc cụ thể hơn: `GIAO_NOI_THANH`, `GIAO_NGOAI_THANH`.

**Cách 2:** Thêm *"hệ số môi trường"* vào work log (vùng, thời tiết, loại khách), nhân với điểm công.

Cách 1 đơn giản hơn, khuyên dùng trước.

### Chuẩn hóa giữa phòng

Đội Bảo hành chủ yếu tư vấn phone (1đ/ca), Giao hàng chủ yếu lắp đặt (10đ/ca) → *"điểm công tuyệt đối"* không so sánh được giữa phòng.

**Giải pháp:** Khi tổng hợp xuyên phòng, không dùng điểm tuyệt đối mà dùng **% so với baseline của phòng**: *"NV X đạt 120% điểm công trung bình của phòng"*.

Mô hình tính tỷ lệ này chưa được hiện thực hoá trong artifact — là điểm mở rộng tự nhiên khi scale lên nhiều phòng.

## Đặc tả data model

```typescript
type WorkCatalog = {
  id: string;
  departmentId: string;
  name: string;
  unitTypes: WorkUnitType[];
};

type WorkUnitType = {
  id: string;
  code: string;                 // "LAP_DH" — stable identifier, dùng trong API
  name: string;                 // "Lắp đặt điều hòa"
  points: number;               // Điểm công cơ bản
  note?: string;
};

type WorkLog = {
  id: string;
  employeeId: string;
  workTypeId: string;
  quantity: number;
  status: "completed_ontime" | "completed_late" | "completed_issue" | "failed";
  completedAt: ISO8601;
  note?: string;

  relatedEventId?: string;
  externalId?: string;          // Từ CRM/ERP
  source?: string;
};
```

## Đọc tiếp

- `05-tich-hop-crm-erp.md` — Work Logs chủ yếu đến từ CRM qua API
- `spec/api-specification.md` — endpoint `POST /work-events` tạo Work Log
