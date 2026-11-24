import { withBotId } from 'botid/next/config';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Read at runtime with fs/node:sqlite, so tell the tracer to ship them with the function.
  outputFileTracingIncludes: { '/api/chat': ['./data/f1.db', './docs/persona.md'] },
};

// Adds the rewrites BotID's invisible challenge needs.
export default withBotId(config);
