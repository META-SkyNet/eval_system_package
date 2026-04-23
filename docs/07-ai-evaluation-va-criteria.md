# 07 · AI Evaluation & Criteria

## Triết lý cốt lõi

**AI là trợ lý đọc dữ liệu, không phải giám khảo cuối cùng.**

Mỗi phòng ban đã có dữ liệu công việc dạng JSON từ hệ thống nghiệp vụ sẵn có (CRM, ERP, chat system...). Module này cho phép gắn **tiêu chí đánh giá** vào từng loại công việc để AI đọc JSON đó và chấm điểm tự động — nhưng kết quả luôn ở trạng thái `pending`, chờ QL xác nhận trước khi tính vào điểm nhân viên.

Không có AI nào tự quyết trừ điểm hay cộng điểm mà không qua con người.

---

## Vấn đề module này giải quyết

Không phải mọi công việc đều có thể đếm bằng số. Một phiên chat CSKH, một đơn thu mua, một ca xử lý khiếu nại — đều có chất lượng, nhưng chất lượng đó không tự nhiên thành số. QL không có thời gian đọc hàng trăm log hàng ngày.

AI giải quyết phần đọc và phân loại — con người giải quyết phần phán quyết cuối.

---

## Cách module hoạt động

```
┌─────────────────────┐     JSON công việc
│ Hệ thống nghiệp vụ  │─────────────────────┐
│ (CRM, ERP, Chat)    │                     │
└─────────────────────┘                     ▼
                                  ┌──────────────────────────┐
                                  │ POST /api/v1/ai-evaluations │
                                  └──────────────┬───────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────┐
                                  │  Evaluation Engine        │
                                  │                          │
                                  │  1. Load criteria (active │
                                  │     version của work_type) │
                                  │  2. Validate input schema │
                                  │  3. Build AI prompt      │
                                  │  4. Call AI API          │
                                  │  5. Parse → cấu trúc     │
                                  └───────┬──────┬───────────┘
                                          │      │
                          ┌───────────────┘      └────────────────┐
                          ▼                                       ▼
              ┌───────────────────┐                  ┌─────────────────────┐
              │ WorkLog (pending) │                  │ Event (pending)      │
              │ Tạo work log với  │                  │ Tạo nếu scoring_rule │
              │ status AI gợi ý  │                  │ có auto_flag_event   │
              └─────────┬─────────┘                  └──────────┬──────────┘
                        │                                        │
                        └─────────────────┬──────────────────────┘
                                          ▼
                               ┌─────────────────────┐
                               │ QL review & confirm │
                               │ Duyệt hoặc dispute  │
                               └─────────────────────┘
```

---

## Cấu trúc Criteria trên CriterionNode

Mỗi leaf node với `eval_type='ai'` chứa criteria trong trường `description` (ngôn ngữ nghiệp vụ) và JSON payload dưới đây. Immutability đến từ CriterionTree versioning — khi tree active, description của leaf là bất biến. Muốn thay đổi criteria → tạo tree version mới, publish, tree cũ tự archive.

```json
{
  "version": "1.0",
  "status": "active",
  "description_for_ai": "Mô tả ngắn bản chất công việc cho AI hiểu context nghiệp vụ, không phải kỹ thuật.",

  "input_schema": {
    "required_fields": ["order_id", "deadline", "delivered_at", "status"],
    "optional_fields": ["customer_rating", "notes"]
  },

  "scoring_rules": [
    {
      "rule_id": "ontime",
      "description": "Đúng hạn giao hàng",
      "evaluation": "Hướng dẫn AI cách đọc field nào, tính như thế nào",
      "scoring": {
        "excellent": "Mô tả ngưỡng excellent → điểm cộng/trừ",
        "good": "Mô tả ngưỡng trung bình → điểm",
        "poor": "Mô tả ngưỡng kém → điểm trừ"
      },
      "auto_flag_event": {
        "condition": "Điều kiện khi nào sinh sự vụ tự động",
        "creates_event": {
          "category": "incident",
          "severity": "heavy"
        }
      }
    }
  ],

  "red_flags": [
    "Pattern bất thường AI phải báo cáo — không chấm điểm mà alert riêng"
  ],

  "context_to_consider": [
    "Sắc thái nghiệp vụ AI cần biết để không chấm máy móc",
    "Ví dụ: mùa cao điểm deadline có thể trễ hơn bình thường"
  ],

  "created_at": "2026-04-22T00:00:00Z",
  "created_by": "thuy_hr"
}
```

---

## Ví dụ criteria theo từng phòng

### Phòng Thu mua — PO Standard

```json
{
  "version": "1.0",
  "status": "active",
  "description_for_ai": "Đánh giá chất lượng thực hiện một đơn mua hàng (PO). Xem xét độ đúng hạn, chất lượng hàng nhập, và mức giá so với thị trường. Đây là công việc có tính chất thương mại — cần cân nhắc cả ngắn hạn (giá rẻ ngay) lẫn dài hạn (quan hệ nhà cung cấp).",

  "input_schema": {
    "required_fields": ["po_id", "deadline", "delivered_at", "quoted_price", "quality_check"],
    "optional_fields": ["market_price_estimate", "supplier_rating", "items"]
  },

  "scoring_rules": [
    {
      "rule_id": "deadline",
      "description": "Đúng hạn giao hàng từ nhà cung cấp",
      "evaluation": "Tính số ngày chênh lệch giữa delivered_at và deadline. Âm = sớm, dương = trễ.",
      "scoring": {
        "excellent": "Đúng hạn hoặc sớm hơn (≤0 ngày) → +2",
        "good": "Trễ 1–3 ngày, có ghi chú lý do → 0",
        "poor": "Trễ >3 ngày mà không có ghi chú → −2"
      },
      "auto_flag_event": {
        "condition": "Trễ > 7 ngày",
        "creates_event": {
          "category": "incident",
          "severity": "normal"
        }
      }
    },
    {
      "rule_id": "price",
      "description": "Giá so với thị trường",
      "evaluation": "So sánh quoted_price với market_price_estimate nếu có. Nếu không có market_price_estimate → skip rule này, không chấm.",
      "scoring": {
        "excellent": "Giá thấp hơn market ≥5% → +2",
        "good": "Giá trong khoảng ±5% market → +1",
        "poor": "Giá cao hơn market >5% mà không có ghi chú lý do → −2"
      }
    },
    {
      "rule_id": "quality",
      "description": "Chất lượng hàng khi nhập kho",
      "evaluation": "Đọc quality_check, đếm hoặc ước lượng tỷ lệ defective.",
      "scoring": {
        "excellent": "0 defective → +2",
        "good": "1–2 defective trong lô lớn (>100 items) → 0",
        "poor": ">5% defective → −3"
      },
      "auto_flag_event": {
        "condition": ">10% defective",
        "creates_event": {
          "category": "incident",
          "severity": "heavy"
        }
      }
    }
  ],

  "red_flags": [
    "Cùng buyer, cùng supplier, nhiều PO liên tiếp không qua đấu giá → có thể conflict of interest",
    "Giá biến động >20% giữa các PO cùng mặt hàng trong 1 tháng → flag bất thường",
    "delivered_at trùng khớp deadline chính xác nhiều lần liên tiếp → có thể nhập dữ liệu giả"
  ],

  "context_to_consider": [
    "Mùa Tết và cao điểm: nhà cung cấp bận, deadline trễ 1–3 ngày là bình thường",
    "Supplier mới (PO đầu tiên): cho thêm 1 tuần buffer",
    "Hàng đặc thù / nhập khẩu: market_price_estimate không đáng tin, skip rule price"
  ]
}
```

---

### Phòng CSKH — Phiên chat Zalo/Facebook

```json
{
  "version": "1.0",
  "status": "active",
  "description_for_ai": "Đánh giá một phiên chat chăm sóc khách hàng qua Zalo hoặc Facebook Messenger. Tập trung vào tốc độ phản hồi, thái độ của agent, và chất lượng giải quyết vấn đề. Lưu ý: khách hàng đôi khi dùng tiếng lóng, bông đùa — không nhầm với thái độ xấu của agent.",

  "input_schema": {
    "required_fields": ["conversation_id", "messages", "agent_id"],
    "optional_fields": ["duration_minutes", "resolved", "customer_sentiment_end", "escalated"]
  },

  "scoring_rules": [
    {
      "rule_id": "response_time",
      "description": "Thời gian phản hồi đầu tiên",
      "evaluation": "Khoảng thời gian từ tin nhắn đầu của khách đến phản hồi đầu của agent. Chỉ tính giờ làm việc (8h–17h30).",
      "scoring": {
        "excellent": "<2 phút trong giờ làm → +1",
        "good": "2–10 phút → 0",
        "poor": ">30 phút trong giờ làm mà không có lý do → −1"
      }
    },
    {
      "rule_id": "tone",
      "description": "Thái độ và chất lượng giao tiếp của agent",
      "evaluation": "Đọc tất cả messages từ agent. Đánh giá: có chào hỏi không, có dùng tên khách không, có xin lỗi khi cần không, có viết tắt quá nhiều không.",
      "scoring": {
        "excellent": "Lịch sự, gọi tên khách, xin lỗi khi khách bực, chủ động hỏi thêm → +2",
        "good": "Đúng mực, không vấn đề rõ ràng → 0",
        "poor": "Cộc lốc, viết tắt nhiều đến mức thiếu chuyên nghiệp, không chào → −2"
      }
    },
    {
      "rule_id": "resolution",
      "description": "Mức độ giải quyết vấn đề của khách",
      "evaluation": "Đọc đoạn cuối hội thoại và field resolved/escalated nếu có.",
      "scoring": {
        "excellent": "Giải quyết hoàn toàn trong 1 phiên → +3",
        "good": "Giải quyết nhưng phải chuyển tiếp có kiểm soát → +1",
        "poor": "Khách vẫn bực, phải escalate không kiểm soát → −3"
      },
      "auto_flag_event": {
        "condition": "Khách đề cập đến review xấu, khiếu nại chính thức, hoặc huỷ đơn",
        "creates_event": {
          "category": "complaint",
          "severity": "heavy"
        }
      }
    }
  ],

  "red_flags": [
    "Agent dùng ngôn từ xúc phạm hoặc châm biếm khách dù khách có thái độ xấu",
    "Agent tiết lộ thông tin nội bộ (giá vốn, quy trình nội bộ, thông tin NV khác)",
    "Agent để khách chờ >1 tiếng mà không có phản hồi trung gian",
    "Agent đổ lỗi cho phòng khác thay vì try resolve"
  ],

  "context_to_consider": [
    "Khách dùng tiếng lóng (oke bro, tks, hehe) không phải thiếu tôn trọng",
    "Giờ cao điểm 11h–13h và 17h–19h: response time dài hơn là bình thường",
    "Câu hỏi kỹ thuật phức tạp cần thời gian nghiên cứu — không phạt vì chậm nếu có thông báo trung gian"
  ]
}
```

---

### Phòng Giao hàng — Đơn giao

```json
{
  "version": "1.0",
  "status": "active",
  "description_for_ai": "Đánh giá một đơn giao hàng. Tập trung: đúng hạn, tình trạng hàng khi tới tay khách, có đủ bằng chứng giao hàng không. Lưu ý: tắc đường và thời tiết xấu là yếu tố ngoài tầm kiểm soát của shipper.",

  "input_schema": {
    "required_fields": ["order_id", "driver_id", "scheduled_time", "actual_delivery_time", "status"],
    "optional_fields": ["customer_rating", "delivery_notes", "photos", "signature_collected"]
  },

  "scoring_rules": [
    {
      "rule_id": "ontime",
      "description": "Đúng giờ giao hàng",
      "evaluation": "So sánh actual_delivery_time với scheduled_time.",
      "scoring": {
        "excellent": "Đúng giờ hoặc sớm hơn → +1",
        "good": "Trễ <30 phút → 0",
        "poor": "Trễ >2 tiếng mà không liên lạc khách → −2"
      }
    },
    {
      "rule_id": "proof",
      "description": "Bằng chứng giao hàng đầy đủ",
      "evaluation": "Kiểm tra photos và signature_collected.",
      "scoring": {
        "excellent": "Có ảnh + chữ ký khách → +1",
        "good": "Có 1 trong 2 → 0",
        "poor": "Không có bằng chứng nào → −1"
      }
    },
    {
      "rule_id": "condition",
      "description": "Tình trạng hàng khi giao",
      "evaluation": "Đọc delivery_notes và customer_rating nếu có. Tìm từ khóa về hư hỏng.",
      "scoring": {
        "excellent": "Không có phản hồi tiêu cực về tình trạng hàng → +1",
        "poor": "Hàng hư hại, khách từ chối nhận → −3"
      },
      "auto_flag_event": {
        "condition": "Hàng bị hư hại rõ ràng (khách từ chối, có ảnh hư hại)",
        "creates_event": {
          "category": "incident",
          "severity": "heavy"
        }
      }
    }
  ],

  "red_flags": [
    "Thời gian giao quá nhanh so với quãng đường (nghi ngờ ghi fake)",
    "Nhiều đơn cùng shipper trong 1 ngày đều có complain",
    "Customer_rating = 1 sao liên tiếp >3 đơn/tuần"
  ],

  "context_to_consider": [
    "Tắc đường giờ cao điểm (7h–8h30, 17h–18h30) là bình thường",
    "Mưa lớn ảnh hưởng giao hàng — kiểm tra weather nếu có",
    "Khu vực hẻm nhỏ / chung cư có bảo vệ: thời gian thực tế dài hơn ước lượng"
  ]
}
```

---

## Hướng dẫn QL viết criteria

### Template chuẩn để điền

QL điền vào template này (không phải tự viết JSON từ đầu — phần mềm sẽ có form):

```
1. MÔ TẢ CÔNG VIỆC (cho AI hiểu context):
   "Công việc này là gì? Ai làm? Mục tiêu là gì? Có gì đặc biệt về ngành?"

2. DỮ LIỆU ĐẦU VÀO:
   Bắt buộc: [liệt kê các field JSON phải có]
   Tuỳ chọn: [field có thể không có]

3. CÁC TIÊU CHÍ CHẤM (mỗi tiêu chí điền):
   Tên tiêu chí: ___
   Cách AI đọc: ___
   Tốt (excellent) khi: ___ → cộng ___ điểm
   Trung bình (good) khi: ___ → cộng/trừ ___ điểm
   Kém (poor) khi: ___ → trừ ___ điểm
   Sinh sự vụ tự động khi: ___ (nếu có)

4. DẤU HIỆU BẤT THƯỜNG cần báo cáo riêng:
   - ___

5. NGỮ CẢNH AI CẦN BIẾT:
   - ___
```

### Nguyên tắc khi viết

- **Dùng ngôn ngữ nghiệp vụ**, không dùng thuật ngữ kỹ thuật. AI hiểu "trễ >7 ngày" tốt hơn "delta(delivered_at, deadline) > 604800".
- **Điểm cộng trừ nên cân đối** — không để criteria chỉ có trừ (nhân viên mất động lực) cũng không chỉ có cộng (vô nghĩa).
- **Red flags là pattern**, không phải single event. "1 đơn bị complain" không đủ để flag — "3 đơn/tuần bị complain" mới là pattern.
- **Context to consider là biện hộ cho nhân viên** — những trường hợp ngoại lệ mà NV không có lỗi.
- **Không viết criteria để bẫy nhân viên** — mục tiêu là đánh giá công bằng, không phải tìm lý do trừ điểm.

---

## Vòng đời criteria (versioning)

```
draft → active → archived
```

- `draft`: đang soạn thảo, chưa dùng để chấm
- `active`: đang dùng. Chỉ 1 CriterionTree active mỗi phòng — tất cả leaf `eval_type='ai'` dùng criteria trong tree đó
- `archived`: đã thay thế bởi version mới. Các AIEvaluation cũ vẫn giữ nguyên tham chiếu tree cũ

**Nguyên tắc immutability:** Criteria `active` không được sửa. Muốn thay đổi → tạo version mới, publish → version cũ tự archive.

Lý do: Nếu criteria thay đổi hồi tố, điểm của NV sẽ thay đổi mà NV không biết — không công bằng.

---

## Luồng pilot an toàn

### Giai đoạn 1: Observation (1–2 tháng đầu)

- Chạy AI chấm toàn bộ
- WorkLog và Event tạo ra ở `pending`, QL review
- **Không gắn vào điểm KPI, không gắn vào lương**
- Mục tiêu: đo tỷ lệ AI đúng vs QL quyết định

### Giai đoạn 2: Calibration

Sau 2 tháng, tính:
```
accuracy = (số lần QL confirm AI) / (tổng số AI proposal)
```

- accuracy ≥ 90% với `severity = light` → cho phép auto-confirm light cases
- accuracy ≥ 85% với `severity = medium` → xem xét auto-confirm medium
- `severity = heavy` → **luôn luôn manual review**, không auto

### Giai đoạn 3: Production

- Light severity: auto-confirm
- Medium: QL review trong 48h (nếu quá hạn → tự archive, không tính)
- Heavy: QL review, không giới hạn thời gian

---

## Giới hạn AI cần nhớ

1. **AI không biết context ngoài JSON** — NV giải thích miệng với QL sẽ không đến tai AI. Đây là lý do QL review quan trọng.
2. **AI không hiểu sắc thái văn hoá địa phương** — tiếng lóng vùng miền, cách nói chuyện đặc thù của ngành, quan hệ quen biết...
3. **AI có thể sai một cách tự tin** — AI không báo uncertainty, nó chấm điểm với giọng chắc chắn. QL không nên bị ảnh hưởng bởi confidence của AI.
4. **Dữ liệu thiếu ≠ thực hiện tệ** — nếu JSON thiếu field, AI trả `INSUFFICIENT_DATA`, không tự suy diễn.
5. **Goodhart's Law luôn rình rập** — khi NV biết AI chấm gì, họ sẽ tối ưu cho AI, không phải cho khách. Criteria cần update định kỳ để tránh gaming.

---

## Đọc tiếp

- [spec/data-model.md](../spec/data-model.md) — CriterionNode (eval_type=ai), AIEvaluation entities
- [spec/api-specification.md](../spec/api-specification.md) — POST /ai-evaluations endpoint
- [spec/business-rules.md](../spec/business-rules.md) — AI evaluation lifecycle rules
