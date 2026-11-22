// Server-only intake checks that need DNS: does the website exist, and can the
// email domain receive mail. Run after checkIntakeShape() passes.
//
// Policy: reject only on a definite "does not exist" answer (ENOTFOUND /
// ENODATA). A timeout or resolver hiccup lets the audit through and logs a
// warning, so a slow DNS server never costs a real lead.

import { promises as dns } from 'node:dns';
import { emailDomain, hostFromUrl, type IntakeProblem, type IntakeShapeInput } from './shape.ts';

export interface Resolver {
  lookup(host: string): Promise<unknown>;
  resolveMx(domain: string): Promise<{ exchange: string }[]>;
}

// Everything goes through public resolvers, never the system default. The
// system resolver gives no usable "does not exist" answer in either place we
// run: on Max's machine it is 127.0.0.1 and refuses MX queries, and on Vercel
// getaddrinfo returns EBUSY (not ENOTFOUND) for a made-up domain, which made
// the site check silently pass everything (seen live 2026-11-21).
const publicResolver = new dns.Resolver({ timeout: 2000, tries: 1 });
publicResolver.setServers(['1.1.1.1', '8.8.8.8']);

/** Resolves if the host has an IPv4 or IPv6 address; rejects with ENOTFOUND/ENODATA if not. */
async function resolveAddress(host: string): Promise<void> {
  try {
    await publicResolver.resolve4(host);
  } catch (err) {
    if ((err as { code?: string }).code !== 'ENODATA') throw err;
    await publicResolver.resolve6(host);
  }
}

const nodeResolver: Resolver = {
  lookup: (host) => resolveAddress(host),
  resolveMx: (domain) => publicResolver.resolveMx(domain),
};

const DNS_TIMEOUT_MS = 3000;
const NOT_FOUND = new Set(['ENOTFOUND', 'ENODATA', 'ENODOMAIN']);

type Answer = 'yes' | 'no' | 'unknown';

async function ask(label: string, fn: () => Promise<boolean>): Promise<Answer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS);
    });
    return (await Promise.race([fn(), timeout])) ? 'yes' : 'no';
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (NOT_FOUND.has(code)) return 'no';
    console.warn(`[intake] DNS check inconclusive for ${label} (${code || 'error'}); letting it through`);
    return 'unknown';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkIntakeDns(
  input: Pick<IntakeShapeInput, 'companyUrl' | 'contactEmail'>,
  resolver: Resolver = nodeResolver,
): Promise<IntakeProblem | null> {
  const host = hostFromUrl(input.companyUrl);
  const mailDomain = emailDomain(input.contactEmail);

  const [site, mail] = await Promise.all([
    host
      ? (async () => {
          const first = await ask(host, async () => (await resolver.lookup(host), true));
          if (first !== 'no') return first;
          // Try the other spelling: typed "acme.com" but only www exists, or the reverse.
          const alt = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
          return ask(alt, async () => (await resolver.lookup(alt), true));
        })()
      : Promise.resolve<Answer>('no'),
    mailDomain
      ? ask(mailDomain, async () => {
          // No MX record is not "can't receive mail": RFC 5321 falls back to
          // the domain's own address. Only a domain that does not exist at
          // all is a definite no.
          try {
            if ((await resolver.resolveMx(mailDomain)).length > 0) return true;
          } catch (err) {
            if ((err as { code?: string }).code !== 'ENODATA') throw err;
          }
          await resolver.lookup(mailDomain);
          return true;
        })
      : Promise.resolve<Answer>('no'),
  ]);

  if (site === 'no') {
    return { field: 'companyUrl', message: "We couldn't find that website. Please check the address and try again." };
  }
  if (mail === 'no') {
    return { field: 'contactEmail', message: "That email address can't receive mail. Please check it and try again." };
  }
  return null;
}
