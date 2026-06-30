import { getSupabase } from '@/lib/supabase';
import { generateProposalContent } from '@/lib/ai/generate-proposal';
import { decompressIntake } from '@/lib/ai/decompress-intake';
import { runIndustryResearch } from '@/lib/ai/industry-research';
import { generateProposalPDF } from '@/lib/pdf/proposal-pdf';
import { createGmailDraft } from '@/lib/gmail/create-draft';
import type { AuditReportData, SnapshotIntake } from '@/types/audit';

// Opus 4.8 pricing (per million tokens) used to estimate cost
const OPUS_INPUT_COST_PER_M  = 15.0;
const OPUS_OUTPUT_COST_PER_M = 75.0;

// Monthly spend cap and alert threshold
const MONTHLY_CAP_USD   = 25.0;
const ALERT_THRESHOLD   = 22.50; // 90% of cap

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * OPUS_INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * OPUS_OUTPUT_COST_PER_M
  );
}

async function getMonthlySpend(): Promise<number> {
  const db = getSupabase();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data } = await db
    .from('proposals')
    .select('cost_usd')
    .gte('created_at', startOfMonth.toISOString())
    .neq('status', 'failed');

  if (!data) return 0;
  return data.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
}

async function sendBudgetAlert(mtdSpend: number): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Wex AI Audit <audit@wexadvisory.com>',
      to: 'maxwexley@wexadvisory.com',
      subject: `[Cost Alert] Proposal pipeline at $${mtdSpend.toFixed(2)} MTD — approaching $${MONTHLY_CAP_USD} cap`,
      html: `
<div style="font-family: monospace; max-width: 500px; padding: 20px;">
  <h2 style="color: #0A1628; border-bottom: 2px solid #C8A84B; padding-bottom: 8px;">Proposal Pipeline Cost Alert</h2>
  <p style="color: #374151;">Month-to-date spend on the auto-proposal pipeline has reached <strong style="color: #dc2626;">$${mtdSpend.toFixed(2)}</strong>, approaching the $${MONTHLY_CAP_USD} monthly cap.</p>
  <p style="color: #374151;">New proposals will be blocked if spend exceeds $${MONTHLY_CAP_USD}.</p>
  <p style="color: #6b7280; font-size: 12px;">To raise the cap, update MONTHLY_CAP_USD in lib/proposal/proposal-pipeline.ts and redeploy.</p>
</div>`,
    }),
  });
}

function buildEmailHtml(params: {
  contactFirstName: string;
  companyName: string;
  emailBody: string;
}): string {
  const { contactFirstName, companyName, emailBody } = params;
  const paragraphs = emailBody.split('\n\n').filter(Boolean);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #0A1628; padding: 28px 36px;">
      <div style="color: #C8A84B; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">Wex Advisory</div>
      <div style="color: white; font-size: 18px; font-weight: 700;">AI Consulting Proposal</div>
      <div style="color: #94a3b8; font-size: 13px; margin-top: 2px;">${companyName}</div>
    </div>
    <div style="padding: 36px;">
      ${paragraphs.map((p) => `<p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 18px;">${p}</p>`).join('')}
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6;">
          Max Wexley<br>
          <span style="color: #C8A84B;">Wex Advisory</span> &middot; <a href="https://wexadvisory.com" style="color: #6b7280; text-decoration: none;">wexadvisory.com</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function runProposalPipeline(
  auditId: string,
  intake: SnapshotIntake,
  reportData: AuditReportData,
  trafficSummary: string,
): Promise<void> {
  const db = getSupabase();

  // Insert pending record so we have an ID to update
  const { data: proposal, error: insertError } = await db
    .from('proposals')
    .insert({
      audit_id: auditId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !proposal) {
    console.error('[proposal] failed to insert pending record:', insertError);
    return;
  }

  const proposalId = proposal.id;

  try {
    // Budget gate: check MTD spend before generating
    const mtdSpend = await getMonthlySpend();

    if (mtdSpend >= MONTHLY_CAP_USD) {
      console.warn(`[proposal] budget cap reached ($${mtdSpend.toFixed(2)} MTD) — skipping proposal for audit ${auditId}`);
      await db.from('proposals').update({
        status: 'failed',
        error_message: `Monthly budget cap ($${MONTHLY_CAP_USD}) reached — MTD spend: $${mtdSpend.toFixed(2)}`,
      }).eq('id', proposalId);
      return;
    }

    if (mtdSpend >= ALERT_THRESHOLD) {
      sendBudgetAlert(mtdSpend).catch((e) => console.error('[proposal] budget alert failed:', e));
    }

    // Run problem decomposition and industry research in parallel
    const [decompressed, industryContext] = await Promise.all([
      decompressIntake(intake),
      runIndustryResearch(intake.industry, intake.biggestChallenge),
    ]);

    if (decompressed) {
      console.log(`[proposal] problem decomposed for ${intake.companyName}: ${decompressed.realProblem}`);
    }
    if (industryContext) {
      console.log(`[proposal] industry research complete for ${intake.industry}`);
    }

    // Generate proposal content via Opus 4.8
    const { content, inputTokens, outputTokens } = await generateProposalContent(
      intake,
      reportData,
      trafficSummary,
      decompressed,
      industryContext,
    );

    const costUsd = estimateCost(inputTokens, outputTokens);
    console.log(`[proposal] generated for ${intake.companyName} — $${costUsd.toFixed(4)} (${inputTokens}in/${outputTokens}out)`);

    // Render proposal PDF
    const pdfBuffer = await generateProposalPDF(content);
    const pdfFilename = `Wex-Advisory-Proposal-${intake.companyName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

    // Create Gmail draft
    const emailHtml = buildEmailHtml({
      contactFirstName: content.contactFirstName,
      companyName: intake.companyName,
      emailBody: content.emailBody,
    });

    const gmailDraftId = await createGmailDraft({
      to: intake.contactEmail,
      subject: content.emailSubject,
      bodyHtml: emailHtml,
      attachment: { filename: pdfFilename, content: pdfBuffer },
    });

    console.log(`[proposal] Gmail draft created: ${gmailDraftId}`);

    // Store result
    await db.from('proposals').update({
      status: 'generated',
      content,
      gmail_draft_id: gmailDraftId,
      cost_usd: costUsd,
    }).eq('id', proposalId);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[proposal] failed for audit ${auditId}:`, msg);

    await db.from('proposals').update({
      status: 'failed',
      error_message: msg,
    }).eq('id', proposalId);

    // Send admin alert on failure
    const key = process.env.RESEND_API_KEY;
    if (key) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Wex AI Audit <audit@wexadvisory.com>',
          to: 'maxwexley@wexadvisory.com',
          subject: `[Proposal Failed] ${intake.companyName}`,
          html: `<div style="font-family: monospace; padding: 20px;"><h3>Proposal generation failed</h3><p><strong>Company:</strong> ${intake.companyName}</p><p><strong>Audit ID:</strong> ${auditId}</p><p><strong>Error:</strong> ${msg}</p></div>`,
        }),
      }).catch(() => {});
    }
  }
}
