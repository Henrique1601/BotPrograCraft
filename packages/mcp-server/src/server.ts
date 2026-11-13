import { buildSystemPrompt, runExerciseCheck } from '@botprogracraft/ai-core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { captureWindowsScreenJpeg } from './screenFallback';
import {
  getBotPrograCraftHome,
  openProgressRepository,
  readLatestFrame,
  readLiveState,
  type LiveScreenSnapshot,
} from './stateReader';

export interface CreateMcpServerOptions {
  homeDir?: string;
  captureScreenFallback?: (homeDir?: string) => Promise<LiveScreenSnapshot | null>;
}

const TUTOR_MODE_ENUM = z.enum([
  'socratic',
  'pair-programming',
  'explain-bug',
  'logic-challenge',
  'direct',
]);

const GetTutorPromptInputSchema = z.object({
  mode: TUTOR_MODE_ENUM.describe('BotPrograCraft tutoring mode'),
  unfiltered: z.boolean().optional().describe('Disable pedagogical withholding'),
  preferredLanguage: z
    .enum(['auto', 'pt-BR', 'en'])
    .optional()
    .describe('Preferred response language'),
  studentGoal: z.string().optional().describe('Optional learning goal for this session'),
  extraInstructions: z.string().optional().describe('Optional extra system instructions'),
});

const RecordExerciseAttemptInputSchema = z.object({
  title: z.string().min(1).describe('Title of the exercise or challenge'),
  mode: z.string().min(1).describe('Tutoring mode used during the exercise'),
  languageId: z.string().min(1).describe('Programming language ID (e.g. typescript, python)'),
  prompt: z.string().min(1).describe('Exercise prompt or problem statement'),
  userCode: z.string().describe('Submitted code solution'),
  passed: z.boolean().describe('Whether the attempt passed evaluation'),
  score: z.number().min(0).max(100).describe('Numeric score between 0 and 100'),
  feedback: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional structured evaluation feedback object'),
});

const GetLiveScreenInputSchema = z.object({
  captureNow: z
    .boolean()
    .optional()
    .describe('Force an on-demand Windows screen capture instead of reading a cached frame'),
});

const RunExerciseCheckInputSchema = z.object({
  language: z
    .enum(['javascript', 'typescript', 'python'])
    .describe('Programming language to execute'),
  code: z.string().describe('User code to test'),
  testCases: z
    .array(
      z.object({
        input: z.string().describe('Stdin input passed to the program'),
        expectedOutput: z.string().describe('Expected stdout output'),
      }),
    )
    .min(1)
    .describe('Test cases to run against the code'),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(30_000)
    .optional()
    .describe('Per-test-case execution timeout in milliseconds (default 3000)'),
  recordAttempt: z
    .boolean()
    .optional()
    .describe('When true and title + mode are provided, persists the attempt to SQLite'),
  title: z.string().min(1).optional().describe('Exercise title (required when recordAttempt is true)'),
  mode: z.string().min(1).optional().describe('Tutoring mode (required when recordAttempt is true)'),
  prompt: z.string().optional().describe('Optional exercise prompt stored with the attempt'),
});

/**
 * Creates and configures the BotPrograCraft MCP server with all 6 tools.
 */
export function createBotPrograCraftMcpServer(options: CreateMcpServerOptions = {}): McpServer {
  const server = new McpServer({
    name: 'botprogracraft',
    version: '0.3.0',
  });
  const captureScreenFallback =
    options.captureScreenFallback ?? ((homeDir?: string) => captureWindowsScreenJpeg({ homeDir }));

  server.registerTool(
    'get_live_ide_context',
    {
      title: 'Get Live IDE Context',
      description:
        'Reads the latest active editor state (file, language, selection, visible code, diagnostics) and active tutor mode from BotPrograCraft.',
    },
    async () => {
      const home = getBotPrograCraftHome(options.homeDir);
      const snapshot = readLiveState(home);

      if (!snapshot) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  available: false,
                  home,
                  message: 'No live IDE state found yet. Ensure BotPrograCraft desktop app and IDE extension are running.',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                available: true,
                ...snapshot,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_live_screen',
    {
      title: 'Get Live Screen',
      description:
        'Returns the latest screen frame captured by BotPrograCraft as a JPEG image alongside capture metadata. Falls back to on-demand Windows screen capture when no frame exists or captureNow is true.',
      inputSchema: GetLiveScreenInputSchema,
    },
    async (args) => {
      const parsed = GetLiveScreenInputSchema.parse(args ?? {});
      const home = getBotPrograCraftHome(options.homeDir);

      let frame = parsed.captureNow ? null : readLatestFrame(home);
      let capturedOnDemand = false;

      if (!frame) {
        frame = await captureScreenFallback(home);
        capturedOnDemand = frame !== null;
      }

      if (!frame) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  available: false,
                  home,
                  message: 'No captured screen frame found and on-demand capture was unavailable.',
                },
                null,
                2,
              ),
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
            text: JSON.stringify(
              {
                available: true,
                width: frame.width,
                height: frame.height,
                timestamp: frame.timestamp,
                capturedOnDemand,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_tutor_prompt',
    {
      title: 'Get Tutor Prompt',
      description:
        'Builds the BotPrograCraft system prompt for a given TutorMode (socratic, pair-programming, explain-bug, logic-challenge, direct).',
      inputSchema: GetTutorPromptInputSchema,
    },
    async (args) => {
      const parsed = GetTutorPromptInputSchema.parse(args);
      const prompt = buildSystemPrompt({
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
    },
  );

  server.registerTool(
    'record_exercise_attempt',
    {
      title: 'Record Exercise Attempt',
      description:
        'Validates and persists an exercise attempt to the shared BotPrograCraft SQLite database.',
      inputSchema: RecordExerciseAttemptInputSchema,
    },
    async (args) => {
      const parsed = RecordExerciseAttemptInputSchema.parse(args);
      const repo = openProgressRepository(options.homeDir);
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
      } finally {
        repo.close();
      }
    },
  );

  server.registerTool(
    'get_learning_progress',
    {
      title: 'Get Learning Progress',
      description:
        'Returns aggregate learning statistics, the 5 most recent exercise attempts, and the top 5 recurring errors.',
    },
    async () => {
      const repo = openProgressRepository(options.homeDir);
      try {
        const stats = repo.getStats();
        const recentAttempts = repo.listRecentAttempts({ limit: 5 });
        const topRecurringErrors = repo.getTopRecurringErrors({ limit: 5 });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  stats,
                  recentAttempts,
                  topRecurringErrors,
                },
                null,
                2,
              ),
            },
          ],
        };
      } finally {
        repo.close();
      }
    },
  );

  server.registerTool(
    'run_exercise_check',
    {
      title: 'Run Exercise Check',
      description:
        'Executes JavaScript, TypeScript, or Python code against stdin/stdout test cases in an isolated child process and optionally records the attempt to SQLite.',
      inputSchema: RunExerciseCheckInputSchema,
    },
    async (args) => {
      const parsed = RunExerciseCheckInputSchema.parse(args);
      const result = await runExerciseCheck({
        language: parsed.language,
        code: parsed.code,
        testCases: parsed.testCases,
        timeoutMs: parsed.timeoutMs,
      });

      let recordedAttempt: unknown = undefined;
      if (parsed.recordAttempt && parsed.title && parsed.mode) {
        const score =
          result.totalCount > 0 ? Math.round((result.passedCount / result.totalCount) * 100) : 0;
        const repo = openProgressRepository(options.homeDir);
        try {
          recordedAttempt = repo.recordAttempt({
            title: parsed.title,
            mode: parsed.mode,
            languageId: parsed.language,
            prompt: parsed.prompt ?? parsed.title,
            userCode: parsed.code,
            passed: result.passed,
            score,
            feedback: {
              passedCount: result.passedCount,
              totalCount: result.totalCount,
              results: result.results,
            },
          });
        } finally {
          repo.close();
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              recordedAttempt !== undefined ? { ...result, recordedAttempt } : result,
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}

/**
 * Starts the BotPrograCraft MCP server over stdio.
 */
export async function startStdioServer(options: CreateMcpServerOptions = {}): Promise<McpServer> {
  const server = createBotPrograCraftMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
