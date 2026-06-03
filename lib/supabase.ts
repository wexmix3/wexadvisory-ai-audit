import { createClient } from '@supabase/supabase-js';

// Strip BOM (﻿) — artifact from pasting env vars on Windows
function clean(s: string | undefined): string {
  return (s ?? '').replace(/^﻿/, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): ReturnType<typeof createClient<any>> {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error(`Missing Supabase env vars: url=${!!url} key=${!!key}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key);
}
