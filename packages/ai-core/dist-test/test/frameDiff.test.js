"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const frameDiff_1 = require("../src/frameDiff");
function makeBase64(text) {
    return Buffer.from(text, 'utf8').toString('base64');
}
(0, node_test_1.describe)('frameDiff', () => {
    (0, node_test_1.describe)('computeFrameHash', () => {
        (0, node_test_1.it)('computes identical SHA-256 hashes with or without data URI prefix', () => {
            const b64 = makeBase64('frame-content-abc');
            const h1 = (0, frameDiff_1.computeFrameHash)(b64);
            const h2 = (0, frameDiff_1.computeFrameHash)(`data:image/jpeg;base64,${b64}`);
            strict_1.default.equal(h1, h2);
            strict_1.default.equal(h1.length, 64);
        });
    });
    (0, node_test_1.describe)('estimateByteDifferenceRatio', () => {
        (0, node_test_1.it)('returns 0 for identical frames and > 0 for different frames', () => {
            const a = makeBase64('aaaaaaaaaa');
            const b = makeBase64('aaaaabbbbb');
            strict_1.default.equal((0, frameDiff_1.estimateByteDifferenceRatio)(a, a), 0);
            const ratio = (0, frameDiff_1.estimateByteDifferenceRatio)(a, b);
            strict_1.default.ok(ratio > 0 && ratio <= 1);
        });
    });
    (0, node_test_1.describe)('hasSignificantFrameChange', () => {
        (0, node_test_1.it)('detects first-frame, identical, hash-changed, dimensions-changed, and below-threshold', () => {
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
            const first = (0, frameDiff_1.hasSignificantFrameChange)(null, frameA);
            strict_1.default.equal(first.changed, true);
            strict_1.default.equal(first.reason, 'first-frame');
            const same = (0, frameDiff_1.hasSignificantFrameChange)(frameA, frameSame);
            strict_1.default.equal(same.changed, false);
            strict_1.default.equal(same.reason, 'identical');
            const changedDefault = (0, frameDiff_1.hasSignificantFrameChange)(frameA, frameTinyDiff);
            strict_1.default.equal(changedDefault.changed, true);
            strict_1.default.equal(changedDefault.reason, 'hash-changed');
            const belowThreshold = (0, frameDiff_1.hasSignificantFrameChange)(frameA, frameTinyDiff, {
                minChangeRatio: 0.2,
            });
            strict_1.default.equal(belowThreshold.changed, false);
            strict_1.default.equal(belowThreshold.reason, 'below-threshold');
            const resized = (0, frameDiff_1.hasSignificantFrameChange)(frameA, frameResized, {
                minChangeRatio: 0.9,
            });
            strict_1.default.equal(resized.changed, true);
            strict_1.default.equal(resized.reason, 'dimensions-changed');
        });
    });
    (0, node_test_1.describe)('ScreenFrameGate', () => {
        (0, node_test_1.it)('allows first frame, skips identical frames, enforces minIntervalMs, and forces after forceAfterMs', () => {
            const gate = new frameDiff_1.ScreenFrameGate({
                minIntervalMs: 1000,
                forceAfterMs: 5000,
            });
            const frame1 = { dataBase64: makeBase64('screen-state-1'), width: 1280, height: 720 };
            const frame2 = { dataBase64: makeBase64('screen-state-2'), width: 1280, height: 720 };
            // 1. First frame always passes
            const d1 = gate.shouldSend(frame1, 1000);
            strict_1.default.equal(d1.shouldSend, true);
            strict_1.default.equal(d1.reason, 'first-frame');
            // 2. Different frame arriving before minIntervalMs is throttled
            const d2 = gate.shouldSend(frame2, 1500);
            strict_1.default.equal(d2.shouldSend, false);
            strict_1.default.equal(d2.reason, 'min-interval');
            // 3. Identical frame after minIntervalMs is skipped
            const d3 = gate.shouldSend(frame1, 2500);
            strict_1.default.equal(d3.shouldSend, false);
            strict_1.default.equal(d3.reason, 'identical');
            // 4. Different frame after minIntervalMs passes
            const d4 = gate.shouldSend(frame2, 3000);
            strict_1.default.equal(d4.shouldSend, true);
            strict_1.default.equal(d4.reason, 'hash-changed');
            // 5. Identical frame after forceAfterMs is forced through
            const d5 = gate.shouldSend(frame2, 8500);
            strict_1.default.equal(d5.shouldSend, true);
            strict_1.default.equal(d5.reason, 'force-after-interval');
            const stats = gate.getStats();
            strict_1.default.equal(stats.totalEvaluated, 5);
            strict_1.default.equal(stats.totalSent, 3);
            strict_1.default.equal(stats.totalSkipped, 2);
            strict_1.default.equal(stats.lastSentAt, 8500);
            gate.reset();
            strict_1.default.deepEqual(gate.getStats(), {
                totalEvaluated: 0,
                totalSent: 0,
                totalSkipped: 0,
                lastSentAt: null,
                lastHash: null,
            });
        });
        (0, node_test_1.it)('evaluate() does not mutate internal gate state', () => {
            const gate = new frameDiff_1.ScreenFrameGate({ minIntervalMs: 500, forceAfterMs: 10000 });
            const frame = { dataBase64: makeBase64('immutable-check') };
            const preview = gate.evaluate(frame, 1000);
            strict_1.default.equal(preview.shouldSend, true);
            strict_1.default.equal(preview.reason, 'first-frame');
            strict_1.default.equal(gate.getStats().totalEvaluated, 0);
            strict_1.default.equal(gate.getStats().lastSentAt, null);
        });
    });
});
//# sourceMappingURL=frameDiff.test.js.map