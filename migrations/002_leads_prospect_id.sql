-- Migration 002: prospect_id on leads, for real per-send attribution
-- The intake form has captured prospectId (the cold-outreach pid token) since
-- outreach-tool migration 017, but it only ever landed inside audits.intake_data
-- as an opaque JSON blob — leads (the table actual reporting/CRM work reads)
-- never got it. So "which prospect did this completed audit come from" was
-- structurally unanswerable. This closes that gap.
--
-- Soft FK (ON DELETE SET NULL, not CASCADE): leads is a business record that
-- should survive even if the originating prospect row is later deleted from
-- the outreach tool's prospects table.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;

-- Backfill from the JSON blob already sitting on the linked audits row, for
-- any historical lead that happens to have one (expected to be near-zero
-- today, since no real cold-outreach click has completed an audit yet, but
-- this makes the column correct for anything that does exist).
UPDATE leads l
SET prospect_id = (a.intake_data->>'prospectId')::uuid
FROM audits a
WHERE l.audit_id = a.id
  AND l.prospect_id IS NULL
  AND a.intake_data->>'prospectId' IS NOT NULL
  AND a.intake_data->>'prospectId' <> '';
