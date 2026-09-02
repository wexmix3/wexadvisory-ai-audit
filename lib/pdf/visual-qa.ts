import Anthropic from '@anthropic-ai/sdk';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { pathToFileURL } from 'url';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const STANDARD_FONT_DATA_URL = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/standard_fonts'
);

async function rasterizePdf(pdfBuffer: Buffer, scale = 1.5): Promise<string[]> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({
    data,
    standardFontDataUrl: `${pathToFileURL(STANDARD_FONT_DATA_URL).href}/`,
  }).promise;

  const images: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;
    images.push(canvas.toBuffer('image/png').toString('base64'));
  }
  return images;
}

const VISUAL_QA_SYSTEM = `You are a senior print/editorial designer reviewing a PDF report for layout quality before it goes to a paying client. You are shown every page as an image, in order.

Judge ONLY visual layout — not the written content. Specifically:
- Whitespace balance: any page with a large dead zone of blank space (especially at the bottom, from a section ending early) is a defect.
- Alignment: misaligned boxes, cards, or columns are a defect.
- Margin consistency: inconsistent top/side margins across pages are a defect.
- Crowding: cramped text with insufficient padding is a defect.

Output ONLY valid JSON, no markdown, no preamble:
{
  "score": <0-100 integer, 100 = flawless, professional, ready to send>,
  "issues": ["page 3: large blank gap below the last card", ...],
  "verdict": "pass" | "fail"
}
"fail" means a human should look at this before it goes out again. Be strict — minor imperfections are fine, but dead whitespace or misalignment a client would notice is a fail.`;

export interface VisualQaResult {
  score: number;
  issues: string[];
  verdict: 'pass' | 'fail';
  pageCount: number;
}

export async function scoreVisualQuality(pdfBuffer: Buffer): Promise<VisualQaResult> {
  const images = await rasterizePdf(pdfBuffer);

  const model = process.env.VISUAL_QA_MODEL ?? 'claude-haiku-4-5-20251001';
  // temperature is rejected outright (400) on Opus/Sonnet 4.6+ and Opus 5 —
  // dropped so VISUAL_QA_MODEL can be pointed at any current model without
  // this call breaking. See the same fix in lib/ai/classify.ts.
  const message = await getClient().messages.create({
    model,
    max_tokens: 1024,
    system: VISUAL_QA_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((img, i) => ([
            { type: 'text' as const, text: `Page ${i + 1}:` },
            {
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: 'image/png' as const, data: img },
            },
          ])).flat(),
          { type: 'text' as const, text: 'Score this report.' },
        ],
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Visual QA returned invalid JSON');

  const parsed = JSON.parse(match[0]);
  return {
    score: parsed.score ?? 0,
    issues: parsed.issues ?? [],
    verdict: parsed.verdict ?? 'fail',
    pageCount: images.length,
  };
}
