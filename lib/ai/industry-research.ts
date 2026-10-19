import Anthropic from '@anthropic-ai/sdk';
import { search, formatSearchResults, type SearchResult } from '@/lib/research/tavily';

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

    // Site name on every result title, so each figure can be attributed.
    const withSite = (results: SearchResult[]) => results.map((r) => {
      let site = '';
      try { site = new URL(r.url).hostname.replace(/^www[.]/, ''); } catch { /* no site */ }
      return site ? { ...r, title: `${r.title} | ${site}` } : r;
    });
    const searchContext = [
      formatSearchResults(withSite(trends)),
      formatSearchResults(withSite(automation)),
    ].filter(Boolean).join('\n\n');

    if (!searchContext) return null;

    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You extract sharp, specific industry context for use in a consulting proposal. Output exactly 3-5 sentences of factual industry context. No fluff. State only what the search results support, and name the source site in parentheses after every figure, e.g. (deskmag.com). Leave out any figure you cannot tie to a result. Focus on facts that create urgency or validate the client's challenge.`,
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
