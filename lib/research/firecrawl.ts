import FirecrawlApp from '@mendable/firecrawl-js';

let client: FirecrawlApp | null = null;

function getClient(): FirecrawlApp {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');
    client = new FirecrawlApp({ apiKey });
  }
  return client;
}

export async function scrapeUrl(url: string, maxChars = 6000): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getClient().scrapeUrl(url, { formats: ['markdown'] }) as any;
    const markdown: string = result?.markdown ?? result?.content ?? '';
    return markdown.slice(0, maxChars);
  } catch {
    return '';
  }
}

export async function scrapeMultiplePages(baseUrl: string): Promise<Record<string, string>> {
  const normalized = baseUrl.replace(/\/$/, '');
  const pagePaths = ['', '/about', '/services', '/team', '/careers', '/pricing', '/contact'];

  const results = await Promise.allSettled(
    pagePaths.map(async (path) => {
      const url = normalized + path;
      const content = await scrapeUrl(url, 3000);
      return { path, content };
    })
  );

  const pages: Record<string, string> = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.content) {
      pages[r.value.path || '/'] = r.value.content;
    }
  }
  return pages;
}

export function consolidateWebContent(pages: Record<string, string>): string {
  return Object.entries(pages)
    .map(([path, content]) => `=== PAGE: ${path || '/'} ===\n${content}`)
    .join('\n\n')
    .slice(0, 12000);
}
