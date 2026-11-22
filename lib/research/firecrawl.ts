import Firecrawl from '@mendable/firecrawl-js';

// Website research for the audit. Two outcomes are kept apart on purpose:
// - A subpage that does not exist (/pricing on a site without one, HTTP 404 or
//   410) is normal and is skipped quietly. Firecrawl returns those as a
//   document with a statusCode, not as an error.
// - Anything else is a failure: Firecrawl itself failing (bad key, out of
//   credits, outage, timeout), the site blocking or erroring (403, 429, 5xx),
//   or a home page with no readable content. Failures are logged, recorded on
//   the row, and shown on the lead email. Until 2026-11-22 every error here
//   was swallowed and returned as '', so a broken Firecrawl or a blocked site
//   produced reports with no website content and no trace anywhere.

let client: Firecrawl | null = null;

function getClient(): Firecrawl {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');
    client = new Firecrawl({ apiKey });
  }
  return client;
}

export interface ScrapeFailure {
  path: string;
  error: string;
}

export interface WebsiteScrape {
  /** Path -> markdown, only for pages that exist and have content. */
  pages: Record<string, string>;
  /** Failures (not missing subpages). Empty when everything worked. */
  failures: ScrapeFailure[];
}

export interface ScrapedDoc {
  markdown?: string;
  metadata?: { statusCode?: number };
}
export type ScrapeFn = (url: string) => Promise<ScrapedDoc>;

const firecrawlScrape: ScrapeFn = (url) => getClient().scrape(url, { formats: ['markdown'] });

const PAGE_MISSING = new Set([404, 410]);

/** Markdown for a page, '' if the page does not exist (404/410). Throws on any other failure. */
export async function scrapeUrl(url: string, maxChars = 6000, scrape: ScrapeFn = firecrawlScrape): Promise<string> {
  const doc = await scrape(url);
  const status = doc.metadata?.statusCode;
  if (status && PAGE_MISSING.has(status)) return '';
  if (status && status >= 400) throw new Error(`site returned HTTP ${status}`);
  return (doc.markdown ?? '').slice(0, maxChars);
}

/** Error text from a third party: one line, capped, so it fits an email line. */
function shortError(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason);
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}...` : flat;
}

export const PAGE_PATHS = ['', '/about', '/services', '/team', '/careers', '/pricing', '/contact'];

export async function scrapeMultiplePages(baseUrl: string, scrape: ScrapeFn = firecrawlScrape): Promise<WebsiteScrape> {
  const normalized = baseUrl.replace(/\/$/, '');

  const results = await Promise.allSettled(
    PAGE_PATHS.map(async (path) => ({ path, content: await scrapeUrl(normalized + path, 3000, scrape) })),
  );

  const pages: Record<string, string> = {};
  const failures: ScrapeFailure[] = [];
  results.forEach((r, i) => {
    const path = PAGE_PATHS[i] || '/';
    let error: string | null = null;
    if (r.status === 'rejected') {
      error = shortError(r.reason);
    } else if (r.value.content) {
      pages[path] = r.value.content;
    } else if (path === '/') {
      // A subpage can legitimately be missing; the home page cannot.
      error = 'home page returned no readable content';
    }
    if (error) {
      failures.push({ path, error });
      console.error(`[firecrawl] scrape failed for ${normalized}${path === '/' ? '' : path}: ${error}`);
    }
  });
  return { pages, failures };
}

/**
 * One line for the lead email when the website could not be read, or null.
 * Only the home page or a total failure counts: one subpage timing out is noise.
 */
export function websiteReadWarning(scrape: WebsiteScrape): string | null {
  if (scrape.failures.length === 0) return null;
  const homeFailed = scrape.failures.some((f) => f.path === '/');
  const allFailed = scrape.failures.length === PAGE_PATHS.length;
  if (!homeFailed && !allFailed) return null;
  const firstError = scrape.failures[0].error;
  return allFailed
    ? `Website could not be read (${firstError}). Report built from search results only.`
    : `Home page could not be read (${firstError}); ${Object.keys(scrape.pages).length} other page(s) used.`;
}

export function consolidateWebContent(pages: Record<string, string>): string {
  return Object.entries(pages)
    .map(([path, content]) => `=== PAGE: ${path || '/'} ===\n${content}`)
    .join('\n\n')
    .slice(0, 12000);
}
