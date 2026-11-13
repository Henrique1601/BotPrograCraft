import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type LiveScreenSnapshot } from './stateReader';
export interface CreateMcpServerOptions {
    homeDir?: string;
    captureScreenFallback?: (homeDir?: string) => Promise<LiveScreenSnapshot | null>;
}
/**
 * Creates and configures the BotPrograCraft MCP server with all 7 tools.
 */
export declare function createBotPrograCraftMcpServer(options?: CreateMcpServerOptions): McpServer;
/**
 * Starts the BotPrograCraft MCP server over stdio.
 */
export declare function startStdioServer(options?: CreateMcpServerOptions): Promise<McpServer>;
//# sourceMappingURL=server.d.ts.map