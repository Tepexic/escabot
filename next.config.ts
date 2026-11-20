import type { NextConfig } from 'next';

const config: NextConfig = {
  // Read at runtime with fs/node:sqlite, so tell the tracer to ship them with the function.
  outputFileTracingIncludes: { '/api/chat': ['./data/f1.db', './docs/persona.md'] },
};

export default config;
