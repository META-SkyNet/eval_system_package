# 03 · Sự vụ & Ghi nhận (Events / Incidents)

## Sự vụ là gì

Một **sự vụ** là một lần xảy ra cụ thể, có thời điểm, có nhân vật, có mức độ — khác hẳn với chỉ số định lượng tự động đếm.

**Ví dụ:**
- "15/4, khách ở Cầu Giấy khen anh Nam giao nhanh, lắp đặt cẩn thận" → sự vụ `customer_praise`
- "18/4, anh Bình làm vỡ kính tủ khi vận chuyển, thiệt hại ~2tr" → sự vụ `incident_damage`
- "20/4, anh Cường chủ động ở lại sau giờ hỗ trợ đơn gấp" → sự vụ `extra_effort`

Sự vụ là **dữ liệu thô** nuôi cho Trụ cột 3 (Phản hồi & Sự cố) và bổ sung cho Trụ cột 2 (một số category sự vụ gắn với chỉ số scale như "Chăm chỉ", "Tay nghề").

## Tại sao phải có module này

**Không có:** QL cuối tháng ngồi nhớ lại "thằng nào tháng này có gì đặc biệt?" — trí nhớ không công bằng, hay thiên vị người để ý.

**Có:** Sự vụ ghi ngay khi xảy ra. Cuối tháng có sẵn danh sách, chỉ việc cộng vào chỉ số tương ứng.

## 5 quyết định thiết kế quan trọng

### 1. Sự vụ gắn vào đâu?

Không gắn vào template (vì template thay đổi). Gắn vào **nhân viên + thời điểm + nhãn loại sự vụ**. Khi chấm điểm, hệ thống map loại sự vụ → chỉ số tương ứng trong template đang active.

### 2. Ai được ghi nhận?

**Mở cho tất cả bộ phận liên quan**, không chỉ QL trực tiếp. Bán hàng nghe khách khen giao hàng → Bán hàng ghi. Kho thấy giao hàng cẩu thả → Kho ghi. Đồng nghiệp thấy ai đó giúp đỡ → ghi.

Đây là điều kiện để đánh giá khách quan, thoát khỏi cảm tính của một mình QL.

### 3. Chống lạm dụng như thế nào?

- Mỗi sự vụ có **người ghi nhận** (name + thời điểm) — không ẩn danh
- QL trực tiếp của NV được ghi nhận có quyền **gắn cờ tranh luận**
- Sự vụ nặng (thiệt hại, kỷ luật) cần **xác nhận** mới tính vào đánh giá
- Sự vụ ở trạng thái `pending` không được cộng vào điểm

### 4. Mức độ sự vụ

3 mức đơn giản, tránh phức tạp hoá:

| Mức độ | Hệ số | Ý nghĩa |
|--------|-------|---------|
| `light` | ×1 | Việc nhỏ, thường ngày |
| `medium` | ×2 | Đáng ghi nhận, có tác động |
| `heavy` | ×4 | Nghiêm trọng, cần quan tâm đặc biệt |

Hệ số cần **hiệu chuẩn theo thực tế** công ty. Ví dụ một sự cố heavy có thể phải ×10 trong môi trường nhạy cảm hơn.

### 5. Nguồn gốc sự vụ

Phân biệt 3 nguồn:

| Nguồn | Ai ghi | Ví dụ |
|-------|--------|-------|
| `customer` | CSKH, Bán hàng nhận từ khách | Khách gọi khiếu nại, khách review online |
| `internal` | Đồng nghiệp, QL | Thấy đồng nghiệp giúp đỡ, QL phát hiện sai sót |
| `automatic` | Hệ thống sinh ra | NV quá X km ngoài giờ, trễ giờ 3 lần/tuần |

Nguồn khác nhau có thể có trọng số khác nhau khi tính điểm (VD: phàn nàn từ khách nặng hơn phàn nàn nội bộ).

## Danh mục loại sự vụ chuẩn

| Category | Polarity | Ý nghĩa | Gắn với pillar mặc định |
|----------|----------|---------|------------------------|
| `customer_praise` | + | Khách khen | feedback |
| `customer_complaint` | − | Khách phàn nàn | feedback |
| `incident_damage` | − | Sự cố, thiệt hại | feedback |
| `initiative` | + | Sáng kiến, chủ động | qualitative |
| `extra_effort` | + | Làm thêm, xông xáo | qualitative |
| `absence` | − | Nghỉ, không chăm | qualitative |
| `teamwork` | + | Hỗ trợ đồng đội | qualitative |
| `skill_issue` | − | Thiếu kỹ năng, sai sót | qualitative |

Có thể mở rộng thêm theo nhu cầu, nhưng càng ít càng tốt (nhân viên lười điền nếu quá nhiều loại).

## Vòng đời sự vụ

```
    [Tạo mới]
       │
       ▼
  ┌──────────┐
  │ PENDING  │ ← mới tạo, chưa tính vào điểm
  └──────────┘
       │
       ├─── [QL xác nhận] ──▶ CONFIRMED   (tính vào điểm)
       │
       ├─── [Tranh luận]  ──▶ DISPUTED    (tạm giữ, chưa tính)
       │
       └─── [Xoá]         ──▶ (hard delete, có log audit)
```

## Liên kết sự vụ ↔ công việc

Sự vụ có thể gắn với một **work log cụ thể** qua `relatedWorkLogId`. Ví dụ:

- Anh Bình giao đơn cồng kềnh → làm vỡ kính → tạo sự vụ `incident_damage` gắn với đơn đó
- Chị Hoa giao + lắp điều hòa → khách gọi CSKH khen → tạo sự vụ `customer_praise` gắn với đơn đó

Khi điều tra sau này, truy được ngay "sự cố này xảy ra trong công việc nào".

## Đặc tả data model

```typescript
type Event = {
  id: string;
  employeeId: string;           // Ai được ghi nhận
  category: EventCategory;      // Một trong 8 loại
  severity: "light" | "medium" | "heavy";
  source: "customer" | "internal" | "automatic";
  occurredAt: ISO8601;          // Khi nào xảy ra
  reportedBy: string;           // Ai ghi nhận (tên, không ẩn danh)
  description: string;          // Mô tả chi tiết (bắt buộc)
  status: "pending" | "confirmed" | "disputed";
  createdAt: ISO8601;
  confirmedAt?: ISO8601;
  confirmedBy?: string;

  relatedWorkLogId?: string;    // Gắn với công việc cụ thể
  externalId?: string;          // Nếu đến từ CRM/ERP qua API
};
```

## Công thức tính điểm sự vụ

Điểm ròng sự vụ của một nhân viên trong kỳ:

```
điểm_ròng = Σ (severity_multiplier) cho các sự vụ positive đã confirmed
          − Σ (severity_multiplier) cho các sự vụ negative đã confirmed
```

**Ví dụ:**
- 3 sự vụ `customer_praise` (medium, medium, light) = 2 + 2 + 1 = +5
- 1 sự vụ `incident_damage` (heavy) = −4
- Điểm ròng = +5 − 4 = +1

Điểm ròng này được normalize (chuẩn hoá) theo thang của Pillar 3 trong template để cộng vào tổng điểm.

## Đọc tiếp

- `04-khai-quat-hoa-cong-viec.md` — mô hình hóa công việc qua Work Unit catalog
- `05-tich-hop-crm-erp.md` — sự vụ cũng có thể đến từ CRM qua API
