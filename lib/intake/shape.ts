// Intake shape checks, shared by the audit form (client) and
// /api/audit/snapshot (server). Pure: no network, safe to import in the browser.
//
// Why this exists: on 2026-11-18 a keyboard-mash submission (site "czxc",
// email "2@gm.com", challenge "zxc") ran the full paid pipeline and emailed a
// PDF to a made-up address. These checks stop that before any cost is spent.
// They are deliberately loose on wording: a real owner typing "tax" or
// "billing", or answering in any language, should never be blocked.

export type IntakeField = 'companyUrl' | 'companyName' | 'biggestChallenge' | 'contactEmail';

export interface IntakeProblem {
  field: IntakeField;
  message: string;
}

export interface IntakeShapeInput {
  companyUrl: string;
  companyName: string;
  biggestChallenge: string;
  contactEmail: string;
}

export const MIN_CHALLENGE_CHARS = 3;

const EMAIL_RE = /^[^\s@]+@([^\s@]+)$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Hostname from whatever the person typed ("acme.com", "https://www.acme.com/x"), or null. */
export function hostFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

/** True when the host looks like a public website: has a dot, a real-looking ending, not an IP. */
export function isPlausibleHost(host: string | null): host is string {
  if (!host || host === 'localhost' || IPV4_RE.test(host) || host.includes(':')) return false;
  const labels = host.split('.');
  if (labels.length < 2 || labels.some((l) => l.length === 0)) return false;
  const tld = labels[labels.length - 1];
  return /^[a-z]{2,}$/.test(tld) || /^xn--[a-z0-9-]+$/.test(tld);
}

/** Domain part of a well-formed email (punycoded, so DNS can look it up), or null. */
export function emailDomain(email: string): string | null {
  const m = EMAIL_RE.exec(email.trim());
  if (!m) return null;
  const host = hostFromUrl(m[1]);
  return isPlausibleHost(host) ? host : null;
}

/**
 * True for keyboard mash like "zxc" or "aaaa". Loose on purpose: only
 * all-ASCII answers with no vowel, or one character repeated. Real one-word
 * answers ("tax", "billing", "payroll") and non-Latin text always pass.
 */
function looksLikeMash(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (/^(.)\1+$/i.test(compact)) return true;
  if (/^[A-Z]+$/.test(compact)) return false; // acronyms: CRM, SMS, PPC
  return /^[a-z]+$/i.test(compact) && !/[aeiouy]/i.test(compact);
}

/** First problem found, or null. Order matches the form: step 1 fields first. */
export function checkIntakeShape(input: IntakeShapeInput): IntakeProblem | null {
  if (!isPlausibleHost(hostFromUrl(input.companyUrl))) {
    return { field: 'companyUrl', message: 'Please enter your full website address, like yourcompany.com' };
  }
  if (!/[\p{L}\p{N}]/u.test(input.companyName)) {
    return { field: 'companyName', message: 'Please enter your company name' };
  }
  const challenge = input.biggestChallenge.trim();
  if (challenge.length < MIN_CHALLENGE_CHARS || !/\p{L}/u.test(challenge) || looksLikeMash(challenge)) {
    return {
      field: 'biggestChallenge',
      message: 'Tell us a little more about that task, a few words is plenty (for example "chasing unpaid invoices")',
    };
  }
  if (!emailDomain(input.contactEmail)) {
    return { field: 'contactEmail', message: 'Please enter a valid email address' };
  }
  return null;
}
