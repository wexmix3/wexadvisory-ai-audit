import { Resend } from 'resend';
import type { AuditReportData } from '@/types/audit';
import { generateSnapshotPDF } from '@/lib/pdf/snapshot-pdf';

let client: Resend | null = null;

function getClient() {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    client = new Resend(key);
  }
  return client;
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
}) {
  const { toEmail, toName, companyName, companyUrl, totalAnnualSavings, resultsUrl, reportData } = params;
  const firstName = toName.split(' ')[0] || toName;
  const savings = `$${(totalAnnualSavings / 1000).toFixed(0)}K`;

  let pdfBuffer: Buffer | undefined;
  try {
    pdfBuffer = await generateSnapshotPDF(companyName, companyUrl, reportData);
  } catch (err) {
    console.error('[email] PDF generation failed — sending without attachment:', err);
  }

  const filename = `AI-Audit-${companyName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

  await getClient().emails.send({
    from: 'Wex Advisory <audit@wexadvisory.com>',
    to: toEmail,
    subject: `Your AI Opportunity Snapshot for ${companyName} is ready`,
    attachments: pdfBuffer
      ? [{ filename, content: pdfBuffer.toString('base64') }]
      : undefined,
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
}) {
  const {
    companyName, contactName, contactEmail, industry, employeeRange,
    totalAnnualSavings, aiReadinessScore, topOpportunity, resultsUrl,
  } = params;

  await getClient().emails.send({
    from: 'Wex AI Audit <audit@wexadvisory.com>',
    to: 'maxwexley@wexadvisory.com',
    subject: `New Lead: ${companyName} — ${(totalAnnualSavings / 1000).toFixed(0)}K/yr savings identified`,
    html: `
<div style="font-family: monospace; max-width: 600px; padding: 20px;">
  <h2 style="color: #0A1628; border-bottom: 2px solid #C8A84B; padding-bottom: 8px;">New AI Audit Lead</h2>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 6px 0; color: #6b7280; width: 140px;">Company</td><td style="color: #111827; font-weight: 600;">${companyName}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Contact</td><td style="color: #111827;">${contactName}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td><a href="mailto:${contactEmail}" style="color: #C8A84B;">${contactEmail}</a></td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Industry</td><td style="color: #111827;">${industry}</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Size</td><td style="color: #111827;">${employeeRange} employees</td></tr>
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
