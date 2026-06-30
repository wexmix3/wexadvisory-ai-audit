-- Visual QA fields: non-blocking layout/whitespace score logged for human review after PDF generation.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS visual_qa_score INTEGER DEFAULT NULL;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS visual_qa_issues JSONB DEFAULT NULL;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS visual_qa_verdict TEXT DEFAULT NULL;
