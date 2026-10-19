// Em dashes read as an AI tell in a report sent under Max's name. The prompts
// no longer demonstrate them, and this backstop rewrites any the model still
// writes, in every string of a parsed model response.
//
// Pure, no imports, so the check script can load it with
// node --experimental-strip-types.

/** "A — b" -> "A, b". Also covers a bare em dash between words. */
export function stripEmDashes(text: string): string {
  return text.replace(/\s*—\s*/g, ', ');
}

/** Returns a copy of a parsed JSON value with every string passed through stripEmDashes. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === 'string') return stripEmDashes(value) as T;
  if (Array.isArray(value)) return value.map((v) => stripEmDashesDeep(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripEmDashesDeep(v);
    return out as T;
  }
  return value;
}
