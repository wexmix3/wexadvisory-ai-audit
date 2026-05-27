const BASE_URL = 'https://api.dataforseo.com/v3';

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error('DATAFORSEO credentials not set');
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

export interface DomainTrafficData {
  domain: string;
  monthlyTraffic: number | null;
  organicKeywords: number | null;
  topKeywords: { keyword: string; position: number; volume: number }[];
}

async function dfsPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}`);
  return res.json();
}

function cleanDomain(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

export async function getDomainTraffic(url: string): Promise<DomainTrafficData | null> {
  if (!process.env.DATAFORSEO_LOGIN) return null;
  const domain = cleanDomain(url);
  try {
    const [overviewRes, keywordsRes] = await Promise.all([
      dfsPost('/dataforseo_labs/google/domain_rank_overview/live', [
        { target: domain, language_code: 'en', location_code: 2840 },
      ]),
      dfsPost('/dataforseo_labs/google/ranked_keywords/live', [
        {
          target: domain,
          language_code: 'en',
          location_code: 2840,
          limit: 5,
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        },
      ]),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organic = (overviewRes as any)?.tasks?.[0]?.result?.[0]?.metrics?.organic;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = (keywordsRes as any)?.tasks?.[0]?.result?.[0]?.items ?? [];
    return {
      domain,
      monthlyTraffic: organic?.etv ?? null,
      organicKeywords: organic?.count ?? null,
      topKeywords: items
        .map((item) => ({
          keyword: item.keyword_data?.keyword ?? '',
          position: item.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
          volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
        }))
        .filter((k) => k.keyword),
    };
  } catch (err) {
    console.warn(`[dataforseo] ${domain}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
