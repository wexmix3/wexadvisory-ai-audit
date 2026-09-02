import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'pdfjs-dist'],
  // pdfjs-dist's "fake worker" fallback dynamically imports pdf.worker.mjs by
  // path at runtime — Vercel's file tracer can't see that statically, so the
  // worker file never made it into the deployed function bundle and every
  // visual-QA rasterization call failed with a "Cannot find module" error.
  outputFileTracingIncludes: {
    '/api/audit/process': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
};

export default nextConfig;
