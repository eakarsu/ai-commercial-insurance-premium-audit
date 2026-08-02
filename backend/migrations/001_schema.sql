CREATE TABLE IF NOT EXISTS app_users(
  id BIGSERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workflow_cases(
  id BIGSERIAL PRIMARY KEY,workflow_id TEXT NOT NULL,reference TEXT UNIQUE NOT NULL,subject TEXT NOT NULL,owner TEXT NOT NULL,state TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,payload JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_events(
  id BIGSERIAL PRIMARY KEY,event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),actor TEXT NOT NULL,action TEXT NOT NULL,object_type TEXT NOT NULL,object_reference TEXT NOT NULL,detail TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_analyses(
  id BIGSERIAL PRIMARY KEY,workflow_id TEXT NOT NULL,actor TEXT NOT NULL,analysis_type TEXT NOT NULL,inputs JSONB NOT NULL,result JSONB NOT NULL,provider TEXT NOT NULL,model TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS integration_state(
  id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,last_tested TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_workflow ON workflow_cases(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cases_due ON workflow_cases(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(event_time DESC);

CREATE TABLE IF NOT EXISTS "op_intake"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_policyNumber" TEXT NOT NULL,
  "data_insured" TEXT NOT NULL,
  "data_line" TEXT NOT NULL,
  "data_auditPeriod" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_intake_due ON "op_intake"(due_date);

CREATE TABLE IF NOT EXISTS "op_payroll"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_insured" TEXT NOT NULL,
  "data_state" TEXT NOT NULL,
  "data_reportedPayroll" NUMERIC(16,2) NOT NULL,
  "data_auditedPayroll" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_payroll_due ON "op_payroll"(due_date);

CREATE TABLE IF NOT EXISTS "op_classification"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_employeeGroup" TEXT NOT NULL,
  "data_currentClass" TEXT NOT NULL,
  "data_proposedClass" TEXT NOT NULL,
  "data_dutyDescription" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_classification_due ON "op_classification"(due_date);

CREATE TABLE IF NOT EXISTS "op_subcontractor"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_subcontractor" TEXT NOT NULL,
  "data_contractAmount" NUMERIC(16,2) NOT NULL,
  "data_certificateStatus" TEXT NOT NULL,
  "data_laborAmount" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_subcontractor_due ON "op_subcontractor"(due_date);

CREATE TABLE IF NOT EXISTS "op_sales"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_operation" TEXT NOT NULL,
  "data_location" TEXT NOT NULL,
  "data_reportedSales" NUMERIC(16,2) NOT NULL,
  "data_auditedSales" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_sales_due ON "op_sales"(due_date);

CREATE TABLE IF NOT EXISTS "op_premium"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_policyNumber" TEXT NOT NULL,
  "data_exposureDifference" NUMERIC(16,2) NOT NULL,
  "data_rate" NUMERIC(16,2) NOT NULL,
  "data_premiumAdjustment" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_premium_due ON "op_premium"(due_date);

CREATE TABLE IF NOT EXISTS "op_dispute"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_auditId" TEXT NOT NULL,
  "data_disputedAmount" NUMERIC(16,2) NOT NULL,
  "data_disputeReason" TEXT NOT NULL,
  "data_responseDue" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_dispute_due ON "op_dispute"(due_date);

CREATE TABLE IF NOT EXISTS "op_quality"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_auditId" TEXT NOT NULL,
  "data_auditor" TEXT NOT NULL,
  "data_qualityIssue" TEXT NOT NULL,
  "data_riskLevel" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_quality_due ON "op_quality"(due_date);

CREATE TABLE IF NOT EXISTS "op_policy_portfolio"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_policyNumber" TEXT NOT NULL,
  "data_line" TEXT NOT NULL,
  "data_effectiveDate" DATE NOT NULL,
  "data_estimatedPremium" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_policy_portfolio_due ON "op_policy_portfolio"(due_date);

CREATE TABLE IF NOT EXISTS "op_insured_entities"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_insured" TEXT NOT NULL,
  "data_entityType" TEXT NOT NULL,
  "data_locationCount" NUMERIC(16,2) NOT NULL,
  "data_operations" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_insured_entities_due ON "op_insured_entities"(due_date);

CREATE TABLE IF NOT EXISTS "op_class_code_library"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_classCode" TEXT NOT NULL,
  "data_description" TEXT NOT NULL,
  "data_state" TEXT NOT NULL,
  "data_baseRate" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_class_code_library_due ON "op_class_code_library"(due_date);

CREATE TABLE IF NOT EXISTS "op_auditor_assignments"(
  id BIGSERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,risk TEXT NOT NULL,due_date DATE NOT NULL,amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  "data_auditor" TEXT NOT NULL,
  "data_territory" TEXT NOT NULL,
  "data_openAudits" NUMERIC(16,2) NOT NULL,
  "data_qualityScore" NUMERIC(16,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_auditor_assignments_due ON "op_auditor_assignments"(due_date);
