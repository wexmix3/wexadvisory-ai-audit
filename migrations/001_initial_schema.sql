-- AI Audit Platform: Initial Schema
-- Run via Supabase Management API or dashboard SQL editor

CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  audit_type TEXT NOT NULL DEFAULT 'snapshot',
  status TEXT NOT NULL DEFAULT 'pending',

  -- Company
  company_name TEXT,
  company_url TEXT NOT NULL,
  industry TEXT,
  employee_count_estimate TEXT,

  -- Contact
  contact_name TEXT,
  contact_email TEXT,
  contact_role TEXT,

  -- Intake
  intake_data JSONB DEFAULT '{}',

  -- Research outputs
  web_content JSONB DEFAULT '{}',
  search_results JSONB DEFAULT '[]',
  tech_signals JSONB DEFAULT '[]',
  job_signals JSONB DEFAULT '[]',
  traffic_data JSONB DEFAULT '{}',

  -- AI outputs
  business_classification JSONB DEFAULT '{}',
  scores JSONB DEFAULT '{}',
  opportunities JSONB DEFAULT '[]',
  report_data JSONB DEFAULT '{}',

  -- Artifacts
  pdf_url TEXT,
  pdf_expires_at TIMESTAMPTZ,

  -- Lead CRM
  lead_status TEXT NOT NULL DEFAULT 'new',
  lead_notes TEXT,
  follow_up_at TIMESTAMPTZ,
  outreach_added BOOLEAN DEFAULT FALSE,

  -- Error tracking
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company TEXT,
  contact_name TEXT,
  industry TEXT,
  annual_savings_estimate INTEGER,
  lead_score INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'audit',
  notes TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audits_updated_at ON audits;
CREATE TRIGGER audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_lead_status ON audits(lead_status);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_audit_id ON leads(audit_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
