import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createBotPrograCraftMcpServer } from '../src/server';
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

  async function createConnectedClient(): Promise<{
    client: Client;
    close: () => Promise<void>;
  }> {
    const server = createBotPrograCraftMcpServer();
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

  it('exposes all 5 MCP tools', async () => {
    const { client, close } = await createConnectedClient();
    try {
      const result = await client.listTools();
      const names = result.tools.map((t) => t.name).sort();
      assert.deepEqual(names, [
        'get_learning_progress',
        'get_live_ide_context',
        'get_live_screen',
        'get_tutor_prompt',
        'record_exercise_attempt',
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
});
