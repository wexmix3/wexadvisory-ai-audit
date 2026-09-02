import type { AuditReportData } from '@/types/audit';
import { generateSnapshotPDF } from '@/lib/pdf/snapshot-pdf';

// Sends via Brevo instead of Resend. wexadvisory.com (root) is added to the
// account but not yet DNS-verified there; send.wexadvisory.com IS verified
// and authenticated (same domain/account cold outreach already sends from,
// confirmed landing) — audit@send.wexadvisory.com rides that proven
// reputation rather than waiting on root-domain verification. Swap FROM_*
// below to @wexadvisory.com once that domain shows authenticated: true at
// GET https://api.brevo.com/v3/senders/domains.
const FROM_EMAIL = 'audit@send.wexadvisory.com';
const REPLY_TO_EMAIL = 'maxwexley@wexadvisory.com';

// companyName can originate from scraped website content (a page <title>, an
// og:site_name), not just typed form input. A stray BOM or control character
// surviving into it caused a real production crash under the old Resend/fetch
// path (Headers reject non-Latin1 header values as a ByteString type error)
// on 2026-05-27. Brevo's subject travels in a JSON body, not a raw HTTP
// header, so that specific crash doesn't reproduce here — kept anyway, since
// control characters don't belong in a subject line under any transport.
const HEADER_UNSAFE_CHARS = new RegExp(
  '[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\uFEFF]',
  'g'
);

function sanitizeForHeader(s: string): string {
  return s.replace(HEADER_UNSAFE_CHARS, '').trim();
}

async function sendViaBrevo(payload: {
  senderName: string;
  toEmail: string;
  toName?: string;
  replyToEmail?: string;
  subject: string;
  html: string;
  attachment?: { name: string; content: string }[];
  headers?: Record<string, string>;
}): Promise<string | null> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: payload.senderName, email: FROM_EMAIL },
      to: [{ email: payload.toEmail, name: payload.toName }],
      replyTo: { email: payload.replyToEmail ?? REPLY_TO_EMAIL },
      subject: payload.subject,
      htmlContent: payload.html,
      attachment: payload.attachment,
      headers: payload.headers,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? `Brevo error (${res.status})`);
  return data.messageId ?? null;
}

export async function sendSnapshotEmail(params: {
  toEmail: string;
  toName: string;
  companyName: string;
  companyUrl: string;
  auditId: string;
  totalAnnualSavings: number;
  resultsUrl: string;
  reportData: AuditReportData;
  pdfBuffer?: Buffer;
}): Promise<{ pdfBuffer: Buffer | undefined }> {
  const { toEmail, toName, companyName, companyUrl, totalAnnualSavings, resultsUrl, reportData } = params;
  const firstName = toName.split(' ')[0] || toName;
  const savings = `$${(totalAnnualSavings / 1000).toFixed(0)}K`;
  const subjectSafeCompanyName = sanitizeForHeader(companyName);

  let pdfBuffer: Buffer | undefined = params.pdfBuffer;
  if (!pdfBuffer) {
    try {
      pdfBuffer = await generateSnapshotPDF(companyName, companyUrl, reportData);
    } catch (err) {
      console.error('[email] PDF generation failed — sending without attachment:', err);
    }
  }

  const filename = `AI-Audit-${companyName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

  await sendViaBrevo({
    senderName: 'Wex Advisory',
    toEmail,
    toName,
    subject: `Your AI Opportunity Snapshot for ${subjectSafeCompanyName} is ready`,
    attachment: pdfBuffer ? [{ name: filename, content: pdfBuffer.toString('base64') }] : undefined,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #0A1628; padding: 32px 40px;">
      <div style="color: #C8A84B; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Wex Advisory</div>
      <div style="color: white; font-size: 22px; font-weight: 700;">Your AI Opportunity Snapshot</div>
      <div style="color: #94a3b8; font-size: 14px; margin-top: 4px;">${companyName}</div>
    </div>

    <!-- Body -->
    <div style="padding: 40px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">Hi ${firstName},</p>

      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Your AI Opportunity Snapshot for <strong>${companyName}</strong> is ready. Based on our analysis of your business, we've identified <strong style="color: #0A1628;">${savings} in estimated annual savings</strong> from targeted AI automations.
      </p>

      <!-- CTA Block -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 0 0 28px;">
        <div style="color: #0A1628; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px;">Your Results</div>
        <a href="${resultsUrl}" style="display: inline-block; background: #C8A84B; color: #0A1628; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px;">View Your AI Opportunity Score →</a>
      </div>

      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        The snapshot shows your scores across 5 dimensions — AI Readiness, Automation Opportunity, Data Visibility, Revenue Acceleration, and Overall Maturity — benchmarked against other businesses in your industry.
      </p>

      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
        Want to go deeper? A full audit gives you:
      </p>
      <ul style="color: #374151; font-size: 15px; line-height: 1.8; margin: 0 0 24px; padding-left: 20px;">
        <li>Department-by-department breakdown with full labor math</li>
        <li>Prioritized implementation roadmap (Phase 1/2/3)</li>
        <li>Specific tool recommendations with cost estimates</li>
        <li>ROI calculator with payback periods</li>
      </ul>

      <a href="https://calendly.com/maxwexley-wexadvisory/free-strategy-call" style="display: inline-block; background: #0A1628; color: white; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px;">Book a Free Strategy Call →</a>

      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          — Max Wexley<br>
          <span style="color: #C8A84B;">Wex Advisory</span> · <a href="https://wexadvisory.com" style="color: #6b7280;">wexadvisory.com</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
  });

  return { pdfBuffer };
}

export async function sendAdminNotification(params: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  industry: string;
  employeeRange: string;
  totalAnnualSavings: number;
  aiReadinessScore: number;
  topOpportunity: string;
  auditId: string;
  resultsUrl: string;
  source?: string;
}) {
  const {
    companyName, contactName, contactEmail, industry, employeeRange,
    totalAnnualSavings, aiReadinessScore, topOpportunity, resultsUrl, source,
  } = params;

  const isTrackedSource = !!source && source !== 'audit';
  const subjectSafeCompanyName = sanitizeForHeader(companyName);

  await sendViaBrevo({
    senderName: 'Wex AI Audit',
    toEmail: 'maxwexley@wexadvisory.com',
    subject: `New Lead: ${subjectSafeCompanyName} — ${(totalAnnualSavings / 1000).toFixed(0)}K/yr savings identified${isTrackedSource ? ` (via ${source})` : ''}`,
    html: `
<div style="font-family: monospace; max-width: 600px; padding: 20px;">
  <h2 style="color: #0A1628; border-bottom: 2px solid #C8A84B; padding-bottom: 8px;">New AI Audit Lead</h2>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Company</td><td style="color: #111827; font-weight: 600;">${companyName}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Contact</td><td style="color: #111827;">${contactName}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td><a href="mailto:${contactEmail}" style="color: #C8A84B;">${contactEmail}</a></td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Industry</td><td style="color: #111827;">${industry}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Size</td><td style="color: #111827;">${employeeRange} employees</td></tr>
    ${isTrackedSource ? `<tr><td style="padding: 6px 0; color: #6b7280; font-weight: 700;">Source</td><td style="color: #C8A84B; font-weight: 700;">${source}</td></tr>` : ''}
    <tr><td style="padding: 6px 0; color: #6b7280; font-weight: 700;">Est. Savings</td><td style="color: #059669; font-weight: 700; font-size: 18px;">$${totalAnnualSavings.toLocaleString()}/year</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">AI Readiness</td><td style="color: #111827;">${aiReadinessScore}/100</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Top Opportunity</td><td style="color: #111827;">${topOpportunity}</td></tr>
  </table>

  <div style="margin: 20px 0;">
    <a href="${resultsUrl}" style="background: #0A1628; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; margin-right: 12px;">View Full Audit →</a>
    <a href="mailto:${contactEmail}?subject=Re: Your AI Opportunity Snapshot for ${companyName}" style="background: #C8A84B; color: #0A1628; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: 600;">Reply to Lead →</a>
  </div>

  <p style="color: #6b7280; font-size: 12px;">Audit ID: ${params.auditId}</p>
</div>`,
  });
}
