import Anthropic from '@anthropic-ai/sdk';
import type { SnapshotIntake, DecompressedProblem } from '@/types/audit';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a strategic consultant who specializes in identifying the real problem underneath what a client says they need.

A prospect has filled out an intake form describing their "biggest challenge." Your job is to decompress that stated challenge into the actual underlying problem — the pain they're responding to, not the solution they've implied.

Return ONLY valid JSON:

{
  "realProblem": "string — one sentence. The actual operational or strategic problem underneath the stated challenge. Specific to their industry and size.",
  "keyAssumptions": ["string", "string", "string"] — 2-3 assumptions baked into how they've described the problem. Each should be one sentence.",
  "proposalFraming": "string — 2-3 sentences. How to open the proposal in a way that names the real problem before introducing the solution. This is what Max will use to show the client he understands their actual situation, not just their symptom."
}`;

export async function decompressIntake(intake: SnapshotIntake): Promise<DecompressedProblem | null> {
  try {
    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Company: ${intake.companyName}
Industry: ${intake.industry}
Team size: ${intake.employeeRange} employees
Stated biggest challenge: "${intake.biggestChallenge}"

Decompress this into the real problem underneath.`,
      }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]) as DecompressedProblem;
  } catch (err) {
    console.error('[decompress-intake] failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
