import Anthropic from '@anthropic-ai/sdk';
import { search, formatSearchResults } from '@/lib/research/tavily';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function runIndustryResearch(
  industry: string,
  challenge: string,
): Promise<string | null> {
  try {
    const [trends, automation] = await Promise.all([
      search(`${industry} AI adoption trends challenges 2025`, 4),
      search(`${industry} small business automation ROI results`, 4),
    ]);

    const searchContext = [
      formatSearchResults(trends),
      formatSearchResults(automation),
    ].filter(Boolean).join('\n\n');

    if (!searchContext) return null;

    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You extract sharp, specific industry context for use in a consulting proposal. Output exactly 3-5 sentences of factual industry context. No fluff. No hedging. Direct assertions backed by what you read in the search results. Focus on facts that create urgency or validate the client's challenge.`,
      messages: [{
        role: 'user',
        content: `Industry: ${industry}
Client challenge area: "${challenge}"

Search results:
${searchContext}

Write 3-5 sentences of industry context that would strengthen a consulting proposal for a ${industry} company facing: ${challenge}. Reference specific data points, adoption rates, or cost figures from the search results where available.`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : null;
    if (!text) return null;

    console.log(`[industry-research] synthesized context for ${industry}`);
    return text;
  } catch (err) {
    console.error('[industry-research] failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
