// Checks lib/research/firecrawl.ts: a Firecrawl failure must be recorded and
// warned about, never turned into an empty website silently.
// Uses a deliberately invalid API key, so Firecrawl answers 401 for free.
// No credits, no DB writes. Pass --live to also scrape one real page with the
// key in .env.local (7 credits: home page + 6 subpages).
// Run: node --experimental-strip-types scripts/check-firecrawl.ts [--live]

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const live = process.argv.includes('--live');
const realKey = live
  ? readFileSync('.env.local', 'utf8').match(/^FIRECRAWL_API_KEY=(.*)$/m)?.[1]?.replace(/["\r]/g, '')
  : undefined;

let checks = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  checks++;
  console.log(`ok  ${name}`);
}

const { websiteReadWarning, PAGE_PATHS } = await import('../lib/research/firecrawl.ts');

await check('no failures -> no warning', () => {
  assert.equal(websiteReadWarning({ pages: { '/': 'x' }, failures: [] }), null);
});

await check('one subpage failing -> no warning (noise)', () => {
  assert.equal(websiteReadWarning({ pages: { '/': 'x' }, failures: [{ path: '/team', error: 'timeout' }] }), null);
});

await check('home page failing -> warning names the error', () => {
  const w = websiteReadWarning({ pages: { '/about': 'x' }, failures: [{ path: '/', error: 'timeout' }] });
  assert.match(w ?? '', /Home page could not be read.*timeout.*1 other page/);
});

await check('every page failing -> "search results only" warning', () => {
  const failures = PAGE_PATHS.map((p) => ({ path: p || '/', error: 'Unauthorized' }));
  assert.match(websiteReadWarning({ pages: {}, failures }) ?? '', /Website could not be read.*search results only/);
});

const { scrapeMultiplePages } = await import('../lib/research/firecrawl.ts');

// Fake Firecrawl: path -> what it returns (a doc, or an Error to throw).
function fake(byPath: Record<string, { status?: number; md?: string } | Error>) {
  return async (url: string) => {
    const path = new URL(url).pathname.replace(/\/$/, '') || '';
    const r = byPath[path] ?? { status: 404, md: '# Page not found' };
    if (r instanceof Error) throw r;
    return { markdown: r.md, metadata: { statusCode: r.status } };
  };
}
async function quiet<T>(fn: () => Promise<T>): Promise<{ value: T; logged: number }> {
  let logged = 0;
  const orig = console.error;
  console.error = () => { logged++; };
  try { return { value: await fn(), logged }; } finally { console.error = orig; }
}

await check('missing subpages (404) are skipped, not failures, and not fed in as content', async () => {
  const { value, logged } = await quiet(() =>
    scrapeMultiplePages('https://acme.com', fake({ '': { status: 200, md: 'Acme home' }, '/gone': { status: 410 } })),
  );
  assert.deepEqual(value.pages, { '/': 'Acme home' });
  assert.deepEqual(value.failures, []);
  assert.equal(logged, 0);
  assert.equal(websiteReadWarning(value), null);
});

await check('blocked site (403 everywhere) is a failure with a warning', async () => {
  const all = Object.fromEntries(PAGE_PATHS.map((p) => [p, { status: 403, md: 'Access denied' }]));
  const { value, logged } = await quiet(() => scrapeMultiplePages('https://acme.com', fake(all)));
  assert.equal(value.failures.length, PAGE_PATHS.length);
  assert.equal(value.failures[0].error, 'site returned HTTP 403');
  assert.equal(logged, PAGE_PATHS.length);
  assert.match(websiteReadWarning(value) ?? '', /Website could not be read \(site returned HTTP 403\)/);
});

await check('home page 503, subpage fine -> home-page warning', async () => {
  const { value } = await quiet(() =>
    scrapeMultiplePages('https://acme.com', fake({ '': { status: 503 }, '/about': { status: 200, md: 'About us' } })),
  );
  assert.deepEqual(Object.keys(value.pages), ['/about']);
  assert.match(websiteReadWarning(value) ?? '', /Home page could not be read \(site returned HTTP 503\); 1 other page/);
});

await check('home page 200 but empty (JS-only site) -> failure + warning', async () => {
  const { value } = await quiet(() => scrapeMultiplePages('https://acme.com', fake({ '': { status: 200, md: '' } })));
  assert.deepEqual(value.failures, [{ path: '/', error: 'home page returned no readable content' }]);
  assert.match(websiteReadWarning(value) ?? '', /no readable content/);
});

await check('long multi-line error text is flattened and capped', async () => {
  const long = new Error('line one\n' + 'x'.repeat(500));
  const { value } = await quiet(() => scrapeMultiplePages('https://acme.com', fake({ '': long })));
  const e = value.failures[0].error;
  assert.ok(e.length <= 203 && !e.includes('\n') && e.startsWith('line one x'));
});

// Bad key: the client is created on first use, so set the env before calling.
process.env.FIRECRAWL_API_KEY = 'fc-invalid-key-for-check';

await check('bad key: every page recorded as a failure, warning raised', async () => {
  const errors: string[] = [];
  const origError = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.join(' ')); };
  try {
    const scrape = await scrapeMultiplePages('https://example.com');
    assert.deepEqual(scrape.pages, {});
    assert.equal(scrape.failures.length, PAGE_PATHS.length);
    assert.match(scrape.failures[0].error, /unauthori[sz]ed|invalid/i);
    assert.match(websiteReadWarning(scrape) ?? '', /Website could not be read/);
    assert.equal(errors.length, PAGE_PATHS.length, 'each failure is logged');
  } finally {
    console.error = origError;
  }
});

if (live) {
  assert.ok(realKey, 'FIRECRAWL_API_KEY missing from .env.local');
  // Fresh module instance so the cached bad-key client is not reused.
  process.env.FIRECRAWL_API_KEY = realKey;
  const fresh = await import(`../lib/research/firecrawl.ts?live=${Date.now()}`);
  await check('live: real site reads, missing subpages skipped, no failures', async () => {
    const scrape = await fresh.scrapeMultiplePages('https://mypieceofcakemove.com');
    assert.deepEqual(scrape.failures, []);
    assert.ok((scrape.pages['/'] ?? '').length > 500, 'home page has content');
    for (const [path, md] of Object.entries(scrape.pages)) {
      assert.doesNotMatch(md as string, /^#*\s*(404|page not found)/im, `${path} looks like a 404 page`);
    }
    console.log('    pages read:', Object.keys(scrape.pages).join(', '));
  });
}

console.log(`\n${checks} checks passed`);
