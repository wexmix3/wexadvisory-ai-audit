-- Add booking tracking fields to audits table
-- Populated by Calendly webhook when an audit submitter books a strategy call.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS booked_call_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT DEFAULT NULL;
