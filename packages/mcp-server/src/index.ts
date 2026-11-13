#!/usr/bin/env node

import { startStdioServer } from './server';

export * from './reportExporter';
export * from './screenFallback';
export * from './server';
export * from './stateReader';

if (require.main === module) {
  startStdioServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`[botprogracraft-mcp] Fatal error: ${message}\n`);
    process.exit(1);
  });
}
