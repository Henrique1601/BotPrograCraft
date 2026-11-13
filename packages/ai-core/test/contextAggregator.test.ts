import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IdeContextPayload, ScreenFrame } from '@botprogracraft/shared';
import { ContextAggregator } from '../src/contextAggregator';

describe('ContextAggregator', () => {
  it('formats empty state cleanly', () => {
    const aggregator = new ContextAggregator();
    const snapshot = aggregator.getSnapshot(1_700_000_000_000);

    assert.equal(snapshot.ideContext, null);
    assert.equal(snapshot.screenFrame, null);
    assert.equal(snapshot.screenFrameMetadata, null);
    assert.equal(snapshot.updatedAt, null);
    assert.match(snapshot.formattedText, /No active IDE context received yet/);
    assert.match(snapshot.formattedText, /No screen frame captured/);
  });

  it('combines IdeContextPayload and ScreenFrame metadata with sorted diagnostics', () => {
    const aggregator = new ContextAggregator({ maxDiagnostics: 2, maxVisibleChars: 120 });

    const idePayload: IdeContextPayload = {
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

    const frame: ScreenFrame = {
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

    assert.equal(snapshot.updatedAt, 1_700_000_001_500);
    assert.ok(snapshot.screenFrameMetadata);
    assert.equal(snapshot.screenFrameMetadata.width, 1920);
    assert.equal(snapshot.screenFrameMetadata.height, 1080);
    assert.equal(snapshot.screenFrameMetadata.approxBytes, 3);
    assert.equal(snapshot.screenFrameMetadata.ageMs, 500);

    assert.match(snapshot.formattedText, /Workspace: BotPrograCraft/);
    assert.match(snapshot.formattedText, /Active File: src\/solver\.ts/);
    assert.match(snapshot.formattedText, /Diagnostics \(3 total, showing 2\):/);
    assert.match(snapshot.formattedText, /ERROR L5:10 \[ts\] Maximum call stack risk \(2345\)/);
    assert.match(snapshot.formattedText, /WARNING L2:7 \[eslint\] Unused variable x/);
    assert.doesNotMatch(snapshot.formattedText, /Missing base case/);
    assert.match(snapshot.formattedText, /Selection \(L5-L5\)/);
    assert.match(snapshot.formattedText, /Resolution: 1920x1080/);
    assert.match(snapshot.formattedText, /Source: Primary Monitor/);
  });
});
