"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBotPrograCraftMcpServer = createBotPrograCraftMcpServer;
exports.startStdioServer = startStdioServer;
const ai_core_1 = require("@botprogracraft/ai-core");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const stateReader_1 = require("./stateReader");
const TUTOR_MODE_ENUM = zod_1.z.enum([
    'socratic',
    'pair-programming',
    'explain-bug',
    'logic-challenge',
    'direct',
]);
const GetTutorPromptInputSchema = zod_1.z.object({
    mode: TUTOR_MODE_ENUM.describe('BotPrograCraft tutoring mode'),
    unfiltered: zod_1.z.boolean().optional().describe('Disable pedagogical withholding'),
    preferredLanguage: zod_1.z
        .enum(['auto', 'pt-BR', 'en'])
        .optional()
        .describe('Preferred response language'),
    studentGoal: zod_1.z.string().optional().describe('Optional learning goal for this session'),
    extraInstructions: zod_1.z.string().optional().describe('Optional extra system instructions'),
});
const RecordExerciseAttemptInputSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).describe('Title of the exercise or challenge'),
    mode: zod_1.z.string().min(1).describe('Tutoring mode used during the exercise'),
    languageId: zod_1.z.string().min(1).describe('Programming language ID (e.g. typescript, python)'),
    prompt: zod_1.z.string().min(1).describe('Exercise prompt or problem statement'),
    userCode: zod_1.z.string().describe('Submitted code solution'),
    passed: zod_1.z.boolean().describe('Whether the attempt passed evaluation'),
    score: zod_1.z.number().min(0).max(100).describe('Numeric score between 0 and 100'),
    feedback: zod_1.z
        .record(zod_1.z.string(), zod_1.z.unknown())
        .optional()
        .describe('Optional structured evaluation feedback object'),
});
/**
 * Creates and configures the BotPrograCraft MCP server with all 5 tools.
 */
function createBotPrograCraftMcpServer(options = {}) {
    const server = new mcp_js_1.McpServer({
        name: 'botprogracraft',
        version: '0.3.0',
    });
    server.registerTool('get_live_ide_context', {
        title: 'Get Live IDE Context',
        description: 'Reads the latest active editor state (file, language, selection, visible code, diagnostics) and active tutor mode from BotPrograCraft.',
    }, async () => {
        const home = (0, stateReader_1.getBotPrograCraftHome)(options.homeDir);
        const snapshot = (0, stateReader_1.readLiveState)(home);
        if (!snapshot) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            available: false,
                            home,
                            message: 'No live IDE state found yet. Ensure BotPrograCraft desktop app and IDE extension are running.',
                        }, null, 2),
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        available: true,
                        ...snapshot,
                    }, null, 2),
                },
            ],
        };
    });
    server.registerTool('get_live_screen', {
        title: 'Get Live Screen',
        description: 'Returns the latest screen frame captured by BotPrograCraft as a JPEG image alongside capture metadata.',
    }, async () => {
        const home = (0, stateReader_1.getBotPrograCraftHome)(options.homeDir);
        const frame = (0, stateReader_1.readLatestFrame)(home);
        if (!frame) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            available: false,
                            home,
                            message: 'No captured screen frame found yet.',
                        }, null, 2),
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: 'image',
                    data: frame.imageBase64,
                    mimeType: frame.mimeType,
                },
                {
                    type: 'text',
                    text: JSON.stringify({
                        available: true,
                        width: frame.width,
                        height: frame.height,
                        timestamp: frame.timestamp,
                    }, null, 2),
                },
            ],
        };
    });
    server.registerTool('get_tutor_prompt', {
        title: 'Get Tutor Prompt',
        description: 'Builds the BotPrograCraft system prompt for a given TutorMode (socratic, pair-programming, explain-bug, logic-challenge, direct).',
        inputSchema: GetTutorPromptInputSchema,
    }, async (args) => {
        const parsed = GetTutorPromptInputSchema.parse(args);
        const prompt = (0, ai_core_1.buildSystemPrompt)({
            mode: parsed.mode,
            unfiltered: parsed.unfiltered,
            preferredLanguage: parsed.preferredLanguage,
            studentGoal: parsed.studentGoal,
            extraInstructions: parsed.extraInstructions,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: prompt,
                },
            ],
        };
    });
    server.registerTool('record_exercise_attempt', {
        title: 'Record Exercise Attempt',
        description: 'Validates and persists an exercise attempt to the shared BotPrograCraft SQLite database.',
        inputSchema: RecordExerciseAttemptInputSchema,
    }, async (args) => {
        const parsed = RecordExerciseAttemptInputSchema.parse(args);
        const repo = (0, stateReader_1.openProgressRepository)(options.homeDir);
        try {
            const record = repo.recordAttempt({
                title: parsed.title,
                mode: parsed.mode,
                languageId: parsed.languageId,
                prompt: parsed.prompt,
                userCode: parsed.userCode,
                passed: parsed.passed,
                score: parsed.score,
                feedback: parsed.feedback,
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(record, null, 2),
                    },
                ],
            };
        }
        finally {
            repo.close();
        }
    });
    server.registerTool('get_learning_progress', {
        title: 'Get Learning Progress',
        description: 'Returns aggregate learning statistics, the 5 most recent exercise attempts, and the top 5 recurring errors.',
    }, async () => {
        const repo = (0, stateReader_1.openProgressRepository)(options.homeDir);
        try {
            const stats = repo.getStats();
            const recentAttempts = repo.listRecentAttempts({ limit: 5 });
            const topRecurringErrors = repo.getTopRecurringErrors({ limit: 5 });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            stats,
                            recentAttempts,
                            topRecurringErrors,
                        }, null, 2),
                    },
                ],
            };
        }
        finally {
            repo.close();
        }
    });
    return server;
}
/**
 * Starts the BotPrograCraft MCP server over stdio.
 */
async function startStdioServer(options = {}) {
    const server = createBotPrograCraftMcpServer(options);
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    return server;
}
//# sourceMappingURL=server.js.map