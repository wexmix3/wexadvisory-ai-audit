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

// MX goes through public resolvers, not the system default: the system
// resolver is not guaranteed to answer MX queries (on Max's machine it points
// at 127.0.0.1 and refuses them), which would turn the email check into a
// silent no-op. Site lookups use getaddrinfo, which works everywhere.
const mxResolver = new dns.Resolver({ timeout: 2000, tries: 1 });
mxResolver.setServers(['1.1.1.1', '8.8.8.8']);

const nodeResolver: Resolver = {
  lookup: (host) => dns.lookup(host),
  resolveMx: (domain) => mxResolver.resolveMx(domain),
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
