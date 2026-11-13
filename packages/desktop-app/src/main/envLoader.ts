import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Loads environment variables from the nearest `.env` file (checking workspace root
 * candidates relative to `__dirname` and `process.cwd()`).
 * Existing non-empty `process.env` values are preserved.
 */
export function loadWorkspaceEnv(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '.env'),
  ];

  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!envPath) {
    return null;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIdx = normalized.indexOf('=');
    if (eqIdx <= 0) {
      continue;
    }

    const key = normalized.slice(0, eqIdx).trim();
    let value = normalized.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return envPath;
}
