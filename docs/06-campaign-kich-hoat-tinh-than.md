# 06 · Campaign — Sự kiện Kích hoạt Tinh thần theo Dịp

## Vấn đề xuất phát

Hệ thống đánh giá 3 trụ cột (định lượng / chất lượng / phản hồi) hoạt động như một **bộ máy đo lường ổn định** — chạy đều đặn tháng/quý, công bằng, có thể dự đoán. Đây là điểm mạnh.

Nhưng đó cũng là điểm yếu: **bộ máy ổn định không tạo được cao trào**. Nhân viên cày tháng này cũng như tháng trước, cảm giác không có gì đặc biệt. Trong lúc cao điểm (nắng nóng tăng đơn, mùa Tết, flash sale), thiếu một cơ chế tạo **"cùng nhau vượt sóng"** — lính tráng dễ oải, áp lực dễ biến thành sự cố (như vụ Kho HN).

Đồng thời, có một bản năng con người mà framework đánh giá thuần tuý không chạm tới: **nhu cầu thuộc về, nhu cầu ăn mừng, nhu cầu được ghi nhận theo dịp đặc biệt**.

**Campaign** là module giải quyết bài toán này.

## Triết lý: Event-based boost, không phải gamification dài hạn

### Phân biệt quan trọng

Có hai cách áp "dopamine mechanics" vào môi trường làm việc. Chúng rất khác nhau về hiệu ứng dài hạn:

| Cách 1 — Gamification liên tục | Cách 2 — Event-based Campaign |
|-------------------------------|------------------------------|
| Points, levels, streaks hàng ngày | Sự kiện có thời hạn rõ (2 tuần, 1 tháng, 1 quý) |
| Leaderboard public real-time | Mục tiêu tập thể hoặc giải thưởng theo chủ đề |
| NV bị buộc tương tác liên tục | NV tham gia theo đợt, có khoảng nghỉ |
| Dopamine biến thành thói quen → khi hết → crash | Dopamine xuất hiện theo dịp → kết thúc lành mạnh |
| Dễ kích hoạt Goodhart's Law bền vững | Metric event chỉ tồn tại tạm thời |
| Dễ phá huỷ động lực nội tại | Ít tác động đến động lực dài hạn |
| Rủi ro cao trong lao động thể chất | An toàn hơn khi thiết kế đúng |

**Hệ thống này CHỈ dùng Cách 2.** Không có leaderboard hàng ngày, không có streak gây nghiện, không có notification spam. Chỉ có các **sự kiện có dịp**.

### 5 nguyên tắc đạo đức

1. **Dopamine cá nhân hoặc tập thể, không dopamine "nhục nhã"** — không hiển thị ai đứng cuối bảng công khai
2. **So sánh với chính bản thân hoặc mục tiêu chung** — không so sánh trực tiếp người với người
3. **Phần thưởng cho consistency và effort**, không chỉ cho peak performance
4. **Reward cho hành vi đúng quy trình**, đặc biệt trong lao động vận hành và kỹ thuật (đừng khen giao nhanh mà bỏ qua an toàn)
5. **Campaign là gia vị, không phải bữa ăn chính** — lương thưởng vẫn đến từ đánh giá 3 trụ cột bền vững

## Khi nào kích hoạt Campaign?

### Thời điểm tự nhiên

**Cao điểm vận hành theo dự đoán:**
- Nắng nóng mùa hè → đơn điều hòa, quạt tăng 40-60%
- Tết, mùa lễ → khối lượng gấp đôi bình thường
- Black Friday, flash sale → peak 3-7 ngày
- Back-to-school → đợt mua sắm gia đình tháng 8-9

**Mục tiêu công ty có dấu ấn:**
- Ra mắt sản phẩm mới, mở địa bàn
- Chuẩn bị gọi vốn, chuẩn bị IPO
- Đạt cột mốc (100k đơn/năm, phục vụ 50k khách, ...)

**Sau giai đoạn khó khăn:**
- Vừa qua một sự cố lớn (như Kho HN)
- Vừa mất khách lớn, cần xốc lại tinh thần
- Sau tái cấu trúc nhẹ

**Tín hiệu từ dữ liệu trong hệ thống:**
- Sự vụ `absence` tăng bất thường
- Phản hồi 360° âm tính cao hơn baseline
- Work logs cho thấy productivity giảm xuyên nhiều phòng

### Khi KHÔNG nên kích hoạt

- Quá thường xuyên (event mỗi tháng = không còn đặc biệt). Khoảng nghỉ giữa các campaign nên **tối thiểu 4-6 tuần**.
- Ngay sau event trước, chưa có ending ritual của event đó
- Khi đang có xung đột nội bộ chưa giải quyết → event thành chiến trường chính trị
- Khi đội vừa vượt quá tải nghiêm trọng → cần được nghỉ, không cần thêm thử thách

## 5 loại Campaign

### Loại 1: Team Goal — "Chiến dịch cao điểm"

**Use case:** Đối phó với cao điểm dự đoán được.

**Cơ chế:**
- Thời hạn rõ (VD: 2 tuần, 1 tháng)
- Mục tiêu **tập thể của đội**: *"Giao 10,000 đơn với tỷ lệ đúng giờ > 90%"*
- Thanh tiến độ chung cập nhật hàng ngày
- Reward **khi đội đạt**: chia đều, không phân biệt ai đóng góp nhiều hơn

**Điểm mấu chốt:** *Mục tiêu tập thể → phần thưởng tập thể*. Loại bỏ cạnh tranh độc hại, kích hoạt *"chúng ta cùng làm được"*. Người yếu hơn được đồng đội kéo lên.

**Ví dụ thực tế cho context của bạn:**
> **"Chiến dịch Mùa hè 2026"** — 1/6 đến 31/7
> Mục tiêu đội Giao hàng: giao 15,000 đơn tổng, tỷ lệ đúng giờ ≥ 88%
> Reward: tiệc BBQ + thưởng 500k/người khi đạt
> Bonus: nếu vượt 110% → thêm 1 ngày nghỉ mát

### Loại 2: Individual Awards — "Giải thưởng đặc biệt"

**Use case:** Hàng tháng/quý, tôn vinh đóng góp cụ thể theo chiều khác nhau.

**Cơ chế:**
- **Nhiều giải ngang hàng**, mỗi giải một tiêu chí độc lập
- Một người có thể đoạt nhiều giải
- Công bố trong cuộc họp đội, kèm câu chuyện cụ thể

**Ví dụ các giải:**
- **"Người giúp đỡ nhiều nhất"** — từ peer recognition (nhiều teamwork events)
- **"Cải thiện mạnh nhất"** — so với chính bản thân kỳ trước
- **"Ngôi sao khách hàng"** — nhiều customer_praise nhất
- **"Xử lý khủng hoảng"** — giải quyết sự cố tốt nhất
- **"Đáng tin cậy"** — ổn định nhất, không nghỉ, không trễ

**Điểm mấu chốt:** *Nhiều người được tôn vinh vì nhiều lý do khác nhau* → không ai cảm thấy mình là loser. Đặc biệt **"Cải thiện mạnh nhất"** cho hy vọng cho người đang đứng cuối bảng.

### Loại 3: Recognition Week — "Tuần lễ ghi nhận"

**Use case:** 1-2 lần/năm, xây dựng văn hoá biết ơn và hợp tác.

**Cơ chế:**
- Mỗi NV được phát 5 "lời cảm ơn" gửi cho đồng nghiệp
- Kèm lý do cụ thể (*"Cảm ơn anh đã giúp tôi lắp máy thứ ba, khách khó tính mà anh vẫn kiên nhẫn"*)
- Mỗi lời cảm ơn tự động tạo sự vụ `teamwork` (đã xác nhận)
- Cuối tuần: bảng tổng hợp cảm ơn mỗi người đã nhận được
- Người nhận nhiều nhất được công nhận, **không xếp hạng bottom**

**Điểm mấu chốt:** Phát hiện người giúp đỡ âm thầm mà hệ thống định lượng bỏ sót. Dopamine cho cả người cho và người nhận.

### Loại 4: Milestone Celebration — "Ăn mừng cột mốc"

**Use case:** Khi đội đạt cột mốc có ý nghĩa biểu tượng.

**Cơ chế:**
- *"Đội giao hàng vừa đạt 100,000 đơn trong năm"*
- *"Phòng bảo hành đã phục vụ 50,000 khách"*
- Công bố trang trọng, kèm số liệu và câu chuyện từ ngày đầu
- **Không có "winner"** — cả đội là winner
- Kỷ niệm vật chất nhẹ: áo đội, mũ, kỷ niệm chương có số đóng góp của mỗi NV

**Điểm mấu chốt:** Xây dựng identity đội ngũ. NV thấy mình không chỉ là "người giao hàng" mà là *"người đóng góp vào cột mốc 100,000 đơn"*.

### Loại 5: Skill Challenge — "Thử thách kỹ năng"

**Use case:** 1 lần/quý hoặc khi có kỹ năng mới cần lan toả.

**Cơ chế:**
- Thách thức liên quan đến **năng lực chuyên môn**, không chỉ số lượng
- Ví dụ đội KTV Bảo hành: *"Tháng này ai xử lý nhiều sự cố heavy mà không cần mang về xưởng?"*
- Có mentor, có thời gian học, có tài liệu
- Cuối kỳ: mỗi người chia sẻ 1 bài học đã rút ra
- Reward: badge *"Master Technician"* + cơ hội dạy lại đồng đội

**Điểm mấu chốt:** Biến event thành cơ hội mastery (thành thạo). Khai thác động lực nội tại "muốn giỏi hơn" thay vì thay thế nó bằng thưởng tiền.

## Nguyên tắc vận hành

### Trước Campaign

- **Công bố trang trọng:** mục tiêu, thời hạn, reward, cách đo — tất cả rõ ràng từ đầu
- **Không úp mở, không thay đổi luật giữa chừng** — là một dạng phản bội niềm tin
- **Kick-off meeting:** tập hợp đội, giải thích why, tạo hứng khởi ban đầu

### Trong Campaign

- **Cập nhật tiến độ 2-3 lần/tuần**, không hàng ngày (hàng ngày = spam)
- **Thông điệp động viên**, không đe doạ (*"Còn 5 ngày, cố lên!"* ✓, *"Còn 5 ngày, ai không đạt thì..."* ✗)
- **Visibility vừa phải:** widget nhỏ trên dashboard, không chiếm toàn màn hình

### Sau Campaign — quan trọng nhất

- **LUÔN LUÔN có ending ritual**, dù đạt hay không
- **Buổi tổng kết:** cảm ơn đội, chia sẻ câu chuyện, rút kinh nghiệm
- **Trao thưởng công khai** — không email âm thầm
- **Nghỉ giữa các campaign tối thiểu 4-6 tuần**

Campaign không có ending ritual = campaign thất bại, dù số liệu có đẹp đến đâu. Ritual là nơi dopamine được **chốt lại** thành ký ức tích cực lâu dài, thay vì fade away.

## Quan hệ với Lương và Thưởng

Đây là điểm **phải làm rõ từ đầu** để tránh nhầm lẫn nguy hiểm:

### Campaign reward là **BONUS**, không phải phần của lương

Lương + thưởng **theo đánh giá 3 trụ cột** là nguồn thu nhập chính và bền vững. Campaign reward là **gia vị thêm** cho dịp đặc biệt.

### Tại sao phải tách rời?

**Nếu biến campaign thành công cụ trả lương:**
- Campaign mất tính "vui vẻ" → biến thành KPI cứng gây stress
- Kích hoạt Goodhart's Law: NV chơi xấu để đạt mục tiêu campaign
- Người không tham gia được (nghỉ ốm, đi phép đúng dịp) bị thiệt thòi oan ức
- Lần sau có campaign, NV dè dặt vì *"không biết lần này có bị tính vào lương không"*

### Cách làm đúng

| Nguồn thu nhập | Bản chất | Tần suất |
|----------------|----------|----------|
| Lương cơ bản | Thoả thuận lao động | Hàng tháng |
| Thưởng hiệu quả | Theo đánh giá 3 trụ cột | Hàng tháng/quý |
| Campaign reward | Bonus theo dịp | Thỉnh thoảng, không đều |

Campaign reward phù hợp: tiền mặt nhỏ (5-30% lương tháng), tiệc, voucher, kỷ niệm chương, **ngày nghỉ thêm**, trải nghiệm (đi nghỉ mát đội, ăn tối cao cấp). Đủ để tạo hứng thú, không đủ để biến việc làm thành cuộc đua sinh tử.

## Anti-patterns — Những gì KHÔNG nên làm

### 1. Leaderboard real-time công khai hàng ngày

Hiển thị NV đứng cuối → tạo sự nhục nhã. Trong văn hoá Á Đông, "mất mặt" trước đồng nghiệp là tổn thương nặng, gây nghỉ việc.

**Thay vào đó:** bảng tiến độ chung cả đội (không phân biệt cá nhân), hoặc chỉ public top 3-5 khi kết thúc.

### 2. Variable reward schedule kiểu slot machine

*"Có thể bạn sẽ nhận badge hôm nay, hoặc không!"* — kỹ thuật này cực kỳ gây nghiện, cực kỳ không phù hợp môi trường làm việc.

**Thay vào đó:** reward minh bạch, có công thức rõ ràng, predictable.

### 3. Notification spam dồn dập

*"Sắp hết giờ!"* *"Còn 3 tiếng!"* *"Đồng đội X vừa vượt lên!"* — notification là công cụ chiếm não. Lạm dụng = nhân viên ghét hệ thống, rời đi.

**Thay vào đó:** tối đa 2-3 notifications/tuần trong suốt campaign. Ngày kết thúc có 1 notification duy nhất.

### 4. Gamify những thứ nghiêm túc

Không thêm confetti animation khi NV báo cáo tai nạn lao động. Không có badge cho việc ghi nhận sự cố. Một số việc phải giữ tính nghiêm túc.

### 5. Campaign liên tục không khoảng nghỉ

Event 12/12 tháng = không còn là event, trở thành áp lực liên tục. Đội ngũ cần khoảng thở để hồi phục năng lượng.

**Thay vào đó:** tối đa 4-6 campaigns/năm, mỗi campaign 2-4 tuần, cách nhau ít nhất 4-6 tuần bình thường.

### 6. Shame-based motivation

*"Đội Giao hàng thua đội Lắp đặt tháng này"* — tạo đối đầu nội bộ, phá huỷ văn hoá hợp tác.

**Thay vào đó:** so sánh đội với **chính bản thân kỳ trước**, không so sánh đội với đội khác.

## Tích hợp vào Data Model

### Entity mới: Campaign

```typescript
type Campaign = {
  id: string;
  name: string;                    // "Chiến dịch Mùa hè 2026"
  description: string;
  type: CampaignType;              // 5 loại ở trên
  status: "draft" | "active" | "completed" | "cancelled";

  period: {
    from: ISO8601;
    to: ISO8601;
  };

  scope: {
    departmentIds?: string[];      // null = toàn công ty
    employeeIds?: string[];        // null = tất cả trong scope
  };

  // Cho Team Goal:
  goals?: CampaignGoal[];

  // Cho Individual Awards:
  awards?: CampaignAward[];

  // Reward mô tả (không gắn cứng vào hệ thống lương):
  reward_description: string;
  reward_budget?: number;           // Tham khảo, không auto trả

  created_by: string;              // User ID người phát động
  created_at: ISO8601;
  completed_at?: ISO8601;
  ending_ritual_done: boolean;     // Đảm bảo có tổng kết
};

type CampaignType =
  | "team_goal"
  | "individual_awards"
  | "recognition_week"
  | "milestone_celebration"
  | "skill_challenge";

type CampaignGoal = {
  id: string;
  metric: "work_points" | "work_count" | "ontime_rate" | "event_count";
  workTypeIds?: string[];          // Lọc loại công việc nếu cần
  eventCategories?: string[];      // Lọc loại sự vụ nếu cần
  target: number;
  current?: number;                // Cập nhật real-time
};

type CampaignAward = {
  id: string;
  title: string;                   // "Người giúp đỡ nhiều nhất"
  criteria: string;                // Mô tả cách chấm
  metric_source: "peer_recognition" | "improvement" | "customer_praise" | "consistency" | "manual";
  winners?: string[];              // Điền cuối kỳ
};
```

### Entity mới: PeerRecognition

Cho Recognition Week và cũng có thể dùng hàng ngày (tuỳ chọn):

```typescript
type PeerRecognition = {
  id: string;
  from_employee_id: string;
  to_employee_id: string;
  reason: string;                  // Bắt buộc, min 20 ký tự
  campaign_id?: string;            // Nếu thuộc campaign
  created_at: ISO8601;

  // Tự động tạo một Event teamwork tương ứng:
  generated_event_id?: string;
};
```

## Tích hợp vào API

### Endpoint mới: POST /api/v1/campaigns

Tạo campaign mới (chỉ admin/manager).

### Endpoint mới: GET /api/v1/campaigns/active

Lấy danh sách campaign đang active (cho widget dashboard nhân viên).

### Endpoint mới: GET /api/v1/campaigns/{id}/progress

Lấy tiến độ campaign hiện tại.

```json
{
  "campaign_id": "cmp_summer_2026",
  "name": "Chiến dịch Mùa hè 2026",
  "period": { "from": "2026-06-01", "to": "2026-07-31" },
  "days_remaining": 12,
  "goals": [
    {
      "metric": "work_count",
      "target": 15000,
      "current": 9847,
      "progress_percent": 65.6,
      "on_track": true
    },
    {
      "metric": "ontime_rate",
      "target": 88,
      "current": 91.2,
      "progress_percent": 103.6,
      "on_track": true
    }
  ],
  "message": "Đội đang vượt target, cố gắng duy trì!"
}
```

### Endpoint mới: POST /api/v1/peer-recognitions

Gửi lời cảm ơn đồng nghiệp.

```json
POST /api/v1/peer-recognitions
{
  "to_employee_id": "emp_cuong",
  "reason": "Cảm ơn anh đã giúp tôi lắp máy điều hòa cho khách khó tính hôm thứ ba. Anh kiên nhẫn giải thích từng bước."
}
```

Tự động tạo event `teamwork` với status `confirmed` (không cần xác nhận vì đã có proof là lời cảm ơn cụ thể).

## Tích hợp với Evaluation Framework (3 trụ cột)

### Cách 1: Campaign không can thiệp vào chấm điểm

**Mặc định.** Campaign và lương thưởng đi riêng. Chỉ số đánh giá 3 trụ cột không có mục "đã tham gia campaign X".

**Ưu điểm:** Đơn giản, không rủi ro Goodhart's Law, giữ campaign "sạch" như một dịp vui.

### Cách 2: Campaign gián tiếp ảnh hưởng qua sự vụ

**Khi NV được ghi nhận** trong campaign (đoạt award, được peer recognition), hệ thống tự động tạo sự vụ positive (initiative, teamwork, customer_praise tuỳ loại) → sự vụ này được tính bình thường vào Pillar 3 của đánh giá.

**Ưu điểm:** Đóng góp trong campaign được ghi vào hồ sơ dài hạn của NV mà không cần thiết kế cơ chế đặc biệt.

**Hệ thống này nên dùng Cách 2.**

## UI: Widget Campaign trên dashboard NV

Dashboard cá nhân của NV có thêm 1 khối (nhỏ, không phô trương):

```
┌─────────────────────────────────────────┐
│ 🌞 Chiến dịch Mùa hè 2026               │
│                                          │
│ Đội đã giao: 9,847 / 15,000 đơn         │
│ ████████████░░░░░░░░  65.6%             │
│                                          │
│ Tỷ lệ đúng giờ: 91.2% (mục tiêu 88%) ✓  │
│                                          │
│ Còn 12 ngày · Đang vượt target 🎉       │
└─────────────────────────────────────────┘
```

**Lưu ý UI:**
- Chỉ hiện khi có campaign active
- Không hiện tên NV khác, không hiện bảng xếp hạng
- Màu sắc tích cực, không stress (đỏ cảnh báo chỉ khi thực sự cần)
- Click vào để xem chi tiết, không tự động popup

## Checklist khi thiết kế một Campaign cụ thể

Trước khi phát động, trả lời được các câu sau:

- [ ] **Tại sao có campaign này?** Lý do có chính đáng, không phải copy xu hướng
- [ ] **Mục tiêu SMART?** Specific, Measurable, Achievable, Relevant, Time-bound
- [ ] **Reward có đủ hấp dẫn?** Nhưng không đủ để biến thành áp lực sinh tử
- [ ] **Ai KHÔNG tham gia được?** NV đang nghỉ phép, nghỉ ốm — có tính đến không?
- [ ] **Có cơ chế an toàn?** Không khuyến khích bỏ qua quy trình, an toàn để chạy đua
- [ ] **Có ending ritual planned?** Ai tổ chức, ở đâu, khi nào
- [ ] **Liệu có thể kích hoạt Goodhart's Law?** Nếu NV tối ưu metric này, họ có hy sinh gì không?
- [ ] **Có nhầm lẫn với lương cơ bản không?** NV hiểu đây là bonus, không phải base pay
- [ ] **Campaign trước đã kết thúc gọn?** Không chồng campaign liên tiếp

## Đọc tiếp

- `spec/data-model.md` — data model cho Campaign, PeerRecognition
- `spec/api-specification.md` — endpoints Campaign
- `spec/business-rules.md` — validation, idempotency, scoring interaction
