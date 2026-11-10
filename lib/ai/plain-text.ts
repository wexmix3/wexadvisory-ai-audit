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

// The PDFs use built-in Helvetica, which has no glyph for these, so an arrow
// printed as a stray quote ("booking ' crew assignment", 2026-11-09).
const NO_GLYPH: [RegExp, string][] = [
  [/\s*[→⇒➔➜⟶]\s*/g, ' -> '],
  [/\s*[←⇐⟵]\s*/g, ' <- '],
  [/≤/g, '<='],
  [/≥/g, '>='],
];

/** Swaps characters the PDF font cannot draw for plain ASCII. */
export function pdfSafeGlyphs(text: string): string {
  return NO_GLYPH.reduce((t, [re, to]) => t.replace(re, to), text);
}

/** Returns a copy of a parsed JSON value with every string passed through stripEmDashes and pdfSafeGlyphs. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === 'string') return pdfSafeGlyphs(stripEmDashes(value)) as T;
  if (Array.isArray(value)) return value.map((v) => stripEmDashesDeep(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripEmDashesDeep(v);
    return out as T;
  }
  return value;
}
