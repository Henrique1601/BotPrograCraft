import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { saveStudyReportToFile } from '../src/reportExporter';
import { captureWindowsScreenJpeg } from '../src/screenFallback';
import { createBotPrograCraftMcpServer, type CreateMcpServerOptions } from '../src/server';
import {
  getBotPrograCraftHome,
  openProgressRepository,
  readLatestFrame,
  readLiveState,
} from '../src/stateReader';

type ToolContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

function getToolContent(result: unknown): ToolContentBlock[] {
  assert.ok(
    typeof result === 'object' &&
      result !== null &&
      'content' in result &&
      Array.isArray((result as { content: unknown }).content),
    'Expected tool result content to be an array',
  );
  return (result as { content: ToolContentBlock[] }).content;
}

describe('@botprogracraft/mcp-server', () => {
  let tempHome: string;
  let previousHomeEnv: string | undefined;

  beforeEach(() => {
    previousHomeEnv = process.env.BOTPROGRACRAFT_HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'botprogracraft-mcp-test-'));
    process.env.BOTPROGRACRAFT_HOME = tempHome;
  });

  afterEach(() => {
    if (previousHomeEnv === undefined) {
      delete process.env.BOTPROGRACRAFT_HOME;
    } else {
      process.env.BOTPROGRACRAFT_HOME = previousHomeEnv;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  async function createConnectedClient(options: CreateMcpServerOptions = {}): Promise<{
    client: Client;
    close: () => Promise<void>;
  }> {
    const server = createBotPrograCraftMcpServer({
      captureScreenFallback: async () => null,
      ...options,
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    return {
      client,
      close: async () => {
        await client.close();
        await server.close();
      },
    };
  }

  it('resolves BOTPROGRACRAFT_HOME and returns null when state files are absent', () => {
    assert.equal(getBotPrograCraftHome(), path.resolve(tempHome));
    assert.equal(readLiveState(), null);
    assert.equal(readLatestFrame(), null);
  });

  it('exposes all 7 MCP tools', async () => {
    const { client, close } = await createConnectedClient();
    try {
      const result = await client.listTools();
      const names = result.tools.map((t) => t.name).sort();
      assert.deepEqual(names, [
        'export_study_report',
        'get_learning_progress',
        'get_live_ide_context',
        'get_live_screen',
        'get_tutor_prompt',
        'record_exercise_attempt',
        'run_exercise_check',
      ]);
    } finally {
      await close();
    }
  });

  it('get_live_ide_context reads live-state.json and handles missing state', async () => {
    const { client, close } = await createConnectedClient();
    try {
      const missingRes = await client.callTool({ name: 'get_live_ide_context', arguments: {} });
      const missingText = (getToolContent(missingRes)[0] as { type: 'text'; text: string }).text;
      const missingJson = JSON.parse(missingText) as { available: boolean };
      assert.equal(missingJson.available, false);

      const liveState = {
        ideContext: {
          activeFile: 'src/app.ts',
          languageId: 'typescript',
          selection: {
            text: 'const x = 1;',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 12 },
            },
            isEmpty: false,
          },
          visibleRangeText: 'const x = 1;',
          diagnostics: [
            {
              message: 'Unused variable',
              severity: 'warning',
              line: 0,
            },
          ],
          workspaceName: 'BotPrograCraft',
          timestamp: 1700000000000,
        },
        tutorMode: 'pair-programming',
        updatedAt: '2026-11-13T18:00:00.000Z',
      };

      fs.writeFileSync(
        path.join(tempHome, 'live-state.json'),
        JSON.stringify(liveState, null, 2),
        'utf8',
      );

      const res = await client.callTool({ name: 'get_live_ide_context', arguments: {} });
      const text = (getToolContent(res)[0] as { type: 'text'; text: string }).text;
      const parsed = JSON.parse(text) as {
        available: boolean;
        tutorMode: string;
        ideContext: { activeFile: string; languageId: string };
      };

      assert.equal(parsed.available, true);
      assert.equal(parsed.tutorMode, 'pair-programming');
      assert.equal(parsed.ideContext.activeFile, 'src/app.ts');
      assert.equal(parsed.ideContext.languageId, 'typescript');
    } finally {
      await close();
    }
  });

  it('get_live_screen returns base64 JPEG image block and metadata', async () => {
    const { client, close } = await createConnectedClient();
    try {
      const missingRes = await client.callTool({ name: 'get_live_screen', arguments: {} });
      const missingJson = JSON.parse(
        (getToolContent(missingRes)[0] as { type: 'text'; text: string }).text,
      ) as { available: boolean };
      assert.equal(missingJson.available, false);

      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
      fs.writeFileSync(path.join(tempHome, 'latest-frame.jpg'), fakeJpeg);
      fs.writeFileSync(
        path.join(tempHome, 'latest-frame.meta.json'),
        JSON.stringify({ width: 1280, height: 720, timestamp: 1700000001234 }),
        'utf8',
      );

      const res = await client.callTool({ name: 'get_live_screen', arguments: {} });
      const blocks = getToolContent(res);
      assert.equal(blocks.length, 2);

      const imageBlock = blocks[0] as { type: string; data: string; mimeType: string };
      assert.equal(imageBlock.type, 'image');
      assert.equal(imageBlock.mimeType, 'image/jpeg');
      assert.equal(imageBlock.data, fakeJpeg.toString('base64'));

      const metaBlock = JSON.parse((blocks[1] as { type: 'text'; text: string }).text) as {
        available: boolean;
        width: number;
        height: number;
        timestamp: number;
      };
      assert.equal(metaBlock.available, true);
      assert.equal(metaBlock.width, 1280);
      assert.equal(metaBlock.height, 720);
      assert.equal(metaBlock.timestamp, 1700000001234);
    } finally {
      await close();
    }
  });

  it('get_tutor_prompt builds system prompt for the requested TutorMode', async () => {
    const { client, close } = await createConnectedClient();
    try {
      const res = await client.callTool({
        name: 'get_tutor_prompt',
        arguments: {
          mode: 'socratic',
          preferredLanguage: 'en',
          studentGoal: 'Master binary search',
        },
      });

      const text = (getToolContent(res)[0] as { type: 'text'; text: string }).text;
      assert.match(text, /Mode: Socratic Tutor/);
      assert.match(text, /Master binary search/);
      assert.match(text, /Respond primarily in English/);
    } finally {
      await close();
    }
  });

  it('record_exercise_attempt and get_learning_progress persist and query SQLite', async () => {
    const repo = openProgressRepository();
    try {
      repo.recordRecurringError({
        errorSignature: 'TS2322: Type string is not assignable to type number',
        languageId: 'typescript',
        filePath: 'src/math.ts',
      });
    } finally {
      repo.close();
    }

    const { client, close } = await createConnectedClient();
    try {
      const invalidRes = await client.callTool({
        name: 'record_exercise_attempt',
        arguments: {
          title: 'Two Sum',
          mode: 'logic-challenge',
          languageId: 'typescript',
          prompt: 'Find two numbers',
          userCode: 'return [];',
          passed: true,
          score: 150,
        },
      });
      assert.equal(invalidRes.isError, true);

      for (let i = 1; i <= 6; i++) {
        const res = await client.callTool({
          name: 'record_exercise_attempt',
          arguments: {
            title: `Exercise ${i}`,
            mode: 'logic-challenge',
            languageId: 'typescript',
            prompt: `Prompt ${i}`,
            userCode: `const ans = ${i};`,
            passed: i % 2 === 0,
            score: i * 10,
            feedback: { hintCount: i },
          },
        });
        assert.notEqual(res.isError, true);
        const created = JSON.parse(
          (getToolContent(res)[0] as { type: 'text'; text: string }).text,
        ) as {
          id: number;
          title: string;
        };
        assert.equal(created.title, `Exercise ${i}`);
      }

      const progressRes = await client.callTool({
        name: 'get_learning_progress',
        arguments: {},
      });
      const progress = JSON.parse(
        (getToolContent(progressRes)[0] as { type: 'text'; text: string }).text,
      ) as {
        stats: { totalAttempts: number; passedAttempts: number; totalRecurringErrors: number };
        recentAttempts: Array<{ title: string }>;
        topRecurringErrors: Array<{ errorSignature: string }>;
      };

      assert.equal(progress.stats.totalAttempts, 6);
      assert.equal(progress.stats.passedAttempts, 3);
      assert.equal(progress.stats.totalRecurringErrors, 1);
      assert.equal(progress.recentAttempts.length, 5);
      assert.equal(progress.recentAttempts[0].title, 'Exercise 6');
      assert.equal(progress.topRecurringErrors.length, 1);
      assert.equal(
        progress.topRecurringErrors[0].errorSignature,
        'TS2322: Type string is not assignable to type number',
      );
    } finally {
      await close();
    }
  });

  it('get_live_screen falls back to captureWindowsScreenJpeg when missing or captureNow=true', async () => {
    const fallbackJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9]);
    let captureCalls = 0;

    const { client, close } = await createConnectedClient({
      captureScreenFallback: async (homeDir) => {
        captureCalls += 1;
        return captureWindowsScreenJpeg({
          homeDir,
          execCapture: async (jpgPath, metaPath) => {
            fs.writeFileSync(jpgPath, fallbackJpeg);
            fs.writeFileSync(
              metaPath,
              JSON.stringify({ width: 1920, height: 1080, timestamp: 1700000099999 }),
              'utf8',
            );
          },
        });
      },
    });

    try {
      const firstRes = await client.callTool({ name: 'get_live_screen', arguments: {} });
      const firstBlocks = getToolContent(firstRes);
      assert.equal(captureCalls, 1);
      assert.equal(firstBlocks[0].type, 'image');
      assert.equal(
        (firstBlocks[0] as { type: 'image'; data: string }).data,
        fallbackJpeg.toString('base64'),
      );
      const firstMeta = JSON.parse((firstBlocks[1] as { type: 'text'; text: string }).text) as {
        available: boolean;
        width: number;
        height: number;
        capturedOnDemand: boolean;
      };
      assert.equal(firstMeta.available, true);
      assert.equal(firstMeta.width, 1920);
      assert.equal(firstMeta.height, 1080);
      assert.equal(firstMeta.capturedOnDemand, true);

      // Cached frame should be used without calling fallback again when captureNow is omitted
      const cachedRes = await client.callTool({ name: 'get_live_screen', arguments: {} });
      const cachedMeta = JSON.parse(
        (getToolContent(cachedRes)[1] as { type: 'text'; text: string }).text,
      ) as { capturedOnDemand: boolean };
      assert.equal(captureCalls, 1);
      assert.equal(cachedMeta.capturedOnDemand, false);

      // captureNow=true forces a fresh fallback capture
      const forcedRes = await client.callTool({
        name: 'get_live_screen',
        arguments: { captureNow: true },
      });
      const forcedMeta = JSON.parse(
        (getToolContent(forcedRes)[1] as { type: 'text'; text: string }).text,
      ) as { capturedOnDemand: boolean };
      assert.equal(captureCalls, 2);
      assert.equal(forcedMeta.capturedOnDemand, true);
    } finally {
      await close();
    }
  });

  it('run_exercise_check executes test cases and optionally records the attempt', async () => {
    const { client, close } = await createConnectedClient();
    try {
      const res = await client.callTool({
        name: 'run_exercise_check',
        arguments: {
          language: 'javascript',
          code: [
            "const fs = require('node:fs');",
            'const input = fs.readFileSync(0, "utf8").trim();',
            'const [a, b] = input.split(" ").map(Number);',
            'console.log(a + b);',
          ].join('\n'),
          testCases: [
            { input: '2 3', expectedOutput: '5' },
            { input: '10 20', expectedOutput: '30' },
          ],
          recordAttempt: true,
          title: 'Sum Two Numbers',
          mode: 'logic-challenge',
          prompt: 'Read two integers and print their sum.',
        },
      });

      assert.notEqual(res.isError, true);
      const parsed = JSON.parse(
        (getToolContent(res)[0] as { type: 'text'; text: string }).text,
      ) as {
        passed: boolean;
        passedCount: number;
        totalCount: number;
        recordedAttempt?: { id: number; title: string; passed: boolean; score: number };
      };

      assert.equal(parsed.passed, true);
      assert.equal(parsed.passedCount, 2);
      assert.equal(parsed.totalCount, 2);
      assert.ok(parsed.recordedAttempt);
      assert.equal(parsed.recordedAttempt.title, 'Sum Two Numbers');
      assert.equal(parsed.recordedAttempt.passed, true);
      assert.equal(parsed.recordedAttempt.score, 100);
    } finally {
      await close();
    }
  });

  it('export_study_report formats Obsidian Markdown, saves safely, and blocks path traversal', async () => {
    const repo = openProgressRepository();
    try {
      repo.recordAttempt({
        title: 'Binary Search',
        mode: 'logic-challenge',
        languageId: 'typescript',
        prompt: 'Find target index',
        userCode: 'return -1;',
        passed: true,
        score: 95,
      });
      repo.recordRecurringError({
        errorSignature: 'ReferenceError: x is not defined',
        languageId: 'javascript',
        filePath: 'src/index.js',
      });
    } finally {
      repo.close();
    }

    assert.throws(
      () => saveStudyReportToFile('# test', { fileName: '../escape.md' }),
      /path traversal/i,
    );
    assert.throws(
      () => saveStudyReportToFile('# test', { fileName: 'sub/nested.md' }),
      /path traversal/i,
    );

    const { client, close } = await createConnectedClient();
    try {
      const noSaveRes = await client.callTool({
        name: 'export_study_report',
        arguments: { saveToFile: false, limit: 5 },
      });
      const noSaveJson = JSON.parse(
        (getToolContent(noSaveRes)[0] as { type: 'text'; text: string }).text,
      ) as { markdown: string; savedPath: string | null };

      assert.equal(noSaveJson.savedPath, null);
      assert.match(noSaveJson.markdown, /# BotPrograCraft Study Report/);
      assert.match(noSaveJson.markdown, /Binary Search/);
      assert.match(noSaveJson.markdown, /ReferenceError: x is not defined/);

      const saveRes = await client.callTool({
        name: 'export_study_report',
        arguments: { saveToFile: true },
      });
      const saveJson = JSON.parse(
        (getToolContent(saveRes)[0] as { type: 'text'; text: string }).text,
      ) as { markdown: string; savedPath: string | null };

      assert.ok(saveJson.savedPath);
      const expectedReportsDir = path.resolve(tempHome, 'reports');
      assert.ok(saveJson.savedPath.startsWith(expectedReportsDir));
      assert.ok(fs.existsSync(saveJson.savedPath));
      assert.equal(fs.readFileSync(saveJson.savedPath, 'utf8'), saveJson.markdown);
    } finally {
      await close();
    }
  });
});
