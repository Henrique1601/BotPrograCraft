import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface McpInstallResult {
  configPath: string;
  backupPath: string | null;
  serverEntryPath: string;
}

export interface InstallMcpOptions {
  configPath?: string;
  serverEntryPath?: string;
}

function resolveMcpServerEntryPath(explicit?: string): string {
  if (explicit && explicit.trim()) {
    return path.resolve(explicit.trim());
  }
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'mcp-server', 'dist', 'index.js'),
    path.resolve(process.cwd(), 'packages', 'mcp-server', 'dist', 'index.js'),
    path.resolve(process.cwd(), '..', 'mcp-server', 'dist', 'index.js'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0]!;
}

export function installAntigravityMcpConfig(
  options: InstallMcpOptions = {},
): McpInstallResult {
  const configPath =
    options.configPath?.trim() ||
    path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
  const serverEntryPath = resolveMcpServerEntryPath(options.serverEntryPath);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  let backupPath: string | null = null;
  let existingConfig: Record<string, unknown> = {};

  if (fs.existsSync(configPath)) {
    backupPath = `${configPath}.bak`;
    fs.copyFileSync(configPath, backupPath);

    const raw = fs.readFileSync(configPath, 'utf8').trim();
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        existingConfig = parsed as Record<string, unknown>;
      } else {
        throw new Error('Existing mcp_config.json is not a JSON object.');
      }
    }
  }

  const currentServers =
    existingConfig.mcpServers !== null &&
    typeof existingConfig.mcpServers === 'object' &&
    !Array.isArray(existingConfig.mcpServers)
      ? (existingConfig.mcpServers as Record<string, unknown>)
      : {};

  const updatedConfig: Record<string, unknown> = {
    ...existingConfig,
    mcpServers: {
      ...currentServers,
      botprogracraft: {
        command: 'node',
        args: [serverEntryPath],
      },
    },
  };

  const tmpPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(updatedConfig, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, configPath);

  return {
    configPath,
    backupPath,
    serverEntryPath,
  };
}
