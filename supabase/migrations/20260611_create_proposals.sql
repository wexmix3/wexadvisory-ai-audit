-- Auto-Proposal Pipeline: proposals table
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/idxuiibqevvbdiluxoth/sql

create table if not exists public.proposals (
  id            uuid        primary key default gen_random_uuid(),
  audit_id      uuid        not null references public.audits(id) on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending', 'generated', 'failed', 'sent')),
  content       jsonb,
  gmail_draft_id text,
  cost_usd      numeric(10, 6),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists proposals_audit_id_idx  on public.proposals(audit_id);
create index if not exists proposals_status_idx    on public.proposals(status);
create index if not exists proposals_created_at_idx on public.proposals(created_at);

-- updated_at trigger (reuse function if it already exists)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proposals_updated_at on public.proposals;
create trigger proposals_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- RLS: service role only (pipeline runs server-side)
alter table public.proposals enable row level security;

create policy "Service role full access to proposals"
  on public.proposals for all
  using (true)
  with check (true);
