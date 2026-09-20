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

// DataForSEO reports most real failures as HTTP 200 with an error code in the
// BODY — either at the top level or, worse, one level down inside tasks[0].
// A paused account returns 200 + status_code 20000 "Ok" at the top while
// tasks[0].status_code is 40201 ("access temporarily paused"), so an res.ok
// check alone reports success for a response carrying no data at all. That is
// exactly how 2026-09-20's account pause stayed invisible. Check all three.
async function dfsPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${path}: HTTP ${res.status}`);

  const json = (await res.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{ status_code?: number; status_message?: string }>;
  };

  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO ${path}: API ${json.status_code} ${json.status_message ?? ''}`.trim());
  }

  const task = json.tasks?.[0];
  // 20000 = done, 20100 = task created (async endpoints). Anything else is a
  // real failure even though the HTTP call "succeeded".
  if (task && task.status_code !== 20000 && task.status_code !== 20100) {
    throw new Error(`DataForSEO ${path}: task ${task.status_code} ${task.status_message ?? ''}`.trim());
  }

  return json;
}

function cleanDomain(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

export async function getDomainTraffic(url: string): Promise<DomainTrafficData | null> {
  if (!process.env.DATAFORSEO_LOGIN) {
    // Was a silent `return null`: a missing credential looked identical to a
    // domain with no traffic, and every audit shipped without traffic data.
    throw new Error('DataForSEO credentials not set — traffic data unavailable');
  }
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
    // Loud, not swallowed: the pipeline decides whether an audit may ship
    // without traffic data, and it can only decide if it sees the error.
    console.error(`[dataforseo] FAILED for ${domain}:`, err instanceof Error ? err.message : err);
    throw err;
  }
}
