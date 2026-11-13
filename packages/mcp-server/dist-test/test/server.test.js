"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_test_1 = require("node:test");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const inMemory_js_1 = require("@modelcontextprotocol/sdk/inMemory.js");
const reportExporter_1 = require("../src/reportExporter");
const screenFallback_1 = require("../src/screenFallback");
const server_1 = require("../src/server");
const stateReader_1 = require("../src/stateReader");
function getToolContent(result) {
    assert.ok(typeof result === 'object' &&
        result !== null &&
        'content' in result &&
        Array.isArray(result.content), 'Expected tool result content to be an array');
    return result.content;
}
(0, node_test_1.describe)('@botprogracraft/mcp-server', () => {
    let tempHome;
    let previousHomeEnv;
    (0, node_test_1.beforeEach)(() => {
        previousHomeEnv = process.env.BOTPROGRACRAFT_HOME;
        tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'botprogracraft-mcp-test-'));
        process.env.BOTPROGRACRAFT_HOME = tempHome;
    });
    (0, node_test_1.afterEach)(() => {
        if (previousHomeEnv === undefined) {
            delete process.env.BOTPROGRACRAFT_HOME;
        }
        else {
            process.env.BOTPROGRACRAFT_HOME = previousHomeEnv;
        }
        fs.rmSync(tempHome, { recursive: true, force: true });
    });
    async function createConnectedClient(options = {}) {
        const server = (0, server_1.createBotPrograCraftMcpServer)({
            captureScreenFallback: async () => null,
            ...options,
        });
        const client = new index_js_1.Client({ name: 'test-client', version: '1.0.0' });
        const [clientTransport, serverTransport] = inMemory_js_1.InMemoryTransport.createLinkedPair();
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        return {
            client,
            close: async () => {
                await client.close();
                await server.close();
            },
        };
    }
    (0, node_test_1.it)('resolves BOTPROGRACRAFT_HOME and returns null when state files are absent', () => {
        assert.equal((0, stateReader_1.getBotPrograCraftHome)(), path.resolve(tempHome));
        assert.equal((0, stateReader_1.readLiveState)(), null);
        assert.equal((0, stateReader_1.readLatestFrame)(), null);
    });
    (0, node_test_1.it)('exposes all 7 MCP tools', async () => {
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
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('get_live_ide_context reads live-state.json and handles missing state', async () => {
        const { client, close } = await createConnectedClient();
        try {
            const missingRes = await client.callTool({ name: 'get_live_ide_context', arguments: {} });
            const missingText = getToolContent(missingRes)[0].text;
            const missingJson = JSON.parse(missingText);
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
            fs.writeFileSync(path.join(tempHome, 'live-state.json'), JSON.stringify(liveState, null, 2), 'utf8');
            const res = await client.callTool({ name: 'get_live_ide_context', arguments: {} });
            const text = getToolContent(res)[0].text;
            const parsed = JSON.parse(text);
            assert.equal(parsed.available, true);
            assert.equal(parsed.tutorMode, 'pair-programming');
            assert.equal(parsed.ideContext.activeFile, 'src/app.ts');
            assert.equal(parsed.ideContext.languageId, 'typescript');
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('get_live_screen returns base64 JPEG image block and metadata', async () => {
        const { client, close } = await createConnectedClient();
        try {
            const missingRes = await client.callTool({ name: 'get_live_screen', arguments: {} });
            const missingJson = JSON.parse(getToolContent(missingRes)[0].text);
            assert.equal(missingJson.available, false);
            const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
            fs.writeFileSync(path.join(tempHome, 'latest-frame.jpg'), fakeJpeg);
            fs.writeFileSync(path.join(tempHome, 'latest-frame.meta.json'), JSON.stringify({ width: 1280, height: 720, timestamp: 1700000001234 }), 'utf8');
            const res = await client.callTool({ name: 'get_live_screen', arguments: {} });
            const blocks = getToolContent(res);
            assert.equal(blocks.length, 2);
            const imageBlock = blocks[0];
            assert.equal(imageBlock.type, 'image');
            assert.equal(imageBlock.mimeType, 'image/jpeg');
            assert.equal(imageBlock.data, fakeJpeg.toString('base64'));
            const metaBlock = JSON.parse(blocks[1].text);
            assert.equal(metaBlock.available, true);
            assert.equal(metaBlock.width, 1280);
            assert.equal(metaBlock.height, 720);
            assert.equal(metaBlock.timestamp, 1700000001234);
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('get_tutor_prompt builds system prompt for the requested TutorMode', async () => {
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
            const text = getToolContent(res)[0].text;
            assert.match(text, /Mode: Socratic Tutor/);
            assert.match(text, /Master binary search/);
            assert.match(text, /Respond primarily in English/);
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('record_exercise_attempt and get_learning_progress persist and query SQLite', async () => {
        const repo = (0, stateReader_1.openProgressRepository)();
        try {
            repo.recordRecurringError({
                errorSignature: 'TS2322: Type string is not assignable to type number',
                languageId: 'typescript',
                filePath: 'src/math.ts',
            });
        }
        finally {
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
                const created = JSON.parse(getToolContent(res)[0].text);
                assert.equal(created.title, `Exercise ${i}`);
            }
            const progressRes = await client.callTool({
                name: 'get_learning_progress',
                arguments: {},
            });
            const progress = JSON.parse(getToolContent(progressRes)[0].text);
            assert.equal(progress.stats.totalAttempts, 6);
            assert.equal(progress.stats.passedAttempts, 3);
            assert.equal(progress.stats.totalRecurringErrors, 1);
            assert.equal(progress.recentAttempts.length, 5);
            assert.equal(progress.recentAttempts[0].title, 'Exercise 6');
            assert.equal(progress.topRecurringErrors.length, 1);
            assert.equal(progress.topRecurringErrors[0].errorSignature, 'TS2322: Type string is not assignable to type number');
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('get_live_screen falls back to captureWindowsScreenJpeg when missing or captureNow=true', async () => {
        const fallbackJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9]);
        let captureCalls = 0;
        const { client, close } = await createConnectedClient({
            captureScreenFallback: async (homeDir) => {
                captureCalls += 1;
                return (0, screenFallback_1.captureWindowsScreenJpeg)({
                    homeDir,
                    execCapture: async (jpgPath, metaPath) => {
                        fs.writeFileSync(jpgPath, fallbackJpeg);
                        fs.writeFileSync(metaPath, JSON.stringify({ width: 1920, height: 1080, timestamp: 1700000099999 }), 'utf8');
                    },
                });
            },
        });
        try {
            const firstRes = await client.callTool({ name: 'get_live_screen', arguments: {} });
            const firstBlocks = getToolContent(firstRes);
            assert.equal(captureCalls, 1);
            assert.equal(firstBlocks[0].type, 'image');
            assert.equal(firstBlocks[0].data, fallbackJpeg.toString('base64'));
            const firstMeta = JSON.parse(firstBlocks[1].text);
            assert.equal(firstMeta.available, true);
            assert.equal(firstMeta.width, 1920);
            assert.equal(firstMeta.height, 1080);
            assert.equal(firstMeta.capturedOnDemand, true);
            // Cached frame should be used without calling fallback again when captureNow is omitted
            const cachedRes = await client.callTool({ name: 'get_live_screen', arguments: {} });
            const cachedMeta = JSON.parse(getToolContent(cachedRes)[1].text);
            assert.equal(captureCalls, 1);
            assert.equal(cachedMeta.capturedOnDemand, false);
            // captureNow=true forces a fresh fallback capture
            const forcedRes = await client.callTool({
                name: 'get_live_screen',
                arguments: { captureNow: true },
            });
            const forcedMeta = JSON.parse(getToolContent(forcedRes)[1].text);
            assert.equal(captureCalls, 2);
            assert.equal(forcedMeta.capturedOnDemand, true);
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('run_exercise_check executes test cases and optionally records the attempt', async () => {
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
            const parsed = JSON.parse(getToolContent(res)[0].text);
            assert.equal(parsed.passed, true);
            assert.equal(parsed.passedCount, 2);
            assert.equal(parsed.totalCount, 2);
            assert.ok(parsed.recordedAttempt);
            assert.equal(parsed.recordedAttempt.title, 'Sum Two Numbers');
            assert.equal(parsed.recordedAttempt.passed, true);
            assert.equal(parsed.recordedAttempt.score, 100);
        }
        finally {
            await close();
        }
    });
    (0, node_test_1.it)('export_study_report formats Obsidian Markdown, saves safely, and blocks path traversal', async () => {
        const repo = (0, stateReader_1.openProgressRepository)();
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
        }
        finally {
            repo.close();
        }
        assert.throws(() => (0, reportExporter_1.saveStudyReportToFile)('# test', { fileName: '../escape.md' }), /path traversal/i);
        assert.throws(() => (0, reportExporter_1.saveStudyReportToFile)('# test', { fileName: 'sub/nested.md' }), /path traversal/i);
        const { client, close } = await createConnectedClient();
        try {
            const noSaveRes = await client.callTool({
                name: 'export_study_report',
                arguments: { saveToFile: false, limit: 5 },
            });
            const noSaveJson = JSON.parse(getToolContent(noSaveRes)[0].text);
            assert.equal(noSaveJson.savedPath, null);
            assert.match(noSaveJson.markdown, /# BotPrograCraft Study Report/);
            assert.match(noSaveJson.markdown, /Binary Search/);
            assert.match(noSaveJson.markdown, /ReferenceError: x is not defined/);
            const saveRes = await client.callTool({
                name: 'export_study_report',
                arguments: { saveToFile: true },
            });
            const saveJson = JSON.parse(getToolContent(saveRes)[0].text);
            assert.ok(saveJson.savedPath);
            const expectedReportsDir = path.resolve(tempHome, 'reports');
            assert.ok(saveJson.savedPath.startsWith(expectedReportsDir));
            assert.ok(fs.existsSync(saveJson.savedPath));
            assert.equal(fs.readFileSync(saveJson.savedPath, 'utf8'), saveJson.markdown);
        }
        finally {
            await close();
        }
    });
});
//# sourceMappingURL=server.test.js.map