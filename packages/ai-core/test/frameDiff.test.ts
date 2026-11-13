import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ScreenFrameGate,
  computeFrameHash,
  estimateByteDifferenceRatio,
  hasSignificantFrameChange,
} from '../src/frameDiff';

function makeBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

describe('frameDiff', () => {
  describe('computeFrameHash', () => {
    it('computes identical SHA-256 hashes with or without data URI prefix', () => {
      const b64 = makeBase64('frame-content-abc');
      const h1 = computeFrameHash(b64);
      const h2 = computeFrameHash(`data:image/jpeg;base64,${b64}`);
      assert.equal(h1, h2);
      assert.equal(h1.length, 64);
    });
  });

  describe('estimateByteDifferenceRatio', () => {
    it('returns 0 for identical frames and > 0 for different frames', () => {
      const a = makeBase64('aaaaaaaaaa');
      const b = makeBase64('aaaaabbbbb');
      assert.equal(estimateByteDifferenceRatio(a, a), 0);
      const ratio = estimateByteDifferenceRatio(a, b);
      assert.ok(ratio > 0 && ratio <= 1);
    });
  });

  describe('hasSignificantFrameChange', () => {
    it('detects first-frame, identical, hash-changed, dimensions-changed, and below-threshold', () => {
      const frameA = { dataBase64: makeBase64('0123456789'.repeat(10)), width: 1280, height: 720 };
      const frameSame = { dataBase64: makeBase64('0123456789'.repeat(10)), width: 1280, height: 720 };
      const frameTinyDiff = {
        dataBase64: makeBase64(`X${'0123456789'.repeat(10).slice(1)}`),
        width: 1280,
        height: 720,
      };
      const frameResized = {
        dataBase64: makeBase64('0123456789'.repeat(10).replace('0', '9')),
        width: 1920,
        height: 1080,
      };

      const first = hasSignificantFrameChange(null, frameA);
      assert.equal(first.changed, true);
      assert.equal(first.reason, 'first-frame');

      const same = hasSignificantFrameChange(frameA, frameSame);
      assert.equal(same.changed, false);
      assert.equal(same.reason, 'identical');

      const changedDefault = hasSignificantFrameChange(frameA, frameTinyDiff);
      assert.equal(changedDefault.changed, true);
      assert.equal(changedDefault.reason, 'hash-changed');

      const belowThreshold = hasSignificantFrameChange(frameA, frameTinyDiff, {
        minChangeRatio: 0.2,
      });
      assert.equal(belowThreshold.changed, false);
      assert.equal(belowThreshold.reason, 'below-threshold');

      const resized = hasSignificantFrameChange(frameA, frameResized, {
        minChangeRatio: 0.9,
      });
      assert.equal(resized.changed, true);
      assert.equal(resized.reason, 'dimensions-changed');
    });
  });

  describe('ScreenFrameGate', () => {
    it('allows first frame, skips identical frames, enforces minIntervalMs, and forces after forceAfterMs', () => {
      const gate = new ScreenFrameGate({
        minIntervalMs: 1000,
        forceAfterMs: 5000,
      });

      const frame1 = { dataBase64: makeBase64('screen-state-1'), width: 1280, height: 720 };
      const frame2 = { dataBase64: makeBase64('screen-state-2'), width: 1280, height: 720 };

      // 1. First frame always passes
      const d1 = gate.shouldSend(frame1, 1000);
      assert.equal(d1.shouldSend, true);
      assert.equal(d1.reason, 'first-frame');

      // 2. Different frame arriving before minIntervalMs is throttled
      const d2 = gate.shouldSend(frame2, 1500);
      assert.equal(d2.shouldSend, false);
      assert.equal(d2.reason, 'min-interval');

      // 3. Identical frame after minIntervalMs is skipped
      const d3 = gate.shouldSend(frame1, 2500);
      assert.equal(d3.shouldSend, false);
      assert.equal(d3.reason, 'identical');

      // 4. Different frame after minIntervalMs passes
      const d4 = gate.shouldSend(frame2, 3000);
      assert.equal(d4.shouldSend, true);
      assert.equal(d4.reason, 'hash-changed');

      // 5. Identical frame after forceAfterMs is forced through
      const d5 = gate.shouldSend(frame2, 8500);
      assert.equal(d5.shouldSend, true);
      assert.equal(d5.reason, 'force-after-interval');

      const stats = gate.getStats();
      assert.equal(stats.totalEvaluated, 5);
      assert.equal(stats.totalSent, 3);
      assert.equal(stats.totalSkipped, 2);
      assert.equal(stats.lastSentAt, 8500);

      gate.reset();
      assert.deepEqual(gate.getStats(), {
        totalEvaluated: 0,
        totalSent: 0,
        totalSkipped: 0,
        lastSentAt: null,
        lastHash: null,
      });
    });

    it('evaluate() does not mutate internal gate state', () => {
      const gate = new ScreenFrameGate({ minIntervalMs: 500, forceAfterMs: 10000 });
      const frame = { dataBase64: makeBase64('immutable-check') };

      const preview = gate.evaluate(frame, 1000);
      assert.equal(preview.shouldSend, true);
      assert.equal(preview.reason, 'first-frame');
      assert.equal(gate.getStats().totalEvaluated, 0);
      assert.equal(gate.getStats().lastSentAt, null);
    });
  });
});
