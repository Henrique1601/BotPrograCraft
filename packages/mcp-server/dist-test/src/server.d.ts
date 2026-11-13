import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface CreateMcpServerOptions {
    homeDir?: string;
}
/**
 * Creates and configures the BotPrograCraft MCP server with all 5 tools.
 */
export declare function createBotPrograCraftMcpServer(options?: CreateMcpServerOptions): McpServer;
/**
 * Starts the BotPrograCraft MCP server over stdio.
 */
export declare function startStdioServer(options?: CreateMcpServerOptions): Promise<McpServer>;
//# sourceMappingURL=server.d.ts.map