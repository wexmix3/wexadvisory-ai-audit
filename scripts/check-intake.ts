// Checks lib/intake: the junk guard in front of /api/audit/snapshot.
// Offline section uses a fake resolver; the live section does real DNS
// lookups (free, a few seconds). No API calls, no DB writes.
// Run: node --experimental-strip-types scripts/check-intake.ts

import assert from 'node:assert/strict';
import { checkIntakeShape, emailDomain, hostFromUrl, isPlausibleHost } from '../lib/intake/shape.ts';
import { checkIntakeDns, type Resolver } from '../lib/intake/dns-check.ts';

let checks = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  checks++;
  console.log(`ok  ${name}`);
}

const good = {
  companyUrl: 'https://mypieceofcakemove.com',
  companyName: 'Piece of Cake Moving',
  biggestChallenge: 'chasing unpaid invoices',
  contactEmail: 'owner@mypieceofcakemove.com',
};

const err = (code: string) => Object.assign(new Error(code), { code });

function fakeResolver(opts: { hosts?: string[]; mx?: string[]; hostErr?: string; mxErr?: string }): Resolver {
  return {
    async lookup(host) {
      if (opts.hostErr) throw err(opts.hostErr);
      if (!(opts.hosts ?? []).includes(host)) throw err('ENOTFOUND');
      return { address: '1.2.3.4' };
    },
    async resolveMx(domain) {
      if (opts.mxErr) throw err(opts.mxErr);
      if (!(opts.mx ?? []).includes(domain)) throw err('ENOTFOUND');
      return [{ exchange: `mx.${domain}` }];
    },
  };
}

// --- shape (pure) ---
await check('the 11-18 junk submission is rejected on the website', () => {
  const p = checkIntakeShape({ companyUrl: 'https://czxc', companyName: 'czxc', biggestChallenge: 'zxc', contactEmail: '2@gm.com' });
  assert.equal(p?.field, 'companyUrl');
});
await check('a normal intake passes shape', () => assert.equal(checkIntakeShape(good), null));
await check('one-word real answers pass (no wording gate)', () => {
  for (const c of ['invoicing', 'Scheduling', 'tax', 'billing', 'payroll', 'quotes', 'emails', 'CRM', 'SEO', 'SMS']) {
    assert.equal(checkIntakeShape({ ...good, biggestChallenge: c }), null, c);
  }
});
await check('non-Latin names and answers pass', () => {
  assert.equal(checkIntakeShape({ ...good, companyName: 'Ромашка', biggestChallenge: 'счета-фактуры' }), null);
  assert.equal(checkIntakeShape({ ...good, companyName: '山田商店', biggestChallenge: '請求書の作成' }), null);
});
await check('mash and empty-ish challenges are rejected', () => {
  for (const c of ['zxc', 'asdfghjklzxc'.replace(/[aeiou]/g, ''), 'aaaa', '12345678', '!!', 'x']) {
    assert.equal(checkIntakeShape({ ...good, biggestChallenge: c })?.field, 'biggestChallenge', c);
  }
});
await check('bad emails are rejected', () => {
  for (const e of ['2@gm', 'nobody', 'a@b.c', 'a b@x.com', 'a@localhost', 'a@127.0.0.1']) {
    assert.equal(checkIntakeShape({ ...good, contactEmail: e })?.field, 'contactEmail', e);
  }
});
await check('unicode email domains are accepted and punycoded for DNS', () => {
  assert.equal(emailDomain('info@bücher.de'), 'xn--bcher-kva.de');
  assert.equal(emailDomain('Owner@Acme.COM'), 'acme.com');
  assert.equal(checkIntakeShape({ ...good, contactEmail: 'info@bücher.de' }), null);
});
await check('url forms people actually type are accepted', () => {
  for (const u of ['acme.com', 'www.acme.co.uk', 'https://acme.com/about', 'ACME.COM', 'shop.acme.nyc', 'xn--bcher-kva.de']) {
    assert.ok(isPlausibleHost(hostFromUrl(u)), u);
  }
});
await check('non-websites are rejected', () => {
  for (const u of ['czxc', 'https://czxc', 'localhost', '127.0.0.1', 'acme.c0m', 'http://', '']) {
    assert.ok(!isPlausibleHost(hostFromUrl(u)), u);
  }
});

// --- dns (fake resolver) ---
await check('site that does not resolve is rejected', async () => {
  const p = await checkIntakeDns(good, fakeResolver({ hosts: [], mx: ['mypieceofcakemove.com'] }));
  assert.equal(p?.field, 'companyUrl');
});
await check('bare domain missing but www resolves is accepted', async () => {
  const p = await checkIntakeDns(good, fakeResolver({ hosts: ['www.mypieceofcakemove.com'], mx: ['mypieceofcakemove.com'] }));
  assert.equal(p, null);
});
await check('typed www but only the bare domain exists is accepted', async () => {
  const p = await checkIntakeDns(
    { ...good, companyUrl: 'www.mypieceofcakemove.com' },
    fakeResolver({ hosts: ['mypieceofcakemove.com'], mx: ['mypieceofcakemove.com'] }),
  );
  assert.equal(p, null);
});
await check('email domain that does not exist is rejected', async () => {
  const p = await checkIntakeDns(
    { ...good, contactEmail: 'a@no-such-domain.com' },
    fakeResolver({ hosts: ['mypieceofcakemove.com'], mx: [] }),
  );
  assert.equal(p?.field, 'contactEmail');
});
await check('email domain with no MX but a live address is accepted (RFC 5321 implicit MX)', async () => {
  const r = fakeResolver({ hosts: ['mypieceofcakemove.com'], mx: [] });
  r.resolveMx = async () => { throw err('ENODATA'); };
  assert.equal(await checkIntakeDns(good, r), null);
});
await check('DNS hiccups let the audit through (never lose a real lead to a timeout)', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await checkIntakeDns(good, fakeResolver({ hostErr: 'ESERVFAIL', mxErr: 'ETIMEOUT' })), null);
  } finally {
    console.warn = warn;
  }
});

// --- dns (live, real lookups) ---
await check('live: real site + real mail domain pass', async () => {
  assert.equal(await checkIntakeDns({ companyUrl: 'https://wexadvisory.com', contactEmail: 'someone@gmail.com' }), null);
});
await check('live: made-up site is rejected', async () => {
  const p = await checkIntakeDns({ companyUrl: 'https://czxcqzvq-not-a-real-site-8812.com', contactEmail: 'someone@gmail.com' });
  assert.equal(p?.field, 'companyUrl');
});
await check('live: made-up email domain is rejected', async () => {
  const p = await checkIntakeDns({ companyUrl: 'https://wexadvisory.com', contactEmail: 'a@qzvq-no-mail-8812.com' });
  assert.equal(p?.field, 'contactEmail');
});

console.log(`\n${checks} checks passed`);
