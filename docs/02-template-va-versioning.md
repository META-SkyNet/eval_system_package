# 02 · Template & Versioning

## Template là gì

Template là biểu diễn cụ thể của khung 3 trụ cột cho một phòng ban. Cùng một phòng có thể có nhiều template (VD: "Đánh giá NV giao hàng mới dưới 6 tháng" và "Đánh giá NV giao hàng chính thức"), nhưng thường mỗi phòng có 1 template chính.

## Cấu trúc 3 tầng

```
Phòng ban
  └── Template
        └── Version (v1.0, v2.0, v3.0...)
              └── Pillars (3 trụ cột, cố định)
                    └── Questions (chỉ số con)
```

### Ví dụ: Template Giao hàng v1.0

```
Template: "Đánh giá NV Giao hàng"
├── Pillar 1 (Định lượng, trọng số 50%)
│   ├── Q1: Tổng điểm công trong kỳ (60%)
│   ├── Q2: Tỷ lệ công việc đúng hạn (25%)
│   └── Q3: Số đơn lắp đặt (15%)
├── Pillar 2 (Chất lượng 360°, trọng số 30%)
│   ├── Q4: Chăm chỉ (30%)
│   ├── Q5: Tay nghề kỹ thuật (35%)
│   ├── Q6: Thái độ khách hàng (20%)
│   └── Q7: Hợp tác đồng đội (15%)
└── Pillar 3 (Phản hồi/Sự cố, trọng số 20%)
    ├── Q8: Khách khen (40%)
    ├── Q9: Khiếu nại (40%)
    └── Q10: Sự cố thiệt hại (20%)
```

## Loại chỉ số (Question types)

| Loại | Ý nghĩa | Nguồn tính |
|------|---------|-----------|
| `number` | Số liệu thô nhập tay | Admin nhập |
| `work_points` | Tổng điểm công | Tự tính từ work logs |
| `work_count` | Số việc loại cụ thể | Tự tính từ work logs, lọc theo `workTypeIds` |
| `work_quality` | Tỷ lệ đạt chất lượng | Tự tính từ work logs (ontime / total) |
| `scale` | Thang điểm 1-5 | Form 360° |
| `yesno` | Có/Không | Form 360° |
| `event` | Sự vụ ± | Tự tính từ events |

## Versioning: Tại sao và cách hoạt động

### Tại sao cần version

Template đánh giá sẽ thay đổi theo thời gian — thêm chỉ số mới, điều chỉnh trọng số, bỏ chỉ số không dùng. Nhưng **lịch sử đánh giá phải giữ được**: "quý 1/2026 đã chấm theo tiêu chí nào?" phải trả lời được 5 năm sau.

Giải pháp: template có nhiều version, chỉ một version **active** tại một thời điểm, version đã publish thì không sửa được.

### Vòng đời của version

```
      [Tạo mới]
         │
         ▼
    ┌─────────┐     [Publish]      ┌───────────┐
    │  DRAFT  │ ──────────────────▶│  ACTIVE   │
    └─────────┘                    └───────────┘
         │                              │
         │ Có thể sửa                   │ [Version mới publish]
         │                              ▼
         │                         ┌───────────┐
         └────────────────────────▶│ ARCHIVED  │
                                   └───────────┘
                                   (giữ để truy xuất lịch sử)
```

### Quy tắc

1. **Version mới tạo ra luôn ở trạng thái `draft`** — sửa thoải mái
2. **Publish cần điều kiện**: tổng trọng số các trụ cột = 100%
3. **Khi publish version mới**: version active cũ tự chuyển thành `archived`
4. **Version archived không bao giờ xoá** — dữ liệu lịch sử đã chấm theo version đó vẫn phải truy xuất được
5. **Tạo version mới bằng cách clone** từ version bất kỳ (thường là active), rồi sửa

## Gắn sự vụ & loại công việc vào chỉ số

Đây là cơ chế liên kết template với dữ liệu thô.

### Gắn sự vụ (linkedEventCategories)

Chỉ số `event` hoặc `scale` có thể khai báo: *"chỉ số này tính cộng dồn từ những loại sự vụ nào"*.

**Ví dụ:**
- Chỉ số "Chăm chỉ" (scale) → gắn với categories `absence` và `extra_effort`
- Chỉ số "Tay nghề kỹ thuật" (scale) → gắn với category `skill_issue`
- Chỉ số "Khiếu nại từ khách" (event) → gắn với category `customer_complaint`

Khi chấm điểm cuối kỳ, hệ thống tự cộng các sự vụ đã xác nhận vào đúng chỉ số.

### Gắn loại công việc (workTypeIds)

Chỉ số `work_points`, `work_count`, `work_quality` có field `workTypeIds`:

- `null` → tính trên **tất cả loại công việc** của phòng
- `["wt_d3", "wt_d4"]` → chỉ tính các loại công việc cụ thể (VD: chỉ đếm các đơn lắp đặt, không đếm đơn giao thường)

## Đặc tả data model (tóm tắt)

```typescript
type Template = {
  id: string;
  departmentId: string;
  name: string;
  description: string;
  activeVersionId: string | null;
  versions: Version[];
};

type Version = {
  id: string;
  versionNumber: string;        // "1.0", "2.0"
  status: "draft" | "published" | "archived";
  createdAt: ISO8601;
  publishedAt?: ISO8601;
  basedOn?: string;             // versionNumber của bản gốc nếu clone
  pillars: Pillar[];
};

type Pillar = {
  id: string;
  type: "quantitative" | "qualitative" | "feedback";  // Cố định 3 loại
  weight: number;               // 0-100, tổng 3 pillar phải = 100
  questions: Question[];
};

type Question = {
  id: string;
  label: string;
  type: QuestionType;           // Xem bảng trên
  weight: number;               // 0-100 trong pillar
  linkedEventCategories?: string[];  // Cho loại event, scale
  workTypeIds?: string[] | null;     // Cho loại work_*
};
```

Chi tiết xem `spec/data-model.md`.

## Đọc tiếp

- `03-su-vu-va-ghi-nhan.md` — chi tiết module Sự vụ
- `04-khai-quat-hoa-cong-viec.md` — hệ thống Work Unit + điểm công
