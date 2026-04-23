# System Diagrams — Mô hình hóa toàn bộ hệ thống

> Tất cả diagram dùng Mermaid syntax. Render trực tiếp trên GitHub hoặc qua [mermaid.live](https://mermaid.live).

---

## 1. Kiến trúc tổng quan (Context Diagram)

```mermaid
graph TB
    subgraph External["Hệ thống bên ngoài"]
        CRM["🏢 CRM / ERP\n(System of Record)\nQuản lý đơn hàng,\ncông việc, nhân sự"]
        CHAT["💬 Chat Agent AI\n(Zalo / Facebook)\nChăm sóc khách hàng"]
        FORM["📋 Google Form / Form nội bộ\nĐánh giá 360°"]
    end

    subgraph EvalSystem["Evaluation System (System of Aggregation)"]
        API["🔌 REST API Layer\nHMAC Auth\nRate Limiting\nDLQ"]

        subgraph Core["Core Engine"]
            WE["Work Events\nProcessor"]
            INC["Incident\nProcessor"]
            AIE["AI Evaluation\nEngine"]
            SCORE["Scoring\nEngine"]
            CAMP["Campaign\nEngine"]
        end

        subgraph Store["Data Store (PostgreSQL)"]
            DB[("employees\nwork_logs\nevents\nversions\ncampaigns\nai_evaluations\n...")]
        end
    end

    subgraph UI["Dashboard (Frontend)"]
        ADMIN["👤 Admin Dashboard\nTemplate / Catalog\nCampaign / Events"]
        QL["👔 QL Dashboard\nReview AI / Events\nScorecard"]
        NV["👷 NV Dashboard\nBảng điểm cá nhân\nRecognitions"]
    end

    CRM -->|"POST /work-events\nPOST /incidents\nPOST /employee-mapping"| API
    CHAT -->|"POST /ai-evaluations"| API
    CRM -->|"GET /scorecard"| API
    FORM -->|"POST /qualitative-scores"| API

    API --> WE
    API --> INC
    API --> AIE
    API --> SCORE
    API --> CAMP

    WE --> DB
    INC --> DB
    AIE --> DB
    SCORE --> DB
    CAMP --> DB

    DB --> ADMIN
    DB --> QL
    DB --> NV

    style External fill:#FEF3C7,stroke:#D97706
    style EvalSystem fill:#EFF6FF,stroke:#3B82F6
    style UI fill:#F0FDF4,stroke:#16A34A
    style Store fill:#F8FAFC,stroke:#64748B
```

---

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    DEPARTMENT ||--o{ EMPLOYEE : "has"
    DEPARTMENT ||--o{ TEMPLATE : "has"
    DEPARTMENT ||--|| WORK_CATALOG : "has exactly 1"

    PILLAR_LIBRARY ||--o{ VERSION : "referenced by pillars"

    TEMPLATE ||--o{ VERSION : "has versions"
    TEMPLATE |o--o| VERSION : "active_version_id"

    VERSION ||--o{ QUALITATIVE_SCORE : "evaluated against"
    VERSION ||--o| SCORECARD_SNAPSHOT : "snapshot based on"

    WORK_CATALOG ||--o{ WORK_UNIT_TYPE : "contains"
    WORK_UNIT_TYPE |o--o| EVALUATION_CRITERIA : "optional criteria"
    WORK_UNIT_TYPE ||--o{ WORK_LOG : "logged as"

    EMPLOYEE ||--o{ WORK_LOG : "performs"
    EMPLOYEE ||--o{ EVENT : "subject of"
    EMPLOYEE ||--o{ QUALITATIVE_SCORE : "is evaluated"
    EMPLOYEE ||--o{ QUALITATIVE_SCORE : "evaluates others"
    EMPLOYEE ||--o{ SCORECARD_SNAPSHOT : "has"
    EMPLOYEE ||--o{ PEER_RECOGNITION : "sends"
    EMPLOYEE ||--o{ PEER_RECOGNITION : "receives"
    EMPLOYEE ||--o{ AI_EVALUATION : "assessed by"

    WORK_LOG |o--o| EVENT : "related_event"
    WORK_LOG ||--o| AI_EVALUATION : "assessed by"

    AI_EVALUATION ||--o{ EVENT : "auto-generates"
    AI_EVALUATION ||--o{ AI_ALERT : "triggers red flags"

    EVENT |o--o| WORK_LOG : "related_work_log"

    CAMPAIGN ||--o{ PEER_RECOGNITION : "scopes"
    PEER_RECOGNITION ||--|| EVENT : "auto-generates teamwork event"

    DEPARTMENT {
        text id PK
        text code UK
        text name
        boolean active
    }

    EMPLOYEE {
        text id PK
        text external_id UK
        text full_name
        text department_id FK
        text role
        boolean active
    }

    PILLAR_LIBRARY {
        text id PK
        text name
        text data_source
        int default_weight
        boolean is_standard
        boolean active
    }

    TEMPLATE {
        text id PK
        text department_id FK
        text name
        text active_version_id FK
    }

    VERSION {
        text id PK
        text template_id FK
        text version_number
        text status
        jsonb pillars
    }

    WORK_CATALOG {
        text id PK
        text department_id FK
        jsonb unit_types
    }

    WORK_UNIT_TYPE {
        text id
        text code
        text name
        numeric points
        boolean active
        jsonb evaluation_criteria
    }

    WORK_LOG {
        text id PK
        text employee_id FK
        text work_type_code
        numeric quantity
        text status
        timestamptz completed_at
        text external_id
        text source
        numeric points_snapshot
    }

    EVENT {
        text id PK
        text employee_id FK
        text category
        text severity
        text source
        timestamptz occurred_at
        text reported_by
        text status
    }

    EVALUATION_CRITERIA {
        text version
        text status
        text description_for_ai
        jsonb input_schema
        jsonb scoring_rules
        jsonb red_flags
    }

    AI_EVALUATION {
        text id PK
        text work_log_id FK
        text employee_id FK
        text work_type_code
        text criteria_version
        jsonb work_data_snapshot
        jsonb ai_result
        text status
        text reviewed_by
    }

    AI_ALERT {
        text id PK
        text ai_evaluation_id FK
        text employee_id FK
        text message
        text status
    }

    QUALITATIVE_SCORE {
        text id PK
        text employee_id FK
        text evaluator_id FK
        text version_id FK
        text question_id
        text evaluator_role
        numeric score
        date period_from
        date period_to
    }

    SCORECARD_SNAPSHOT {
        text id PK
        text employee_id FK
        text version_id FK
        date period_from
        date period_to
        numeric pillar_1_score
        numeric pillar_2_score
        numeric pillar_3_score
        numeric total_score
        text rank
        text completeness
    }

    CAMPAIGN {
        text id PK
        text name
        text type
        text status
        date period_from
        date period_to
        text[] scope_department_ids
        jsonb goals
        jsonb awards
        boolean ending_ritual_done
    }

    PEER_RECOGNITION {
        text id PK
        text from_employee_id FK
        text to_employee_id FK
        text reason
        text campaign_id FK
        text generated_event_id FK
    }
```

---

## 3. Scoring Pipeline (Luồng tính điểm cuối kỳ)

```mermaid
flowchart LR
    subgraph Input["📥 Data Sources"]
        WL["WorkLogs\n(completedAt trong kỳ)"]
        QS["QualitativeScores\n(360° form)"]
        EV["Events\n(status = confirmed)"]
    end

    subgraph Pillars["🏛️ Pillars (N pillars, weight tổng = 100%)"]
        P1["QUANTITATIVE\ndata_source: quantitative\n─────────────\nwork_points: Σ pointsSnapshot\nwork_count: Σ quantity\nwork_quality: ontime / total × 100"]
        P2["QUALITY_360\ndata_source: qualitative_360\n─────────────\navg(scores) / 10 × 100\n± điều chỉnh từ events"]
        P3["FEEDBACK\ndata_source: event_driven\n─────────────\nnet = Σ polarity × severity\nnorm = clamp(50 + net×5, 0, 100)"]
        PN["... pillar khác\n(SKILL_MASTERY, COMPLIANCE\nLEARNING, INNOVATION)"]
    end

    subgraph Scoring["📊 Tổng hợp"]
        TOTAL["Total Score\n= Σ (pillar_score × weight) / 100"]
        RANK["Xếp hạng\nA ≥ 85\nB 70–84\nC 55–69\nD < 55"]
        SNAP["ScorecardSnapshot\n(lưu cứng cuối kỳ)"]
    end

    WL --> P1
    QS --> P2
    EV --> P3
    EV --> PN
    QS --> PN

    P1 -->|"× weight%"| TOTAL
    P2 -->|"× weight%"| TOTAL
    P3 -->|"× weight%"| TOTAL
    PN -->|"× weight%"| TOTAL

    TOTAL --> RANK
    TOTAL --> SNAP

    style Input fill:#FEF3C7,stroke:#D97706
    style Pillars fill:#EFF6FF,stroke:#3B82F6
    style Scoring fill:#F0FDF4,stroke:#16A34A
```

---

## 4. AI Evaluation — Sequence Diagram

```mermaid
sequenceDiagram
    participant SRC as CRM/Chat Agent
    participant API as API Layer
    participant ENG as AI Eval Engine
    participant AI as AI API (Claude/GPT)
    participant DB as Database
    participant QL as Quản lý (human)

    SRC->>API: POST /ai-evaluations\n{work_type_code, work_data, employee_id}
    API->>API: Validate HMAC + rate limit

    API->>DB: Load EvaluationCriteria (active version)
    DB-->>API: criteria JSON

    API->>API: Validate work_data vs input_schema
    alt Thiếu required fields
        API-->>SRC: 422 INSUFFICIENT_DATA
    end

    API->>API: Idempotency check (external_id, source)
    alt Đã tồn tại
        API-->>SRC: 200 + existing ai_evaluation_id
    end

    API->>ENG: Build prompt từ criteria + work_data
    ENG->>AI: Call AI API
    AI-->>ENG: {rule_scores, detected_events, red_flags, confidence}

    ENG->>DB: CREATE WorkLog (status=pending_review)
    ENG->>DB: CREATE Events (status=pending) for detected_events
    ENG->>DB: CREATE AIEvaluation (status=pending_review)
    ENG->>DB: CREATE AIAlerts for red_flags

    API-->>SRC: 201 {ai_evaluation_id, work_log_id, ai_result}

    Note over DB,QL: QL review trên dashboard

    QL->>API: POST /ai-evaluations/{id}/confirm
    API->>DB: UPDATE WorkLog status=confirmed
    API->>DB: UPDATE Events status=confirmed
    API->>DB: UPDATE AIEvaluation status=confirmed
    API-->>QL: {points_applied, events_confirmed}

    Note over DB,QL: Hoặc QL override nếu không đồng ý

    QL->>API: POST /ai-evaluations/{id}/override\n{override_assessment, override_reason}
    API->>DB: UPDATE với kết quả QL quyết định
    API->>DB: AuditLog: "overridden by QL"
```

---

## 5. State Machines

### 5a. Event (Sự vụ) — Vòng đời

```mermaid
stateDiagram-v2
    [*] --> pending : Tạo mới\n(CRM, manual, AI detected)

    pending --> confirmed : QL xác nhận\n→ tính vào điểm
    pending --> disputed : QL/NV tranh luận\n→ tạm giữ

    disputed --> confirmed : Giải quyết xong
    disputed --> deleted : Xác định sai\n→ soft delete

    confirmed --> [*] : Tính vào Pillar 3\n(event_driven)
    deleted --> [*]

    note right of pending
        Không tính điểm
    end note
    note right of confirmed
        Tính vào scoring
        severity_multiplier × polarity
    end note
```

### 5b. Version — Vòng đời

```mermaid
stateDiagram-v2
    [*] --> draft : Tạo mới\n(hoặc clone từ version cũ)

    draft --> draft : Chỉnh sửa pillars/questions\n(mutable)
    draft --> published : Publish\n(Σ weights = 100,\nít nhất 1 question/pillar)

    published --> archived : Version mới được publish\n→ version này tự archive

    published --> [*] : Đang dùng để chấm điểm\n(activeVersionId)
    archived --> [*] : Immutable, giữ lịch sử

    note right of published
        IMMUTABLE
        Không sửa pillars/questions
    end note
    note right of draft
        Mutable
        Có thể sửa tự do
    end note
```

### 5c. Campaign — Vòng đời

```mermaid
stateDiagram-v2
    [*] --> draft : Admin tạo

    draft --> active : Publish\n(có goal/award,\nperiod.from chưa qua,\nreward_description có)

    active --> completed : Complete\n(ending_ritual_done = true\nBẮT BUỘC)
    active --> cancelled : Admin cancel

    completed --> [*] : Auto-generate events\ncho winners

    note right of active
        Cập nhật goals.current\nmỗi 15 phút
    end note
    note right of completed
        ending_ritual_done = false
        → BỊ CHẶN
    end note
```

### 5d. AIEvaluation — Vòng đời

```mermaid
stateDiagram-v2
    [*] --> pending_review : AI chấm xong\nWorkLog + Events tạo ở pending

    pending_review --> confirmed : QL đồng ý\n→ WorkLog + Events confirmed\n→ tính điểm
    pending_review --> overridden : QL không đồng ý\n→ QL nhập kết quả mới\n(bắt buộc có lý do)
    pending_review --> discarded : QL bỏ qua\n(nhầm người, trùng lặp)

    confirmed --> [*] : Điểm tính vào\nPillar 1 + Pillar 3
    overridden --> [*] : Điểm theo quyết định QL\nAudit log ghi lại
    discarded --> [*] : WorkLog bị xoá

    note right of pending_review
        Auto-confirm sau 7 ngày
        nếu severity=light
        VÀ accuracy phase đạt ≥ 90%
    end note
```

---

## 6. API Integration Flow (CRM → Eval System)

```mermaid
sequenceDiagram
    participant CRM as CRM/ERP
    participant EVAL as Eval System API
    participant DB as Database
    participant DLQ as Dead Letter Queue

    Note over CRM,EVAL: Bước 1: Đồng bộ nhân viên (1 lần đầu)
    CRM->>EVAL: POST /employee-mapping\n{employee_external_id, department_code, ...}
    EVAL->>DB: UPSERT employees
    EVAL-->>CRM: {internal_id, action: "created"|"updated"}

    Note over CRM,EVAL: Bước 2: Báo công việc (real-time)
    CRM->>EVAL: POST /work-events\n{external_id, job_code, employee_ext_id, status}
    EVAL->>EVAL: Idempotency check\n(external_id, source)

    alt job_code không tồn tại trong catalog
        EVAL->>DLQ: Enqueue → UNKNOWN_JOB_CODE
        EVAL-->>CRM: 422 UNKNOWN_JOB_CODE
    else employee chưa map
        EVAL-->>CRM: 400 EMPLOYEE_NOT_MAPPED
    else OK
        EVAL->>DB: INSERT/UPDATE work_logs\n(points_snapshot tính ngay)
        EVAL-->>CRM: 201/200 {work_log_id, points_calculated}
    end

    Note over CRM,EVAL: Bước 3: Báo sự vụ
    CRM->>EVAL: POST /incidents\n{external_id, category, severity, ...}
    EVAL->>DB: INSERT events (status=pending)
    EVAL-->>CRM: 201 {event_id, initial_status: "pending"}

    Note over CRM,EVAL: Bước 4: Lấy bảng điểm
    CRM->>EVAL: GET /employees/{ext_id}/scorecard\n?period_from=...&period_to=...
    EVAL->>DB: Query + aggregate
    EVAL-->>CRM: 200 {work_points, events, scoring, rank}
    Note right of EVAL: Cache 5 phút\ncache_ttl_seconds trong response
```

---

## 7. Data Flow — Từ nguồn đến Scorecard

```mermaid
flowchart TD
    subgraph Sources["📡 Data Producers"]
        CRM_WE["CRM/ERP\nPOST /work-events"]
        CRM_INC["CRM/ERP\nPOST /incidents"]
        AI_EVAL["Chat Agent AI\nPOST /ai-evaluations"]
        FORM_360["Google Form / Internal\nPOST /qualitative-scores"]
        PEER["Nhân viên\nPOST /peer-recognitions"]
        MANUAL_QL["Quản lý\nManual entry"]
    end

    subgraph Storage["🗃️ Storage Layer"]
        WL[("work_logs\npoints_snapshot\nstatus")]
        EV[("events\nstatus=confirmed\nseverity")]
        QS[("qualitative_scores\nscore 0-10\nevaluator_role")]
    end

    subgraph Pillars["🏛️ Pillars"]
        P_Q["QUANTITATIVE\n▶ Σ points_snapshot\n▶ ontime_rate"]
        P_360["QUALITY_360\n▶ avg(scores)/10×100"]
        P_FB["FEEDBACK\n▶ clamp(50+net×5)"]
        P_OTHER["Other Pillars\nSKILL_MASTERY\nCOMPLIANCE\nINNOVATION..."]
    end

    subgraph Output["📊 Output"]
        SNAP["ScorecardSnapshot\ntotal_score\nrank A/B/C/D"]
        API_OUT["GET /scorecard\n(CRM embed)"]
    end

    CRM_WE -->|"WorkLog"| WL
    AI_EVAL -->|"WorkLog (pending→confirmed)"| WL
    CRM_INC -->|"Event (pending→confirmed)"| EV
    AI_EVAL -->|"Event (pending→confirmed)"| EV
    PEER -->|"Event teamwork (auto-confirmed)"| EV
    FORM_360 -->|"QualitativeScore"| QS
    MANUAL_QL -->|"QualitativeScore"| QS

    WL --> P_Q
    QS --> P_360
    EV --> P_FB
    EV --> P_OTHER
    QS --> P_OTHER

    P_Q -->|"× weight"| SNAP
    P_360 -->|"× weight"| SNAP
    P_FB -->|"× weight"| SNAP
    P_OTHER -->|"× weight"| SNAP

    SNAP --> API_OUT

    style Sources fill:#FEF3C7,stroke:#D97706
    style Storage fill:#F8FAFC,stroke:#64748B
    style Pillars fill:#EFF6FF,stroke:#3B82F6
    style Output fill:#F0FDF4,stroke:#16A34A
```

---

## 8. Campaign Flow

```mermaid
flowchart LR
    subgraph Trigger["🎯 Trigger"]
        ADMIN_C["Admin tạo Campaign\n(type, period, scope, goals/awards)"]
    end

    subgraph Active["⚡ Campaign Active"]
        TRACK["Tracking goals\n(mỗi 15 phút)"]
        WL2["WorkLogs\n(trong scope + period)"]
        EV2["Events\n(trong scope + period)"]
        PEER2["PeerRecognitions\n(Recognition Week)"]
        PROG["GET /campaigns/{id}/progress\n(days_remaining, pace_message)"]
    end

    subgraph Complete["🏁 Complete"]
        RITUAL["ending_ritual_done = true\n(BẮT BUỘC)"]
        WINNER["Điền winners\n(individual_awards)"]
        GEN["Auto-generate Events\ncho winners\n(teamwork/initiative, medium)"]
        HIST["Events vào hồ sơ NV\n→ tính vào Pillar 3\nkỳ đánh giá tiếp"]
    end

    ADMIN_C --> TRACK
    WL2 --> TRACK
    EV2 --> TRACK
    PEER2 -->|"auto Event teamwork"| EV2
    TRACK --> PROG

    PROG --> RITUAL
    RITUAL --> WINNER
    WINNER --> GEN
    GEN --> HIST

    style Trigger fill:#FEF3C7,stroke:#D97706
    style Active fill:#EFF6FF,stroke:#3B82F6
    style Complete fill:#F0FDF4,stroke:#16A34A
```

---

## 9. Template & Pillar Library — Quan hệ chọn pillar

```mermaid
graph LR
    subgraph Library["🏗️ Standard Pillar Library (Org-level)"]
        PL1["QUANTITATIVE\nquantitative\n★ standard"]
        PL2["QUALITY_360\nqualitative_360\n★ standard"]
        PL3["FEEDBACK\nevent_driven\n★ standard"]
        PL4["SKILL_MASTERY\nqualitative_360"]
        PL5["COMPLIANCE\nevent_driven"]
        PL6["LEARNING\nmanual"]
        PL7["INNOVATION\nevent_driven"]
    end

    subgraph Dept1["Phòng Giao hàng"]
        T1["Template v1.2\nQUANTITATIVE 50%\nQUALITY_360 30%\nFEEDBACK 20%"]
    end

    subgraph Dept2["Đội An toàn lao động"]
        T2["Template v1.0\nCOMPLIANCE 60%\nQUALITY_360 40%"]
    end

    subgraph Dept3["Đội Kỹ thuật Bảo hành"]
        T3["Template v2.0\nQUANTITATIVE 35%\nSKILL_MASTERY 25%\nQUALITY_360 25%\nFEEDBACK 15%"]
    end

    PL1 --> T1
    PL2 --> T1
    PL3 --> T1

    PL5 --> T2
    PL2 --> T2

    PL1 --> T3
    PL4 --> T3
    PL2 --> T3
    PL3 --> T3

    style Library fill:#FEF3C7,stroke:#D97706
    style Dept1 fill:#EFF6FF,stroke:#3B82F6
    style Dept2 fill:#FEF2F2,stroke:#EF4444
    style Dept3 fill:#F0FDF4,stroke:#16A34A
```

---

## Ghi chú đọc diagram

| Ký hiệu ERD | Nghĩa |
|-------------|-------|
| `\|\|--o{` | 1 bắt buộc — N tùy chọn |
| `\|o--o\|` | 0..1 — 0..1 |
| `\|\|--\|\|` | 1 — 1 bắt buộc |

| Màu sắc | Tầng |
|---------|------|
| 🟡 Vàng | External systems / Data producers |
| 🔵 Xanh dương | Core engine / Pillars |
| 🟢 Xanh lá | Output / Result |
| ⚪ Xám | Storage / Database |
