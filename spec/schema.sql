-- =============================================================================
-- Employee Evaluation System — PostgreSQL Schema v2
-- Mô hình: CriterionTree (file/folder recursive) thay thế Pillar Library bắt buộc
-- Compatible: PostgreSQL 14+
-- =============================================================================

-- =============================================================================
-- DEPARTMENTS
-- =============================================================================

CREATE TABLE departments (
  id          TEXT PRIMARY KEY,             -- "delivery", "warehouse", "warranty"
  code        TEXT UNIQUE NOT NULL,         -- "DELIVERY" — stable, dùng trong API
  name        TEXT NOT NULL,               -- "Giao hàng"
  color       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EMPLOYEES
-- =============================================================================

CREATE TABLE employees (
  id              TEXT PRIMARY KEY DEFAULT ('emp_' || substr(gen_random_uuid()::text, 1, 8)),
  external_id     TEXT UNIQUE NOT NULL,    -- ID trong CRM: "CRM_EMP_042"
  full_name       TEXT NOT NULL,
  department_id   TEXT NOT NULL REFERENCES departments(id),
  role            TEXT NOT NULL,           -- "NV Giao hàng"
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_employees_external_id ON employees(external_id);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_active ON employees(active) WHERE active = TRUE;

-- =============================================================================
-- CRITERION TREES (phiên bản cây tiêu chí của từng phòng)
-- =============================================================================

CREATE TABLE criterion_trees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   TEXT NOT NULL REFERENCES departments(id),
  version         INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'archived')),
  activated_at       TIMESTAMPTZ,             -- Thời điểm chuyển sang active
  calibration_notes  TEXT,                    -- Ghi chú thay đổi so với version trước
  created_by      TEXT REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (department_id, version)
);

-- Chỉ 1 tree active mỗi phòng
CREATE UNIQUE INDEX idx_criterion_trees_one_active_per_dept
  ON criterion_trees(department_id) WHERE status = 'active';

CREATE INDEX idx_criterion_trees_department ON criterion_trees(department_id, status);

-- =============================================================================
-- CRITERION NODES (cây đệ quy: folder hoặc leaf)
-- =============================================================================

CREATE TABLE criterion_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id       UUID NOT NULL REFERENCES criterion_trees(id),
  parent_id     UUID REFERENCES criterion_nodes(id),  -- NULL = root node
  name          TEXT NOT NULL,
  weight        NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  is_leaf       BOOLEAN NOT NULL DEFAULT FALSE,
  eval_type     TEXT CHECK (
                  (is_leaf = FALSE AND eval_type IS NULL) OR
                  (is_leaf = TRUE  AND eval_type IN (
                    'quantitative',     -- Tính từ work_logs
                    'qualitative_360',  -- Thu thập qua form 360°
                    'event',            -- Tính từ events confirmed
                    'manual',           -- QL nhập trực tiếp mỗi kỳ
                    'ai'                -- AI chấm từ input_data JSON
                  ))
                ),
  description   TEXT,
  scoring_config JSONB,                  -- ScoringConfig — bắt buộc khi eval_type='quantitative'
  sort_order    INT NOT NULL DEFAULT 0,
  external_ref  TEXT,                    -- Tag tuỳ chọn để map với CRM/ERP field
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query children của một node
CREATE INDEX idx_criterion_nodes_tree_parent ON criterion_nodes(tree_id, parent_id);
-- Query tất cả nodes trong một tree
CREATE INDEX idx_criterion_nodes_tree ON criterion_nodes(tree_id);
-- Query nodes theo eval_type (cho scoring)
CREATE INDEX idx_criterion_nodes_eval_type ON criterion_nodes(eval_type) WHERE is_leaf = TRUE;

-- Note: ràng buộc Σ weight của siblings = 100 được enforce ở application layer khi publish tree.
-- Lý do: CHECK constraint trong SQL không thể query aggregate trên rows khác.
-- Trigger mẫu (tham khảo, không bắt buộc chạy):
--   CREATE OR REPLACE FUNCTION check_sibling_weights() RETURNS TRIGGER AS $$
--   DECLARE total NUMERIC;
--   BEGIN
--     SELECT SUM(weight) INTO total
--     FROM criterion_nodes
--     WHERE tree_id = NEW.tree_id
--       AND (parent_id = NEW.parent_id OR (parent_id IS NULL AND NEW.parent_id IS NULL))
--       AND id != NEW.id;
--     IF (total + NEW.weight) > 100.01 THEN
--       RAISE EXCEPTION 'Sibling weights exceed 100%%';
--     END IF;
--     RETURN NEW;
--   END;
--   $$ LANGUAGE plpgsql;

-- =============================================================================
-- PRESET LIBRARY (thư viện tiêu chí mẫu — tuỳ chọn, không bắt buộc)
-- =============================================================================

CREATE TABLE preset_libraries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  description             TEXT,
  target_department_type  TEXT   -- 'delivery', 'warehouse', 'warranty', 'accounting'
);

-- Cấu trúc cây của preset (giống CriterionNode nhưng thuộc preset, không phải live tree)
CREATE TABLE preset_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id     UUID NOT NULL REFERENCES preset_libraries(id),
  parent_id     UUID REFERENCES preset_nodes(id),
  name          TEXT NOT NULL,
  weight        NUMERIC(5,2) NOT NULL,
  is_leaf       BOOLEAN NOT NULL DEFAULT FALSE,
  eval_type     TEXT CHECK (eval_type IN ('quantitative','qualitative_360','event','manual','ai')),
  description   TEXT,
  sort_order    INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_preset_nodes_preset ON preset_nodes(preset_id, parent_id);

-- Seed: Preset Libraries
INSERT INTO preset_libraries (id, name, description, target_department_type) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Giao hàng chuẩn',  'Cây tiêu chí mẫu cho phòng giao hàng vận chuyển',     'delivery'),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Kho chuẩn',         'Cây tiêu chí mẫu cho phòng kho (nhập/xuất)',           'warehouse'),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Bảo hành chuẩn',    'Cây tiêu chí mẫu cho phòng kỹ thuật bảo hành',        'warranty'),
  ('a1b2c3d4-0004-0000-0000-000000000004', 'Kế toán chuẩn',     'Cây tiêu chí mẫu cho phòng kế toán tài chính',        'accounting')
ON CONFLICT DO NOTHING;

-- Seed: Preset Nodes — Giao hàng chuẩn
-- Root: Kết quả (50%), Chất lượng (30%), Tuân thủ (20%)
INSERT INTO preset_nodes (id, preset_id, parent_id, name, weight, is_leaf, eval_type, sort_order) VALUES
  -- Roots
  ('b0000001-0001-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', NULL, 'Kết quả',    50, FALSE, NULL, 1),
  ('b0000001-0002-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', NULL, 'Chất lượng', 30, FALSE, NULL, 2),
  ('b0000001-0003-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', NULL, 'Tuân thủ',   20, TRUE,  'manual', 3),
  -- Kết quả → children
  ('b0000001-0011-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', 'b0000001-0001-0000-0000-000000000001', 'Số đơn giao',     60, TRUE, 'quantitative', 1),
  ('b0000001-0012-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', 'b0000001-0001-0000-0000-000000000001', 'Tỷ lệ đúng hạn',  40, TRUE, 'quantitative', 2),
  -- Chất lượng → children
  ('b0000001-0021-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', 'b0000001-0002-0000-0000-000000000001', 'Phản hồi khách',   50, TRUE, 'event', 1),
  ('b0000001-0022-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', 'b0000001-0002-0000-0000-000000000001', 'Đánh giá QL',      50, TRUE, 'qualitative_360', 2)
ON CONFLICT DO NOTHING;

-- Seed: Preset Nodes — Kho chuẩn
INSERT INTO preset_nodes (id, preset_id, parent_id, name, weight, is_leaf, eval_type, sort_order) VALUES
  ('b0000002-0001-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', NULL, 'Kết quả nhập/xuất', 45, FALSE, NULL, 1),
  ('b0000002-0002-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', NULL, 'Độ chính xác',      35, FALSE, NULL, 2),
  ('b0000002-0003-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', NULL, 'An toàn',           20, TRUE,  'event', 3),
  ('b0000002-0011-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', 'b0000002-0001-0000-0000-000000000002', 'Số chuyến nhập', 50, TRUE, 'quantitative', 1),
  ('b0000002-0012-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', 'b0000002-0001-0000-0000-000000000002', 'Số chuyến xuất', 50, TRUE, 'quantitative', 2),
  ('b0000002-0021-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', 'b0000002-0002-0000-0000-000000000002', 'Tỷ lệ sai lệch hàng', 60, TRUE, 'quantitative', 1),
  ('b0000002-0022-0000-0000-000000000002', 'a1b2c3d4-0002-0000-0000-000000000002', 'b0000002-0002-0000-0000-000000000002', 'Đánh giá 360°',       40, TRUE, 'qualitative_360', 2)
ON CONFLICT DO NOTHING;

-- Seed: Preset Nodes — Bảo hành chuẩn
INSERT INTO preset_nodes (id, preset_id, parent_id, name, weight, is_leaf, eval_type, sort_order) VALUES
  ('b0000003-0001-0000-0000-000000000003', 'a1b2c3d4-0003-0000-0000-000000000003', NULL, 'Kết quả ca',    35, TRUE,  'quantitative',   1),
  ('b0000003-0002-0000-0000-000000000003', 'a1b2c3d4-0003-0000-0000-000000000003', NULL, 'Tay nghề',      25, TRUE,  'qualitative_360', 2),
  ('b0000003-0003-0000-0000-000000000003', 'a1b2c3d4-0003-0000-0000-000000000003', NULL, 'Chất lượng',    25, FALSE, NULL,              3),
  ('b0000003-0004-0000-0000-000000000003', 'a1b2c3d4-0003-0000-0000-000000000003', NULL, 'Phản hồi KH',   15, TRUE,  'event',           4),
  ('b0000003-0031-0000-0000-000000000003', 'a1b2c3d4-0003-0000-0000-000000000003', 'b0000003-0003-0000-0000-000000000003', 'Giao tiếp',       50, TRUE, 'qualitative_360', 1),
  ('b0000003-0032-0000-0000-000000000003', 'a1b2c3d4-0003-0000-0000-000000000003', 'b0000003-0003-0000-0000-000000000003', 'Tỷ lệ sửa ngay',  50, TRUE, 'quantitative',   2)
ON CONFLICT DO NOTHING;

-- Seed: Preset Nodes — Kế toán chuẩn
INSERT INTO preset_nodes (id, preset_id, parent_id, name, weight, is_leaf, eval_type, sort_order) VALUES
  ('b0000004-0001-0000-0000-000000000004', 'a1b2c3d4-0004-0000-0000-000000000004', NULL, 'Độ chính xác', 40, TRUE, 'quantitative',   1),
  ('b0000004-0002-0000-0000-000000000004', 'a1b2c3d4-0004-0000-0000-000000000004', NULL, 'Tiến độ',      30, TRUE, 'quantitative',   2),
  ('b0000004-0003-0000-0000-000000000004', 'a1b2c3d4-0004-0000-0000-000000000004', NULL, 'Tuân thủ',     20, TRUE, 'event',          3),
  ('b0000004-0004-0000-0000-000000000004', 'a1b2c3d4-0004-0000-0000-000000000004', NULL, 'Phát triển',   10, TRUE, 'manual',         4)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- EVAL PERIODS (kỳ đánh giá)
-- =============================================================================

CREATE TABLE eval_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id       TEXT NOT NULL REFERENCES departments(id),
  name                TEXT NOT NULL,        -- "Tháng 4/2026", "Q2 2026"
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  criterion_tree_id   UUID REFERENCES criterion_trees(id),  -- Tree đang dùng cho kỳ này
  mode                TEXT NOT NULL DEFAULT 'official'
                      CHECK (mode IN ('calibration', 'official')),
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'closed', 'finalized')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (period_start < period_end)
);

CREATE INDEX idx_eval_periods_department ON eval_periods(department_id, status);
CREATE INDEX idx_eval_periods_tree ON eval_periods(criterion_tree_id);

-- =============================================================================
-- WORK LOGS (ghi nhận công việc — eval_type=quantitative)
-- =============================================================================

CREATE TABLE work_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  period_id           UUID NOT NULL REFERENCES eval_periods(id),
  criterion_node_id   UUID NOT NULL REFERENCES criterion_nodes(id),
  -- criterion_node phải là leaf với eval_type = 'quantitative' (enforce ở application layer)
  external_id         TEXT,               -- Từ CRM/ERP, dùng cho idempotency
  source              TEXT,               -- "manual" | "crm" | "erp"
  quantity            NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_points         NUMERIC(5,2) CHECK (unit_points > 0),  -- Điểm công/đơn, override leaf.scoring_config.base_unit_points
  unit                TEXT,               -- "đơn", "km", "ca", ...
  score               NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),  -- Normalized 0-100
  raw_data            JSONB,              -- JSON gốc từ CRM/ERP
  logged_at           TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: (external_id, source) unique nếu cả hai đều có
CREATE UNIQUE INDEX idx_work_logs_idempotency
  ON work_logs(external_id, source)
  WHERE external_id IS NOT NULL AND source IS NOT NULL;

CREATE INDEX idx_work_logs_employee_period ON work_logs(employee_id, period_id);
CREATE INDEX idx_work_logs_node_period ON work_logs(criterion_node_id, period_id);
CREATE INDEX idx_work_logs_logged_at ON work_logs(employee_id, logged_at DESC);

-- =============================================================================
-- EVENTS (sự vụ — eval_type=event hoặc general)
-- =============================================================================

CREATE TABLE events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  period_id           UUID NOT NULL REFERENCES eval_periods(id),
  criterion_node_id   UUID REFERENCES criterion_nodes(id),
  -- Nullable: một số event là general, không gắn với leaf cụ thể
  -- Nếu có, phải là leaf với eval_type = 'event' (enforce ở application layer)
  external_id         TEXT,
  source              TEXT,               -- "crm" | "erp" — dùng cho idempotency
  category            TEXT NOT NULL
                      CHECK (category IN (
                        'commendation',    -- khen thưởng
                        'complaint',       -- phàn nàn
                        'incident',        -- sự cố
                        'initiative',      -- sáng kiến
                        'campaign_reward'  -- phần thưởng từ campaign
                      )),
  severity            TEXT NOT NULL DEFAULT 'normal'
                      CHECK (severity IN ('light', 'normal', 'heavy')),
  direction           TEXT NOT NULL CHECK (direction IN ('positive', 'negative')),
  score_impact        NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Điểm tác động đã tính sẵn
  title               TEXT NOT NULL,
  description         TEXT,
  reporter_id         TEXT NOT NULL REFERENCES employees(id),  -- Không ẩn danh
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'disputed', 'resolved')),
  occurred_at         TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency
CREATE UNIQUE INDEX idx_events_idempotency
  ON events(external_id, source)
  WHERE external_id IS NOT NULL AND source IS NOT NULL;

CREATE INDEX idx_events_employee_period ON events(employee_id, period_id, status);
CREATE INDEX idx_events_node_period ON events(criterion_node_id, period_id) WHERE criterion_node_id IS NOT NULL;
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_occurred_at ON events(employee_id, occurred_at DESC);

-- =============================================================================
-- QUALITATIVE SCORES (đánh giá 360° — eval_type=qualitative_360)
-- =============================================================================

CREATE TABLE qualitative_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         TEXT NOT NULL REFERENCES employees(id),   -- Người được chấm
  period_id           UUID NOT NULL REFERENCES eval_periods(id),
  criterion_node_id   UUID NOT NULL REFERENCES criterion_nodes(id),
  -- Phải là leaf với eval_type = 'qualitative_360' (enforce ở application layer)
  evaluator_id        TEXT NOT NULL REFERENCES employees(id),   -- Người chấm
  evaluator_role      TEXT NOT NULL
                      CHECK (evaluator_role IN ('manager', 'peer', 'cross_dept', 'self')),
  score               NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  comment             TEXT,
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mỗi evaluator chỉ chấm 1 lần mỗi node mỗi kỳ
  UNIQUE (employee_id, period_id, criterion_node_id, evaluator_id)
);

CREATE INDEX idx_qualitative_scores_employee_period
  ON qualitative_scores(employee_id, period_id);
CREATE INDEX idx_qualitative_scores_node_period
  ON qualitative_scores(criterion_node_id, period_id);

-- =============================================================================
-- MANUAL SCORES (QL nhập trực tiếp — eval_type=manual)
-- =============================================================================

CREATE TABLE manual_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  period_id           UUID NOT NULL REFERENCES eval_periods(id),
  criterion_node_id   UUID NOT NULL REFERENCES criterion_nodes(id),
  -- Phải là leaf với eval_type = 'manual' (enforce ở application layer)
  score               NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  rationale           TEXT,               -- Lý do / ghi chú
  scored_by           TEXT NOT NULL REFERENCES employees(id),  -- QL nhập
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mỗi kỳ chỉ có 1 manual score mỗi node
  UNIQUE (employee_id, period_id, criterion_node_id)
);

CREATE INDEX idx_manual_scores_employee_period
  ON manual_scores(employee_id, period_id);

-- =============================================================================
-- AI EVALUATIONS (AI chấm điểm — eval_type=ai)
-- =============================================================================

-- Kết quả mỗi lần AI chấm điểm cho một leaf node.
-- Luôn bắt đầu ở pending_review — QL phải review trước khi tính điểm.

CREATE TABLE ai_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  period_id           UUID NOT NULL REFERENCES eval_periods(id),
  criterion_node_id   UUID NOT NULL REFERENCES criterion_nodes(id),
  -- Phải là leaf với eval_type = 'ai' (enforce ở application layer)
  external_id         TEXT,
  source              TEXT,
  input_data          JSONB NOT NULL,     -- JSON input từ hệ thống nghiệp vụ
  ai_score            NUMERIC(5,2) CHECK (ai_score BETWEEN 0 AND 100),
  ai_reasoning        TEXT,
  ai_model            TEXT,              -- "claude-3-7-sonnet-20250219", ...
  final_score         NUMERIC(5,2) CHECK (final_score BETWEEN 0 AND 100),
  status              TEXT NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN ('pending_review', 'confirmed', 'overridden', 'discarded')),
  reviewed_by         TEXT REFERENCES employees(id),
  reviewed_at         TIMESTAMPTZ,
  override_reason     TEXT,              -- Bắt buộc nếu status = 'overridden'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (external_id, source)
);

CREATE INDEX idx_ai_evaluations_status ON ai_evaluations(status, created_at DESC);
CREATE INDEX idx_ai_evaluations_employee ON ai_evaluations(employee_id, period_id);
CREATE INDEX idx_ai_evaluations_node ON ai_evaluations(criterion_node_id, period_id);

-- AI Alerts: red flags không tạo event, chỉ tạo alert cho admin/QL review
CREATE TABLE ai_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_evaluation_id    UUID NOT NULL REFERENCES ai_evaluations(id),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  alert_type          TEXT NOT NULL DEFAULT 'red_flag',
  message             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by         TEXT REFERENCES employees(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_alerts_status ON ai_alerts(status, created_at DESC);
CREATE INDEX idx_ai_alerts_employee ON ai_alerts(employee_id);

-- =============================================================================
-- SCORECARD SNAPSHOTS
-- =============================================================================

-- Kết quả đánh giá cuối kỳ được lưu cứng để không phải tính lại.
-- detail JSONB lưu full score trace: { "node_id": {"score": 75.5, "source": "quantitative", ...} }

CREATE TABLE scorecard_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  period_id           UUID NOT NULL REFERENCES eval_periods(id),
  criterion_tree_id   UUID NOT NULL REFERENCES criterion_trees(id),
  total_score         NUMERIC(5,2) CHECK (total_score BETWEEN 0 AND 100),
  rank                TEXT CHECK (rank IN ('A', 'B', 'C', 'D')),
  completeness        TEXT NOT NULL CHECK (completeness IN ('full', 'partial', 'none')),
  detail              JSONB,             -- Full score breakdown per node
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, period_id)
);

CREATE INDEX idx_scorecard_snapshots_employee
  ON scorecard_snapshots(employee_id, period_id DESC);

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================

CREATE TABLE campaigns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL,
  type                  TEXT NOT NULL
                        CHECK (type IN (
                          'team_goal', 'individual_awards', 'recognition_week',
                          'milestone_celebration', 'skill_challenge'
                        )),
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  period_from           DATE NOT NULL,
  period_to             DATE NOT NULL,
  scope_department_ids  TEXT[],          -- NULL = toàn công ty
  scope_employee_ids    TEXT[],          -- NULL = tất cả trong scope
  goals                 JSONB,           -- [{ id, metric, target, current, ... }]
  awards                JSONB,           -- [{ id, title, criteria, metric_source, winners }]
  reward_description    TEXT NOT NULL DEFAULT '',
  reward_budget         NUMERIC,
  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  ending_ritual_done    BOOLEAN NOT NULL DEFAULT FALSE,

  CHECK (period_from < period_to)
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_status_period ON campaigns(status, period_from);

-- =============================================================================
-- PEER RECOGNITIONS
-- =============================================================================

CREATE TABLE peer_recognitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_employee_id      TEXT NOT NULL REFERENCES employees(id),
  to_employee_id        TEXT NOT NULL REFERENCES employees(id),
  reason                TEXT NOT NULL CHECK (LENGTH(reason) >= 20),
  campaign_id           UUID REFERENCES campaigns(id),
  generated_event_id    UUID REFERENCES events(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (from_employee_id != to_employee_id)
);

CREATE INDEX idx_peer_recognitions_to_employee
  ON peer_recognitions(to_employee_id, created_at DESC);
CREATE INDEX idx_peer_recognitions_from_campaign
  ON peer_recognitions(from_employee_id, campaign_id);
CREATE INDEX idx_peer_recognitions_campaign_from
  ON peer_recognitions(campaign_id, from_employee_id)
  WHERE campaign_id IS NOT NULL;

-- =============================================================================
-- API KEYS
-- =============================================================================

CREATE TABLE api_keys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label                 TEXT,
  env                   TEXT NOT NULL DEFAULT 'production'
                        CHECK (env IN ('production', 'staging', 'test')),
  key_hash              TEXT UNIQUE NOT NULL,   -- SHA-256 của full key, không lưu plaintext
  key_prefix            TEXT NOT NULL,          -- "evk_live_xxxx" (8 chars)
  permissions           TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_per_second INTEGER NOT NULL DEFAULT 100,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ,
  revoked_by            TEXT,
  last_used_at          TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_active ON api_keys(active) WHERE active = TRUE;
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- =============================================================================
-- DEAD LETTER QUEUE
-- =============================================================================

CREATE TABLE dead_letter_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint        TEXT NOT NULL,         -- "/work-events", "/incidents"
  payload         JSONB NOT NULL,
  error_code      TEXT NOT NULL,         -- "UNKNOWN_NODE_REF", "EMPLOYEE_NOT_FOUND"
  error_message   TEXT NOT NULL,
  api_key_id      UUID REFERENCES api_keys(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'replaying', 'processed', 'discarded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

CREATE INDEX idx_dlq_status_created ON dead_letter_queue(status, created_at);
CREATE INDEX idx_dlq_error_code ON dead_letter_queue(error_code);

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity        TEXT NOT NULL,   -- "criterion_tree", "event", "employee", "api_key", ...
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,   -- "created", "activated", "archived", "status_changed", ...
  before_state  JSONB,
  after_state   JSONB,
  actor         TEXT NOT NULL,   -- Employee ID hoặc "system" hoặc api_key_id
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);

-- =============================================================================
-- HELPER: updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- SEED: Departments mẫu
-- =============================================================================

INSERT INTO departments (id, code, name, color, active) VALUES
  ('delivery',   'DELIVERY',   'Giao hàng',     '#3B82F6', TRUE),
  ('warehouse',  'WAREHOUSE',  'Kho',            '#8B5CF6', TRUE),
  ('warranty',   'WARRANTY',   'Bảo hành',       '#10B981', TRUE),
  ('accounting', 'ACCOUNTING', 'Kế toán',        '#F59E0B', TRUE),
  ('sales',      'SALES',      'Kinh doanh',     '#EF4444', TRUE)
ON CONFLICT DO NOTHING;
