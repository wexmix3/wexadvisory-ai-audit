-- Dead-letter table for silently-swallowed webhook processing failures
-- (Calendly booking webhook, Resend delivery-event webhook). Both apps
-- share this Supabase project, so this table is written by both repos.
create table if not exists webhook_failures (
  id uuid primary key default gen_random_uuid(),
  source text not null,           -- 'calendly' | 'resend'
  event_type text,
  payload jsonb,
  error_message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_failures_created_at on webhook_failures (created_at desc);
