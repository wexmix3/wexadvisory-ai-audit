import { tavily } from '@tavily/core';

let client: ReturnType<typeof tavily> | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error('TAVILY_API_KEY is not set');
    client = tavily({ apiKey });
  }
  return client;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export async function search(query: string, maxResults = 5): Promise<SearchResult[]> {
  try {
    const response = await getClient().search(query, {
      maxResults,
      searchDepth: 'basic',
    });
    return response.results.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content?.slice(0, 1500) ?? '',
    }));
  } catch {
    return [];
  }
}

export async function gatherCompanySignals(companyName: string, domain: string): Promise<{
  reviews: SearchResult[];
  jobs: SearchResult[];
  news: SearchResult[];
}> {
  const [reviews, jobs, news] = await Promise.all([
    search(`"${companyName}" site:glassdoor.com OR site:g2.com OR site:trustpilot.com reviews`, 3),
    search(`"${companyName}" OR site:${domain} jobs hiring 2024 2025`, 4),
    search(`"${companyName}" ${domain} press news announcement`, 3),
  ]);
  return { reviews, jobs, news };
}

export function formatSearchResults(results: SearchResult[]): string {
  return results
    .map((r) => `[${r.title}]\n${r.content}`)
    .join('\n\n')
    .slice(0, 4000);
}
