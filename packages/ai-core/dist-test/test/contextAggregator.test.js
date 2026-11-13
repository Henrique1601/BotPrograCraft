"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const contextAggregator_1 = require("../src/contextAggregator");
(0, node_test_1.describe)('ContextAggregator', () => {
    (0, node_test_1.it)('formats empty state cleanly', () => {
        const aggregator = new contextAggregator_1.ContextAggregator();
        const snapshot = aggregator.getSnapshot(1_700_000_000_000);
        strict_1.default.equal(snapshot.ideContext, null);
        strict_1.default.equal(snapshot.screenFrame, null);
        strict_1.default.equal(snapshot.screenFrameMetadata, null);
        strict_1.default.equal(snapshot.updatedAt, null);
        strict_1.default.match(snapshot.formattedText, /No active IDE context received yet/);
        strict_1.default.match(snapshot.formattedText, /No screen frame captured/);
    });
    (0, node_test_1.it)('combines IdeContextPayload and ScreenFrame metadata with sorted diagnostics', () => {
        const aggregator = new contextAggregator_1.ContextAggregator({ maxDiagnostics: 2, maxVisibleChars: 120 });
        const idePayload = {
            workspaceName: 'BotPrograCraft',
            activeFile: 'src/solver.ts',
            languageId: 'typescript',
            selection: {
                text: 'return n * factorial(n - 1);',
                isEmpty: false,
                range: {
                    start: { line: 4, character: 2 },
                    end: { line: 4, character: 30 },
                },
            },
            visibleRangeText: 'function factorial(n: number): number {\n  return n * factorial(n - 1);\n}',
            diagnostics: [
                { message: 'Unused variable x', severity: 'warning', line: 1, character: 6, source: 'eslint' },
                { message: 'Missing base case', severity: 'info', line: 0 },
                { message: 'Maximum call stack risk', severity: 'error', line: 4, character: 9, source: 'ts', code: 2345 },
            ],
            timestamp: 1_700_000_000_000,
        };
        const frame = {
            mimeType: 'image/jpeg',
            dataBase64: 'AAAA',
            width: 1920,
            height: 1080,
            timestamp: 1_700_000_001_500,
            sourceName: 'Primary Monitor',
        };
        aggregator.updateIdeContext(idePayload);
        aggregator.updateScreenFrame(frame);
        const snapshot = aggregator.getSnapshot(1_700_000_002_000);
        strict_1.default.equal(snapshot.updatedAt, 1_700_000_001_500);
        strict_1.default.ok(snapshot.screenFrameMetadata);
        strict_1.default.equal(snapshot.screenFrameMetadata.width, 1920);
        strict_1.default.equal(snapshot.screenFrameMetadata.height, 1080);
        strict_1.default.equal(snapshot.screenFrameMetadata.approxBytes, 3);
        strict_1.default.equal(snapshot.screenFrameMetadata.ageMs, 500);
        strict_1.default.match(snapshot.formattedText, /Workspace: BotPrograCraft/);
        strict_1.default.match(snapshot.formattedText, /Active File: src\/solver\.ts/);
        strict_1.default.match(snapshot.formattedText, /Diagnostics \(3 total, showing 2\):/);
        strict_1.default.match(snapshot.formattedText, /ERROR L5:10 \[ts\] Maximum call stack risk \(2345\)/);
        strict_1.default.match(snapshot.formattedText, /WARNING L2:7 \[eslint\] Unused variable x/);
        strict_1.default.doesNotMatch(snapshot.formattedText, /Missing base case/);
        strict_1.default.match(snapshot.formattedText, /Selection \(L5-L5\)/);
        strict_1.default.match(snapshot.formattedText, /Resolution: 1920x1080/);
        strict_1.default.match(snapshot.formattedText, /Source: Primary Monitor/);
    });
});
//# sourceMappingURL=contextAggregator.test.js.map