// Checks the "New Lead" email to Max: a website Firecrawl could not read must
// be flagged in the subject and body, and the Firecrawl error text must be
// escaped. fetch is stubbed, so nothing is sent. No API calls, no DB writes.
// Run: npx tsx scripts/check-lead-email.mts

import assert from 'node:assert/strict';

process.env.BREVO_API_KEY = 'stub-not-a-real-key';
const sent: { subject: string; htmlContent: string; to: { email: string }[] }[] = [];
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  sent.push(JSON.parse(String(init?.body)));
  return new Response('{"messageId":"stub"}', { status: 201 });
}) as typeof fetch;

const { sendAdminNotification } = await import('../lib/email/brevo.ts');

const base = {
  companyName: 'Piece of Cake Moving',
  contactName: 'Max',
  contactEmail: 'maxwexley@wexadvisory.com',
  industry: 'Moving',
  employeeRange: '51-200',
  totalAnnualSavings: 100000,
  totalAnnualSavingsConservative: 50000,
  aiReadinessScore: 40,
  topOpportunity: 'Quote follow-up',
  auditId: 'check',
  resultsUrl: 'https://audit.wexadvisory.com/results/check',
};

let checks = 0;
const ok = (name: string) => { checks++; console.log(`ok  ${name}`); };

await sendAdminNotification({ ...base, websiteWarning: null });
assert.doesNotMatch(sent[0].subject, /WEBSITE NOT READ/);
assert.doesNotMatch(sent[0].htmlContent, /could not be read/);
ok('website read fine -> no flag');

await sendAdminNotification({
  ...base,
  websiteWarning: 'Website could not be read (Firecrawl: Unauthorized <script>x</script>). Report built from search results only.',
});
assert.equal(sent[1].to[0].email, 'maxwexley@wexadvisory.com');
assert.match(sent[1].subject, /\[WEBSITE NOT READ\]$/);
assert.match(sent[1].htmlContent, /Website could not be read \(Firecrawl: Unauthorized &lt;script&gt;/);
assert.doesNotMatch(sent[1].htmlContent, /<script>/);
ok('website not read -> subject flag + escaped red line in body');

console.log(`\n${checks} checks passed`);
