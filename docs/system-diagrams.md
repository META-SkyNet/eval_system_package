# System Diagrams — Mô hình hóa toàn bộ hệ thống

> Tất cả diagram dùng Mermaid syntax. Render trực tiếp trên GitHub hoặc qua [mermaid.live](https://mermaid.live).

---

## 1. Kiến trúc tổng quan (Context Diagram)

```mermaid
graph TB
    subgraph External["Hệ thống bên ngoài"]
        CRM["🏢 CRM / ERP\n(System of Record)\nQuản lý đơn hàng,\ncông việc, nhân sự"]
        CHAT["💬 Chat Agent AI\n(Zalo / Facebook)\nChăm sóc khách hàng"]
        FORM["📋 Form đánh giá 360°\nQL / đồng nghiệp chấm"]
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
            DB[("employees\ncriterion_trees\ncriterion_nodes\nwork_logs\nevents\nqualitative_scores\nmanual_scores\nai_evaluations\nscorecard_snapshots\ncampaigns\n...")]
        end
    end

    subgraph UI["Dashboard (Frontend)"]
        ADMIN["👤 Admin Dashboard\nCriterionTree / Preset\nCampaign / Events"]
        QL["👔 QL Dashboard\nReview AI / Events\nScorecard"]
        NV["👷 NV Dashboard\nBảng điểm cá nhân\nRecognitions"]
    end

    CRM -->|"POST /work-events\nPOST /events"| API
    CHAT -->|"POST /ai-evaluations"| API
    CRM -->|"GET /scorecard"| API
    FORM -->|"POST /qualitative-scores\nPOST /manual-scores"| API

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
    style UI fill:#F0FDF4,stroke:#22C55E
```

---

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    DEPARTMENT {
        uuid id PK
        string external_id
        string name
    }

    EMPLOYEE {
        uuid id PK
        string external_id
        uuid department_id FK
        string name
        string role
    }

    CRITERION_TREE {
        uuid id PK
        uuid department_id FK
        int version
        string status
        timestamp activated_at
        uuid created_by FK
    }

    CRITERION_NODE {
        uuid id PK
        uuid tree_id FK
        uuid parent_id FK
        string name
        numeric weight
        boolean is_leaf
        string eval_type
        string external_ref
        text description
        int sort_order
    }

    PRESET_LIBRARY {
        uuid id PK
        string name
        string target_department_type
    }

    PRESET_NODE {
        uuid id PK
        uuid preset_id FK
        uuid parent_id FK
        string name
        numeric weight
        boolean is_leaf
        string eval_type
    }

    EVAL_PERIOD {
        uuid id PK
        uuid department_id FK
        uuid criterion_tree_id FK
        string name
        date period_start
        date period_end
        string status
    }

    WORK_LOG {
        uuid id PK
        uuid employee_id FK
        uuid period_id FK
        uuid criterion_node_id FK
        string external_id
        string source
        numeric quantity
        string unit
        numeric score
        jsonb raw_data
        timestamp logged_at
    }

    EVENT {
        uuid id PK
        uuid employee_id FK
        uuid period_id FK
        uuid criterion_node_id FK
        string external_id
        string category
        string severity
        string direction
        numeric score_impact
        string title
        uuid reporter_id FK
        string status
        timestamp occurred_at
    }

    QUALITATIVE_SCORE {
        uuid id PK
        uuid employee_id FK
        uuid period_id FK
        uuid criterion_node_id FK
        uuid evaluator_id FK
        string evaluator_role
        numeric score
        text comment
    }

    MANUAL_SCORE {
        uuid id PK
        uuid employee_id FK
        uuid period_id FK
        uuid criterion_node_id FK
        numeric score
        text rationale
        uuid scored_by FK
    }

    AI_EVALUATION {
        uuid id PK
        uuid employee_id FK
        uuid period_id FK
        uuid criterion_node_id FK
        string external_id
        jsonb input_data
        numeric ai_score
        text ai_reasoning
        numeric final_score
        string status
        uuid reviewed_by FK
    }

    SCORECARD_SNAPSHOT {
        uuid id PK
        uuid employee_id FK
        uuid period_id FK
        numeric total_score
        int rank
        numeric completeness
        jsonb detail
        timestamp generated_at
    }

    CAMPAIGN {
        uuid id PK
        uuid department_id FK
        string name
        string type
        string status
        timestamp period_from
        timestamp period_to
        boolean ending_ritual_done
    }

    PEER_RECOGNITION {
        uuid id PK
        uuid from_employee_id FK
        uuid to_employee_id FK
        text reason
        uuid campaign_id FK
        uuid generated_event_id FK
    }

    DEPARTMENT ||--o{ EMPLOYEE : "has"
    DEPARTMENT ||--o{ CRITERION_TREE : "owns versions"
    DEPARTMENT ||--o{ EVAL_PERIOD : "has"
    DEPARTMENT ||--o{ CAMPAIGN : "runs"

    CRITERION_TREE ||--o{ CRITERION_NODE : "contains"
    CRITERION_NODE ||--o{ CRITERION_NODE : "parent/children"
    CRITERION_TREE ||--o{ EVAL_PERIOD : "used by"

    PRESET_LIBRARY ||--o{ PRESET_NODE : "template nodes"
    PRESET_NODE ||--o{ PRESET_NODE : "recursive"

    EMPLOYEE ||--o{ WORK_LOG : "logged for"
    EMPLOYEE ||--o{ EVENT : "recorded for"
    EMPLOYEE ||--o{ QUALITATIVE_SCORE : "evaluated in"
    EMPLOYEE ||--o{ MANUAL_SCORE : "scored in"
    EMPLOYEE ||--o{ AI_EVALUATION : "evaluated in"
    EMPLOYEE ||--o{ SCORECARD_SNAPSHOT : "has"
    EMPLOYEE ||--o{ PEER_RECOGNITION : "sends/receives"

    EVAL_PERIOD ||--o{ WORK_LOG : "scopes"
    EVAL_PERIOD ||--o{ EVENT : "scopes"
    EVAL_PERIOD ||--o{ QUALITATIVE_SCORE : "scopes"
    EVAL_PERIOD ||--o{ MANUAL_SCORE : "scopes"
    EVAL_PERIOD ||--o{ AI_EVALUATION : "scopes"
    EVAL_PERIOD ||--o{ SCORECARD_SNAPSHOT : "produces"

    CRITERION_NODE ||--o{ WORK_LOG : "quantitative leaf"
    CRITERION_NODE ||--o{ EVENT : "event leaf (nullable)"
    CRITERION_NODE ||--o{ QUALITATIVE_SCORE : "360 leaf"
    CRITERION_NODE ||--o{ MANUAL_SCORE : "manual leaf"
    CRITERION_NODE ||--o{ AI_EVALUATION : "ai leaf"

    CAMPAIGN ||--o{ PEER_RECOGNITION : "generates"
```

---

## 3. Scoring Pipeline — Tree Traversal

```mermaid
flowchart LR
    subgraph Sources["Nguồn dữ liệu"]
        WL["📦 WorkLog\n(quantity, score)"]
        EV["📢 Event\n(confirmed)"]
        QS["👥 QualitativeScore\n(0-100 per evaluator)"]
        MS["✏️ ManualScore\n(0-100)"]
        AI["🤖 AIEvaluation\n(final_score, confirmed)"]
    end

    subgraph Leaves["Leaf Nodes (đo thực sự)"]
        LQ["Leaf\neval_type=quantitative\nScore = avg(log.score)"]
        LE["Leaf\neval_type=event\nScore = 50 + net × factor\nclamped 0-100"]
        L3["Leaf\neval_type=qualitative_360\nScore = weighted avg\nby evaluator_role"]
        LM["Leaf\neval_type=manual\nScore = direct"]
        LA["Leaf\neval_type=ai\nScore = final_score"]
    end

    subgraph Folders["Folder Nodes (tổng hợp)"]
        F1["📁 Folder\nScore = Σ(child.score × child.weight/100)"]
        F2["📁 Folder\nScore = Σ(child.score × child.weight/100)"]
        ROOT["📁 Root Nodes\nScore = Σ(root.score × root.weight/100)"]
    end

    OUT["🏆 ScorecardSnapshot\ntotal_score (0-100)\nrank, completeness\ndetail JSONB tree"]

    WL --> LQ
    EV --> LE
    QS --> L3
    MS --> LM
    AI --> LA

    LQ --> F1
    LE --> F1
    L3 --> F2
    LM --> F2
    LA --> F2

    F1 --> ROOT
    F2 --> ROOT
    ROOT --> OUT
```

---

## 4. AI Evaluation — Sequence Diagram

```mermaid
sequenceDiagram
    participant CRM as CRM / ERP
    participant API as Eval API
    participant ENGINE as AI Evaluation Engine
    participant AI_API as AI API (Claude / GPT)
    participant DB as Database
    participant QL as Quản lý

    CRM->>API: POST /ai-evaluations\n{employee_id, criterion_node_id,\nexternal_id, input_data, source}
    API->>DB: Check idempotency (external_id, source)
    alt Duplicate
        DB-->>API: Already exists
        API-->>CRM: 200 OK (original record)
    else New
        API->>DB: Create ai_evaluation (pending_review)
        API->>ENGINE: Trigger evaluation
    end

    ENGINE->>DB: Load CriterionNode (eval_type=ai)\nRead description (criteria rules)
    ENGINE->>ENGINE: Validate input_data vs required fields\nBuild AI prompt from criteria + input_data
    ENGINE->>AI_API: Call AI API
    AI_API-->>ENGINE: {score, reasoning, red_flags?}
    ENGINE->>DB: Update ai_evaluation\n{ai_score, ai_reasoning, ai_model}

    opt Red flag detected
        ENGINE->>DB: Create ai_alert (human review required)
        ENGINE->>QL: Notify — red flag on employee
    end

    QL->>API: GET /ai-evaluations/pending?department_id=
    API-->>QL: List of pending evaluations

    QL->>API: POST /ai-evaluations/{id}/confirm\n{reviewed_by}
    API->>DB: Update status=confirmed\nfinal_score = ai_score
    DB-->>API: Done
    API-->>QL: 200 OK

    Note over DB,QL: Scorecard engine sẽ đọc final_score\nkhi tính điểm leaf node này
```

---

## 5. State Machine — Event / Sự vụ

```mermaid
stateDiagram-v2
    [*] --> pending : Tạo mới (POST /events)

    pending --> confirmed : QL xác nhận\n(POST /events/{id}/confirm)
    pending --> disputed : NV phản đối\n(POST /events/{id}/dispute)
    pending --> [*] : Xoá (audit log giữ lại)

    confirmed --> disputed : Phát hiện sai sót\n(trong vòng grace period)
    disputed --> confirmed : Sau review — giữ nguyên
    disputed --> resolved : Sau review — điều chỉnh\n(score_impact thay đổi)

    note right of pending
        Chưa tính vào điểm
        Leaf criterion_node_id\ncó thể null (general event)
    end note

    note right of confirmed
        Tính vào điểm leaf\neval_type=event
        heavy severity:\nluôn manual review
    end note
```

---

## 6. State Machine — CriterionTree Version

```mermaid
stateDiagram-v2
    [*] --> draft : POST /criterion-trees\n(tạo mới hoặc clone từ preset)

    draft --> draft : Thêm/sửa/xóa nodes\nvalidate weights

    draft --> active : POST /criterion-trees/{id}/publish\nValidation pass:\n- sibling weights = 100%\n- max depth ≤ 4\n- ít nhất 1 root node

    draft --> [*] : Bỏ draft (xoá)

    active --> archived : Khi version mới publish\n(tự động archive version hiện tại)

    note right of draft
        Có thể sửa tự do
        Không dùng để chấm điểm
    end note

    note right of active
        Bất biến (immutable)
        EvalPeriod gắn vào tree này
        Leaf criteria không đổi
    end note

    note right of archived
        Chỉ đọc (lịch sử)
        Period cũ vẫn tham chiếu
        dữ liệu không thay đổi
    end note
```

---

## 7. State Machine — Campaign

```mermaid
stateDiagram-v2
    [*] --> draft : Tạo campaign mới

    draft --> active : Kick-off\n(POST /campaigns/{id}/activate)
    draft --> [*] : Huỷ trước khi bắt đầu

    active --> completed : Kết thúc + có ending ritual\n(POST /campaigns/{id}/complete\n{ending_ritual_summary})
    active --> cancelled : Dừng sớm có lý do

    completed --> [*] : Lưu lịch sử vĩnh viễn

    note right of active
        Tracking tiến độ real-time
        Widget trên dashboard NV
        Tối đa 2-3 notifications/tuần
    end note

    note right of completed
        ending_ritual_done = true bắt buộc
        Auto-tạo campaign_reward events\ncho người đoạt giải
    end note
```

---

## 8. State Machine — AI Evaluation

```mermaid
stateDiagram-v2
    [*] --> pending_review : POST /ai-evaluations\n(AI Engine gửi kết quả)

    pending_review --> confirmed : QL xác nhận\n(POST /confirm)\nfinal_score = ai_score

    pending_review --> overridden : QL sửa điểm\n(POST /override)\nfinal_score = QL input

    pending_review --> discarded : QL từ chối\n(POST /discard)\nKhông tính vào scorecard

    note right of pending_review
        LUÔN bắt đầu ở đây
        AI không bao giờ\nauto-confirm
        heavy severity:\nkhông giới hạn thời gian
    end note

    note left of confirmed
        light: auto-confirm\n(sau calibration ≥90%)
        normal: QL review 48h
        heavy: manual ALWAYS
    end note
```

---

## 9. API Integration Flow — CRM → Eval System

```mermaid
sequenceDiagram
    participant CRM as CRM / ERP
    participant API as Eval API
    participant RESOLVE as Node Resolver
    participant DB as Database
    participant DLQ as Dead Letter Queue

    Note over CRM,API: CRM gửi work event (fire-and-forget, non-blocking)

    CRM->>API: POST /work-events\n{employee_external_id,\ndepartment_external_id,\nexternal_ref: "LAP_DH",\nexternal_id: "WL-2026-001",\nsource: "crm",\nquantity: 1,\nlogged_at: "..."}

    API->>DB: Check idempotency\n(external_id="WL-2026-001", source="crm")

    alt Duplicate
        DB-->>API: Exists
        API-->>CRM: 200 {log_id, status:"already_recorded"}
    else New
        API->>RESOLVE: Resolve external_ref "LAP_DH"\nfor department active tree
        RESOLVE->>DB: SELECT criterion_nodes\nWHERE tree_id = active_tree\nAND external_ref = "LAP_DH"\nAND is_leaf = true
        alt Node found
            DB-->>RESOLVE: criterion_node_id = uuid-xyz
            RESOLVE-->>API: Resolved
            API->>DB: INSERT work_logs\n{criterion_node_id=uuid-xyz,\nexternal_id, source, quantity,\nscore (computed or from CRM)}
            API-->>CRM: 201 {log_id, criterion_node_id, score}
        else Node not found
            RESOLVE-->>API: UNKNOWN_NODE_REF
            API->>DLQ: INSERT dead_letter_queue\n{payload, error_code, retry_count=0}
            API-->>CRM: 422 {error_code:"UNKNOWN_NODE_REF",\nmessage:"external_ref không map được node nào"}
            Note over DLQ: Admin map lại external_ref\nrồi retry thủ công
        end
    end

    Note over API,DB: Scorecard engine\ntính điểm theo batch\nhoặc on-demand
    CRM->>API: GET /scorecard?employee_id=&period_id=
    API->>DB: Compute tree traversal\n(leaf scores → folder rollup → total)
    DB-->>API: {total_score, breakdown tree, completeness}
    API-->>CRM: 200 {scorecard}
```

---

## 10. Data Flow — Từ nguồn đến Scorecard

```mermaid
flowchart TD
    subgraph Producers["Data Producers"]
        CRM_P["CRM / ERP\n(tự động)"]
        QL_P["Quản lý\n(review + manual)"]
        AI_P["AI Engine\n(pending → confirmed)"]
        PEER["Đồng nghiệp\n(peer recognition)"]
    end

    subgraph Storage["Leaf Score Tables"]
        WL_T["work_logs\n(criterion_node_id,\nquantity, score)"]
        EV_T["events\n(criterion_node_id nullable,\ncategory, severity,\nscore_impact)"]
        QS_T["qualitative_scores\n(criterion_node_id,\nevaluator_role, score)"]
        MS_T["manual_scores\n(criterion_node_id,\nscore)"]
        AI_T["ai_evaluations\n(criterion_node_id,\nfinal_score, confirmed)"]
    end

    subgraph Tree["CriterionTree Rollup"]
        LEAF["Leaf Nodes\n(0-100 per leaf)"]
        FOLDER["Folder Nodes\nΣ(child × weight/100)"]
        ROOT_N["Root Nodes\nΣ(root × weight/100)"]
    end

    OUT_S["ScorecardSnapshot\ntotal_score / rank\ncompleteness / detail"]

    CRM_P --> WL_T
    CRM_P --> EV_T
    QL_P --> QS_T
    QL_P --> MS_T
    QL_P --> EV_T
    AI_P --> AI_T
    AI_P --> EV_T
    PEER --> EV_T

    WL_T --> LEAF
    EV_T --> LEAF
    QS_T --> LEAF
    MS_T --> LEAF
    AI_T --> LEAF

    LEAF --> FOLDER
    FOLDER --> ROOT_N
    ROOT_N --> OUT_S
```

---

## 11. Campaign Flow

```mermaid
flowchart LR
    subgraph Trigger["Khi nào kích hoạt"]
        T1["📈 Cao điểm\nvận hành"]
        T2["🏆 Cột mốc\ncông ty"]
        T3["💪 Sau giai đoạn\nkhó khăn"]
        T4["📊 Dữ liệu\nbất thường"]
    end

    subgraph Types["5 Loại Campaign"]
        C1["Team Goal\nMục tiêu tập thể"]
        C2["Individual Awards\nGiải thưởng cá nhân"]
        C3["Recognition Week\nTuần lễ cảm ơn"]
        C4["Milestone\nCelebration"]
        C5["Skill Challenge\nThử thách kỹ năng"]
    end

    subgraph Impact["Tác động"]
        EV_C["Auto-create Events\ncategory=campaign_reward\nhoặc commendation\ncriterion_node_id = null\n(general event)"]
        HIST["Ghi vào hồ sơ\nlâu dài của NV"]
        RITUAL["Ending Ritual\nbắt buộc"]
    end

    T1 & T2 & T3 & T4 --> Types
    C1 & C2 & C3 & C4 & C5 --> EV_C
    EV_C --> HIST
    Types --> RITUAL

    style C1 fill:#DBEAFE
    style C2 fill:#F0FDF4
    style C3 fill:#FEF9C3
    style C4 fill:#FDF4FF
    style C5 fill:#FFF7ED
```

---

## 12. CriterionTree & Preset Library

```mermaid
graph LR
    subgraph Presets["Preset Library (tuỳ chọn)"]
        PL["📚 Preset Library\n(gợi ý theo loại phòng)"]
        P_GH["Giao hàng preset"]
        P_KHO["Kho preset"]
        P_BH["Bán hàng preset"]
        P_KT["Kế toán preset"]
        PL --> P_GH & P_KHO & P_BH & P_KT
    end

    subgraph Trees["CriterionTree theo Phòng"]
        T_GH["📁 Phòng Giao hàng\nCriterionTree v2 (active)"]
        T_KHO["📁 Phòng Kho\nCriterionTree v1 (active)"]
        T_NEW["📁 Phòng mới\nCriterionTree v1 (draft)"]
    end

    subgraph Nodes["CriterionNode (ví dụ Giao hàng)"]
        N1["📁 Kết quả (50%)\nis_leaf=false"]
        N1A["📄 Số chuyến (30%)\neval_type=quantitative\nexternal_ref=CHUYEN"]
        N1B["📄 Tỷ lệ đúng hạn (40%)\neval_type=quantitative\nexternal_ref=ONTIME"]
        N1C["📄 Giao đúng địa chỉ (30%)\neval_type=quantitative"]
        N2["📁 Chất lượng (30%)\nis_leaf=false"]
        N2A["📄 Phản hồi khách (50%)\neval_type=event"]
        N2B["📄 QL đánh giá (50%)\neval_type=qualitative_360"]
        N3["📄 Tuân thủ (20%)\neval_type=manual"]
    end

    P_GH -->|"clone → draft\n(nodes sao chép,\nkhông còn liên kết)"| T_GH
    P_KHO -->|"clone → draft"| T_KHO
    T_NEW -->|"xây từ đầu\n(không cần preset)"| T_NEW

    T_GH --> N1
    N1 --> N1A & N1B & N1C
    T_GH --> N2
    N2 --> N2A & N2B
    T_GH --> N3

    style Presets fill:#FEF3C7,stroke:#D97706
    style Trees fill:#EFF6FF,stroke:#3B82F6
    style Nodes fill:#F0FDF4,stroke:#22C55E
```
