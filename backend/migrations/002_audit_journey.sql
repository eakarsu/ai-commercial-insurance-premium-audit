CREATE TABLE IF NOT EXISTS audit_documents(
  id BIGSERIAL PRIMARY KEY,
  audit_reference TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Policy','Payroll','General Ledger','Tax Filing','Certificate of Insurance','Sales','Ownership','Correspondence','Other')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  file_size BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  sha256 TEXT NOT NULL,
  source_system TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  certification_status TEXT NOT NULL DEFAULT 'Uncertified' CHECK (certification_status IN ('Uncertified','Certified','Rejected')),
  extraction_status TEXT NOT NULL DEFAULT 'Ready' CHECK (extraction_status IN ('Pending','Ready','Needs review','Failed')),
  extracted_text TEXT NOT NULL DEFAULT '',
  content BYTEA,
  received_by TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(audit_reference,sha256)
);
CREATE INDEX IF NOT EXISTS idx_audit_documents_reference ON audit_documents(audit_reference,category);

CREATE TABLE IF NOT EXISTS evidence_requests(
  id BIGSERIAL PRIMARY KEY,
  audit_reference TEXT NOT NULL,
  requested_from TEXT NOT NULL,
  document_type TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Received','Overdue','Cancelled')),
  request_message TEXT NOT NULL,
  owner TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_requests_reference ON evidence_requests(audit_reference,due_date);

CREATE TABLE IF NOT EXISTS reconciliation_runs(
  id BIGSERIAL PRIMARY KEY,
  audit_reference TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('Payroll','Sales','General Ledger','Tax Filing')),
  reported_amount NUMERIC(16,2) NOT NULL,
  audited_amount NUMERIC(16,2) NOT NULL,
  allowable_adjustment NUMERIC(16,2) NOT NULL DEFAULT 0,
  unexplained_variance NUMERIC(16,2) NOT NULL,
  tolerance NUMERIC(16,2) NOT NULL DEFAULT 0,
  result_status TEXT NOT NULL CHECK (result_status IN ('Reconciled','Exception','Material exception')),
  calculation JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_reference ON reconciliation_runs(audit_reference,created_at DESC);

CREATE TABLE IF NOT EXISTS premium_calculations(
  id BIGSERIAL PRIMARY KEY,
  audit_reference TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  line_of_business TEXT NOT NULL,
  state TEXT NOT NULL,
  class_code TEXT NOT NULL,
  audited_exposure NUMERIC(16,2) NOT NULL CHECK (audited_exposure >= 0),
  rate NUMERIC(12,6) NOT NULL CHECK (rate >= 0),
  experience_modifier NUMERIC(8,4) NOT NULL DEFAULT 1 CHECK (experience_modifier > 0),
  schedule_modifier NUMERIC(8,4) NOT NULL DEFAULT 1 CHECK (schedule_modifier > 0),
  minimum_premium NUMERIC(16,2) NOT NULL DEFAULT 0,
  deposit_premium NUMERIC(16,2) NOT NULL DEFAULT 0,
  endorsements NUMERIC(16,2) NOT NULL DEFAULT 0,
  calculated_premium NUMERIC(16,2) NOT NULL,
  adjustment NUMERIC(16,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Review','Approved','Issued','Superseded')),
  inputs JSONB NOT NULL,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(audit_reference,version)
);
CREATE INDEX IF NOT EXISTS idx_premium_calculations_reference ON premium_calculations(audit_reference,version DESC);

CREATE TABLE IF NOT EXISTS calculation_approvals(
  id BIGSERIAL PRIMARY KEY,
  calculation_id BIGINT NOT NULL REFERENCES premium_calculations(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('Technical review','Supervisor approval','Issue authorization')),
  decision TEXT NOT NULL CHECK (decision IN ('Approved','Rejected','Returned')),
  reviewer TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  comment TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calculation_approvals_calculation ON calculation_approvals(calculation_id,decided_at DESC);

CREATE TABLE IF NOT EXISTS final_audit_packets(
  id BIGSERIAL PRIMARY KEY,
  calculation_id BIGINT UNIQUE NOT NULL REFERENCES premium_calculations(id),
  packet_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued','Replaced','Withdrawn')),
  summary JSONB NOT NULL,
  packet_text TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_messages(
  id BIGSERIAL PRIMARY KEY,
  dispute_reference TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('Inbound','Outbound','Internal')),
  channel TEXT NOT NULL CHECK (channel IN ('Portal','Email','Letter','Phone note','Internal note')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  document_id BIGINT REFERENCES audit_documents(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_reference ON dispute_messages(dispute_reference,sent_at);

CREATE TABLE IF NOT EXISTS user_notifications(
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Info','Warning','Critical')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  related_type TEXT NOT NULL,
  related_reference TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_email,read_at,created_at DESC);

ALTER TABLE integration_state ADD COLUMN IF NOT EXISTS endpoint_url TEXT;
ALTER TABLE integration_state ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT 'Not configured';
ALTER TABLE integration_state ADD COLUMN IF NOT EXISTS schema_name TEXT NOT NULL DEFAULT 'premium-audit-v1';
ALTER TABLE integration_state ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
