-- =============================================================================
-- Employee Evaluation System — PostgreSQL Schema v1
-- Compatible: PostgreSQL 14+
-- =============================================================================

-- Enable UUID extension nếu cần (thay cho gen_random_uuid)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
-- PILLAR LIBRARY (Standard Pillar Definitions — dùng chung toàn org)
-- =============================================================================

CREATE TABLE pillar_library (
  id                      TEXT PRIMARY KEY,  -- "QUANTITATIVE", "QUALITY_360", ...
  name                    TEXT NOT NULL,
  description             TEXT,
  data_source             TEXT NOT NULL
                          CHECK (data_source IN (
                            'quantitative',    -- Tính từ work_logs
                            'qualitative_360', -- Thu thập qua form 360°
                            'event_driven',    -- Tính từ events confirmed
                            'manual'           -- QL nhập trực tiếp mỗi kỳ
                          )),
  default_weight          INTEGER NOT NULL DEFAULT 0 CHECK (default_weight BETWEEN 0 AND 100),
  allowed_question_types  TEXT[] NOT NULL DEFAULT '{}',
  is_standard             BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = thuộc default set
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by              TEXT NOT NULL DEFAULT 'system',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: Standard Pillar Library
INSERT INTO pillar_library (id, name, description, data_source, default_weight, allowed_question_types, is_standard) VALUES
  ('QUANTITATIVE',  'Kết quả định lượng',          'Những con số đo được, đếm được từ work logs',            'quantitative',    50, ARRAY['work_points','work_count','work_quality'], TRUE),
  ('QUALITY_360',   'Chất lượng & Thái độ',         'Đánh giá chéo 360°: tay nghề, chăm chỉ, hợp tác',       'qualitative_360', 30, ARRAY['scale','yesno'], TRUE),
  ('FEEDBACK',      'Phản hồi & Sự cố',             'Tín hiệu từ bên ngoài: khen, phàn nàn, sự cố',          'event_driven',    20, ARRAY['event','scale'], TRUE),
  ('SKILL_MASTERY', 'Năng lực chuyên môn',           'Tay nghề kỹ thuật, kiến thức chuyên sâu',               'qualitative_360',  0, ARRAY['scale','yesno'], FALSE),
  ('COMPLIANCE',    'Tuân thủ quy trình & An toàn', 'Checklist an toàn, quy trình, audit',                    'event_driven',     0, ARRAY['event','yesno'], FALSE),
  ('LEARNING',      'Đào tạo & Phát triển',          'Học kỹ năng mới, hoàn thành khóa học, mentoring',       'manual',           0, ARRAY['scale','yesno'], FALSE),
  ('INNOVATION',    'Sáng kiến & Cải tiến',          'Đề xuất cải tiến quy trình, giải pháp mới, ý tưởng',    'event_driven',     0, ARRAY['event','scale'], FALSE)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- TEMPLATES & VERSIONS
-- =============================================================================

CREATE TABLE templates (
  id                  TEXT PRIMARY KEY DEFAULT ('tmpl_' || substr(gen_random_uuid()::text, 1, 8)),
  department_id       TEXT NOT NULL REFERENCES departments(id),
  name                TEXT NOT NULL,
  description         TEXT,
  active_version_id   TEXT,               -- FK thêm sau khi có bảng versions
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_department_id ON templates(department_id);

-- Pillars và questions được lưu dưới dạng JSONB vì không query trực tiếp
-- Schema JSONB của pillars (2-6 items):
-- [
--   {
--     "id": "p1",
--     "definition_id": "QUANTITATIVE",   -- FK → pillar_library.id
--     "name_override": null,             -- Tùy chọn: tên riêng của phòng
--     "weight": 50,
--     "questions": [
--       {
--         "id": "q1",
--         "label": "...",
--         "type": "work_points" | "work_count" | "work_quality" | "scale" | "yesno" | "event",
--         "weight": 100,
--         "workTypeIds": null | ["wt_d1"],
--         "linkedEventCategories": null | ["customer_praise"]
--       }
--     ]
--   }
-- ]
-- Constraint validate: 2 <= array_length(pillars) <= 6
-- Constraint validate: Σ pillar.weight = 100 (enforced at application layer khi publish)

CREATE TABLE versions (
  id              TEXT PRIMARY KEY DEFAULT ('ver_' || substr(gen_random_uuid()::text, 1, 8)),
  template_id     TEXT NOT NULL REFERENCES templates(id),
  version_number  TEXT NOT NULL,           -- "1.0", "2.0"
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  based_on        TEXT,                    -- version_number của bản gốc nếu clone
  note            TEXT,
  pillars         JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  UNIQUE (template_id, version_number)
);

CREATE INDEX idx_versions_template_id ON versions(template_id);
CREATE INDEX idx_versions_status ON versions(status);

-- FK ngược từ templates → versions
ALTER TABLE templates
  ADD CONSTRAINT fk_templates_active_version
  FOREIGN KEY (active_version_id) REFERENCES versions(id)
  DEFERRABLE INITIALLY DEFERRED;

-- Constraint: chỉ 1 version published per template
-- Thực thi qua partial unique index
CREATE UNIQUE INDEX idx_versions_one_published_per_template
  ON versions(template_id) WHERE status = 'published';

-- =============================================================================
-- WORK CATALOG
-- =============================================================================

-- unit_types JSONB schema:
-- [
--   {
--     "id": "wt_d1",
--     "code": "LAP_DH",
--     "name": "Lắp đặt điều hòa",
--     "points": 10,
--     "note": "...",
--     "active": true
--   }
-- ]

CREATE TABLE work_catalogs (
  id              TEXT PRIMARY KEY DEFAULT ('wcat_' || substr(gen_random_uuid()::text, 1, 8)),
  department_id   TEXT UNIQUE NOT NULL REFERENCES departments(id),
  name            TEXT NOT NULL,
  unit_types      JSONB NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- WORK LOGS
-- =============================================================================

CREATE TABLE work_logs (
  id                  TEXT PRIMARY KEY DEFAULT ('wl_' || substr(gen_random_uuid()::text, 1, 8)),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  work_type_id        TEXT NOT NULL,       -- ID trong unit_types JSONB
  work_type_code      TEXT NOT NULL,       -- Denormalize code để query nhanh
  quantity            NUMERIC NOT NULL CHECK (quantity > 0),
  status              TEXT NOT NULL
                      CHECK (status IN ('completed_ontime', 'completed_late', 'completed_issue', 'failed')),
  completed_at        TIMESTAMPTZ NOT NULL,
  note                TEXT,
  external_id         TEXT,               -- Từ CRM/ERP, dùng cho idempotency
  source              TEXT,               -- "manual" | "crm" | "erp"
  related_event_id    TEXT,               -- FK thêm sau
  points_snapshot     NUMERIC,            -- points * quantity tại thời điểm tạo

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: (external_id, source) unique nếu cả hai đều có
CREATE UNIQUE INDEX idx_work_logs_external_idempotency
  ON work_logs(external_id, source)
  WHERE external_id IS NOT NULL AND source IS NOT NULL;

CREATE INDEX idx_work_logs_employee_completed ON work_logs(employee_id, completed_at DESC);
CREATE INDEX idx_work_logs_work_type_code ON work_logs(work_type_code);
CREATE INDEX idx_work_logs_status ON work_logs(status);

-- =============================================================================
-- EVENTS (SỰ VỤ)
-- =============================================================================

CREATE TABLE events (
  id                  TEXT PRIMARY KEY DEFAULT ('evt_' || substr(gen_random_uuid()::text, 1, 8)),
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  category            TEXT NOT NULL
                      CHECK (category IN (
                        'customer_praise', 'customer_complaint', 'incident_damage',
                        'initiative', 'extra_effort', 'absence', 'teamwork', 'skill_issue'
                      )),
  severity            TEXT NOT NULL CHECK (severity IN ('light', 'medium', 'heavy')),
  source              TEXT NOT NULL CHECK (source IN ('customer', 'internal', 'automatic')),
  occurred_at         TIMESTAMPTZ NOT NULL,
  reported_by         TEXT NOT NULL,       -- Không ẩn danh
  description         TEXT NOT NULL CHECK (LENGTH(description) >= 10),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'disputed', 'deleted')),
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        TEXT,
  related_work_log_id TEXT REFERENCES work_logs(id),
  external_id         TEXT,
  source_system       TEXT,               -- "crm" | "erp"
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_events_external_idempotency
  ON events(external_id, source_system)
  WHERE external_id IS NOT NULL AND source_system IS NOT NULL;

CREATE INDEX idx_events_employee_occurred ON events(employee_id, occurred_at DESC);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_category_status ON events(category, status);

-- Thêm FK ngược work_logs → events
ALTER TABLE work_logs
  ADD CONSTRAINT fk_work_logs_related_event
  FOREIGN KEY (related_event_id) REFERENCES events(id);

-- =============================================================================
-- QUALITATIVE SCORES (PILLAR 2 — 360°)
-- =============================================================================

-- Điểm đánh giá 360° cho Pillar 2.
-- Một kỳ đánh giá có thể có nhiều evaluator cho cùng 1 question.
-- Điểm cuối = average của tất cả evaluators cho question đó.

CREATE TABLE qualitative_scores (
  id              TEXT PRIMARY KEY DEFAULT ('qs_' || substr(gen_random_uuid()::text, 1, 8)),
  employee_id     TEXT NOT NULL REFERENCES employees(id),   -- NV được chấm
  version_id      TEXT NOT NULL REFERENCES versions(id),
  question_id     TEXT NOT NULL,           -- ID của question trong pillar qualitative
  evaluator_id    TEXT NOT NULL REFERENCES employees(id),   -- NV chấm
  evaluator_role  TEXT NOT NULL
                  CHECK (evaluator_role IN ('manager', 'peer', 'cross_department')),
  score           NUMERIC NOT NULL CHECK (score BETWEEN 0 AND 10),  -- Thang 0-10
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  note            TEXT,                    -- Nhận xét kèm theo (tùy chọn)
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mỗi evaluator chỉ chấm 1 lần mỗi question mỗi kỳ
  UNIQUE (employee_id, version_id, question_id, evaluator_id, period_from),
  CHECK (employee_id != evaluator_id)     -- Không tự chấm mình
);

CREATE INDEX idx_qualitative_scores_employee_period
  ON qualitative_scores(employee_id, period_from, period_to);
CREATE INDEX idx_qualitative_scores_evaluator
  ON qualitative_scores(evaluator_id);

-- =============================================================================
-- SCORECARD SNAPSHOTS
-- =============================================================================

-- Kết quả đánh giá cuối kỳ được lưu cứng để không phải tính lại.
-- Được tạo/cập nhật bởi periodic task hàng tháng.

-- detail JSONB schema:
-- {
--   "work_points": { "total": 87.5, "breakdown": [...] },
--   "events": { "total": 4, "positive": 3, "negative": 1, "net_score": 2 },
--   "pillar_1_breakdown": [...],
--   "pillar_2_breakdown": [...],
--   "pillar_3_breakdown": [...]
-- }

CREATE TABLE scorecard_snapshots (
  id              TEXT PRIMARY KEY DEFAULT ('snap_' || substr(gen_random_uuid()::text, 1, 8)),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  version_id      TEXT NOT NULL REFERENCES versions(id),
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  pillar_1_score  NUMERIC CHECK (pillar_1_score BETWEEN 0 AND 100),
  pillar_2_score  NUMERIC CHECK (pillar_2_score BETWEEN 0 AND 100),
  pillar_3_score  NUMERIC CHECK (pillar_3_score BETWEEN 0 AND 100),
  total_score     NUMERIC CHECK (total_score BETWEEN 0 AND 100),
  rank            TEXT CHECK (rank IN ('A', 'B', 'C', 'D')),
  completeness    TEXT NOT NULL
                  CHECK (completeness IN ('full', 'partial', 'none')),
  detail          JSONB,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id, period_from, period_to)
);

CREATE INDEX idx_scorecard_snapshots_employee
  ON scorecard_snapshots(employee_id, period_from DESC);

-- =============================================================================
-- CAMPAIGNS
-- =============================================================================

-- goals JSONB schema (khi type = 'team_goal'):
-- [
--   {
--     "id": "g1",
--     "metric": "work_count" | "work_points" | "ontime_rate" | "event_count",
--     "workTypeIds": null | ["wt_d1"],
--     "eventCategories": null | ["customer_praise"],
--     "target": 15000,
--     "current": 9847,
--     "last_calculated_at": "2026-04-22T10:00:00Z"
--   }
-- ]

-- awards JSONB schema (khi type = 'individual_awards'):
-- [
--   {
--     "id": "a1",
--     "title": "Người giúp đỡ nhiều nhất",
--     "criteria": "...",
--     "metric_source": "peer_recognition" | "improvement" | "customer_praise" | "consistency" | "manual",
--     "winners": []
--   }
-- ]

CREATE TABLE campaigns (
  id                    TEXT PRIMARY KEY DEFAULT ('cmp_' || substr(gen_random_uuid()::text, 1, 8)),
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
  scope_department_ids  TEXT[],            -- NULL = toàn công ty
  scope_employee_ids    TEXT[],            -- NULL = tất cả trong scope
  goals                 JSONB,
  awards                JSONB,
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
  id                    TEXT PRIMARY KEY DEFAULT ('pr_' || substr(gen_random_uuid()::text, 1, 8)),
  from_employee_id      TEXT NOT NULL REFERENCES employees(id),
  to_employee_id        TEXT NOT NULL REFERENCES employees(id),
  reason                TEXT NOT NULL CHECK (LENGTH(reason) >= 20),
  campaign_id           TEXT REFERENCES campaigns(id),
  generated_event_id    TEXT REFERENCES events(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (from_employee_id != to_employee_id)
);

CREATE INDEX idx_peer_recognitions_to_employee
  ON peer_recognitions(to_employee_id, created_at DESC);
CREATE INDEX idx_peer_recognitions_from_campaign
  ON peer_recognitions(from_employee_id, campaign_id);
-- Đếm quota trong campaign
CREATE INDEX idx_peer_recognitions_campaign_from
  ON peer_recognitions(campaign_id, from_employee_id)
  WHERE campaign_id IS NOT NULL;

-- =============================================================================
-- API KEYS
-- =============================================================================

CREATE TABLE api_keys (
  id                    TEXT PRIMARY KEY DEFAULT ('key_' || substr(gen_random_uuid()::text, 1, 8)),
  label                 TEXT,
  env                   TEXT NOT NULL DEFAULT 'production'
                        CHECK (env IN ('production', 'staging', 'test')),
  key_hash              TEXT UNIQUE NOT NULL,   -- SHA-256 của full key, không lưu plaintext
  key_prefix            TEXT NOT NULL,          -- "evk_live_xxxx" (8 chars) để dễ identify
  permissions           TEXT[] NOT NULL DEFAULT '{}',
  -- Permissions: "work_events:write", "incidents:write", "mapping:write",
  --              "scorecard:read", "campaigns:write", "qualitative:write",
  --              "admin:keys", "admin:dlq", "admin:audit"
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
  id              TEXT PRIMARY KEY DEFAULT ('dlq_' || substr(gen_random_uuid()::text, 1, 8)),
  endpoint        TEXT NOT NULL,           -- "/work-events", "/incidents"
  payload         JSONB NOT NULL,
  error_code      TEXT NOT NULL,           -- "UNKNOWN_JOB_CODE"
  error_message   TEXT NOT NULL,
  api_key_id      TEXT REFERENCES api_keys(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'replaying', 'processed', 'discarded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT                     -- Lỗi mới nhất khi replay
);

CREATE INDEX idx_dlq_status_created ON dead_letter_queue(status, created_at);
CREATE INDEX idx_dlq_error_code ON dead_letter_queue(error_code);

-- =============================================================================
-- AI EVALUATIONS
-- =============================================================================

-- Kết quả mỗi lần AI chấm điểm một công việc.
-- WorkLog và Events được tạo ở trạng thái pending_review cho đến khi QL duyệt.

-- ai_result JSONB schema:
-- {
--   "overall_assessment": "excellent" | "good" | "poor" | "insufficient_data",
--   "rule_scores": [
--     { "rule_id": "ontime", "assessment": "good", "score_delta": 0, "reasoning": "..." }
--   ],
--   "detected_events": [
--     { "rule_id": "quality", "category": "incident_damage", "severity": "heavy",
--       "description": "...", "auto_created_event_id": "evt_xxx" }
--   ],
--   "red_flags_triggered": ["..."],
--   "confidence": 0.87,
--   "reasoning": "Tóm tắt đánh giá"
-- }

CREATE TABLE ai_evaluations (
  id                    TEXT PRIMARY KEY DEFAULT ('aiev_' || substr(gen_random_uuid()::text, 1, 8)),
  work_log_id           TEXT REFERENCES work_logs(id),
  work_type_code        TEXT NOT NULL,
  criteria_version      TEXT NOT NULL,          -- Version criteria đã dùng
  employee_id           TEXT NOT NULL REFERENCES employees(id),
  work_data_snapshot    JSONB NOT NULL,          -- JSON gốc từ hệ thống nghiệp vụ
  external_id           TEXT,
  source                TEXT,
  ai_result             JSONB NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending_review'
                        CHECK (status IN ('pending_review', 'confirmed', 'overridden', 'discarded')),
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  override_reason       TEXT,                   -- Bắt buộc nếu status = 'overridden'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (external_id, source)
);

CREATE INDEX idx_ai_evaluations_status ON ai_evaluations(status, created_at DESC);
CREATE INDEX idx_ai_evaluations_employee ON ai_evaluations(employee_id, created_at DESC);
CREATE INDEX idx_ai_evaluations_work_type ON ai_evaluations(work_type_code, status);

-- AI Alerts: red flags không tạo event, chỉ tạo alert cho admin review
CREATE TABLE ai_alerts (
  id                TEXT PRIMARY KEY DEFAULT ('ala_' || substr(gen_random_uuid()::text, 1, 8)),
  ai_evaluation_id  TEXT NOT NULL REFERENCES ai_evaluations(id),
  employee_id       TEXT NOT NULL REFERENCES employees(id),
  alert_type        TEXT NOT NULL DEFAULT 'red_flag',
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_alerts_status ON ai_alerts(status, created_at DESC);

-- =============================================================================
-- AUDIT LOGS
-- =============================================================================

CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY DEFAULT ('aud_' || substr(gen_random_uuid()::text, 1, 8)),
  entity      TEXT NOT NULL,     -- "event", "version", "employee", "api_key", "campaign", ...
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,     -- "created", "status_changed", "published", "revoked", ...
  before_state JSONB,
  after_state  JSONB,
  actor       TEXT NOT NULL,     -- User ID hoặc "system" hoặc api_key_id
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_work_catalogs_updated_at
  BEFORE UPDATE ON work_catalogs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_work_logs_updated_at
  BEFORE UPDATE ON work_logs
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
