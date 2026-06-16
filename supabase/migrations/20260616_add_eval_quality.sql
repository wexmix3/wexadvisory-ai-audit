-- Add eval_quality column to audits table
-- Stores automated quality scores computed at generation time for every audit.
-- Schema: { scored_at, gate_passed, gate_issues, llm_score, llm_reasoning,
--           opportunity_count, total_annual_savings, has_quick_wins }
ALTER TABLE audits ADD COLUMN IF NOT EXISTS eval_quality JSONB DEFAULT NULL;
