"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenFrameGate = void 0;
exports.computeFrameHash = computeFrameHash;
exports.estimateByteDifferenceRatio = estimateByteDifferenceRatio;
exports.hasSignificantFrameChange = hasSignificantFrameChange;
const node_crypto_1 = require("node:crypto");
const DEFAULT_MIN_INTERVAL_MS = 1000;
const DEFAULT_FORCE_AFTER_MS = 15_000;
const MAX_SAMPLE_BYTES = 16_384;
function stripDataUriPrefix(dataBase64) {
    const commaIdx = dataBase64.indexOf(',');
    if (dataBase64.startsWith('data:') && commaIdx !== -1) {
        return dataBase64.slice(commaIdx + 1).trim();
    }
    return dataBase64.trim();
}
/**
 * Computes a deterministic SHA-256 hex digest for a base64-encoded frame payload.
 */
function computeFrameHash(dataBase64) {
    const normalized = stripDataUriPrefix(dataBase64);
    return (0, node_crypto_1.createHash)('sha256').update(normalized, 'utf8').digest('hex');
}
/**
 * Estimates the normalized byte difference ratio in [0, 1] between two base64 payloads.
 * Uses uniform stride sampling for large buffers to keep evaluation fast.
 */
function estimateByteDifferenceRatio(prevBase64, nextBase64) {
    const prevNorm = stripDataUriPrefix(prevBase64);
    const nextNorm = stripDataUriPrefix(nextBase64);
    if (prevNorm === nextNorm) {
        return 0;
    }
    const prevBuf = Buffer.from(prevNorm, 'base64');
    const nextBuf = Buffer.from(nextNorm, 'base64');
    const maxLen = Math.max(prevBuf.length, nextBuf.length);
    if (maxLen === 0) {
        return 0;
    }
    const minLen = Math.min(prevBuf.length, nextBuf.length);
    const stride = maxLen > MAX_SAMPLE_BYTES ? Math.ceil(maxLen / MAX_SAMPLE_BYTES) : 1;
    let sampled = 0;
    let different = 0;
    for (let i = 0; i < minLen; i += stride) {
        sampled += 1;
        if (prevBuf[i] !== nextBuf[i]) {
            different += 1;
        }
    }
    const lengthDiffSamples = Math.ceil((maxLen - minLen) / stride);
    sampled += lengthDiffSamples;
    different += lengthDiffSamples;
    if (sampled === 0) {
        return 0;
    }
    return Math.min(1, different / sampled);
}
/**
 * Compares two frames using SHA-256 hashing, optional dimensions, and byte-level sampling.
 */
function hasSignificantFrameChange(prevFrame, nextFrame, options = {}) {
    const minChangeRatio = Math.max(0, Math.min(1, options.minChangeRatio ?? 0));
    const nextHash = computeFrameHash(nextFrame.dataBase64);
    if (!prevFrame) {
        return {
            changed: true,
            reason: 'first-frame',
            diffRatio: 1,
            prevHash: null,
            nextHash,
        };
    }
    const prevHash = computeFrameHash(prevFrame.dataBase64);
    if (prevHash === nextHash) {
        return {
            changed: false,
            reason: 'identical',
            diffRatio: 0,
            prevHash,
            nextHash,
        };
    }
    const dimensionsChanged = prevFrame.width !== undefined &&
        nextFrame.width !== undefined &&
        prevFrame.height !== undefined &&
        nextFrame.height !== undefined &&
        (prevFrame.width !== nextFrame.width || prevFrame.height !== nextFrame.height);
    const diffRatio = estimateByteDifferenceRatio(prevFrame.dataBase64, nextFrame.dataBase64);
    if (dimensionsChanged) {
        return {
            changed: true,
            reason: 'dimensions-changed',
            diffRatio,
            prevHash,
            nextHash,
        };
    }
    if (minChangeRatio > 0 && diffRatio < minChangeRatio) {
        return {
            changed: false,
            reason: 'below-threshold',
            diffRatio,
            prevHash,
            nextHash,
        };
    }
    return {
        changed: true,
        reason: 'hash-changed',
        diffRatio,
        prevHash,
        nextHash,
    };
}
/**
 * Stateful gate that deduplicates identical screen frames and enforces
 * `minIntervalMs` throttling and `forceAfterMs` periodic refresh to save tokens and latency.
 */
class ScreenFrameGate {
    minIntervalMs;
    forceAfterMs;
    minChangeRatio;
    lastFrame = null;
    lastHash = null;
    lastSentAt = null;
    totalEvaluated = 0;
    totalSent = 0;
    totalSkipped = 0;
    constructor(options = {}) {
        this.minIntervalMs = Math.max(0, options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS);
        this.forceAfterMs =
            options.forceAfterMs === undefined ? DEFAULT_FORCE_AFTER_MS : options.forceAfterMs;
        this.minChangeRatio = Math.max(0, Math.min(1, options.minChangeRatio ?? 0));
    }
    /**
     * Evaluates whether a frame should be sent without mutating gate state.
     */
    evaluate(frame, nowMs = frame.timestamp ?? Date.now()) {
        const nextHash = computeFrameHash(frame.dataBase64);
        if (!this.lastFrame || this.lastSentAt === null || this.lastHash === null) {
            return {
                shouldSend: true,
                reason: 'first-frame',
                diffRatio: 1,
                frameHash: nextHash,
                elapsedMs: null,
            };
        }
        const elapsedMs = Math.max(0, nowMs - this.lastSentAt);
        if (this.forceAfterMs > 0 &&
            Number.isFinite(this.forceAfterMs) &&
            elapsedMs >= this.forceAfterMs) {
            const diffRatio = this.lastHash === nextHash
                ? 0
                : estimateByteDifferenceRatio(this.lastFrame.dataBase64, frame.dataBase64);
            return {
                shouldSend: true,
                reason: 'force-after-interval',
                diffRatio,
                frameHash: nextHash,
                elapsedMs,
            };
        }
        if (elapsedMs < this.minIntervalMs) {
            const diffRatio = this.lastHash === nextHash
                ? 0
                : estimateByteDifferenceRatio(this.lastFrame.dataBase64, frame.dataBase64);
            return {
                shouldSend: false,
                reason: 'min-interval',
                diffRatio,
                frameHash: nextHash,
                elapsedMs,
            };
        }
        const change = hasSignificantFrameChange(this.lastFrame, frame, {
            minChangeRatio: this.minChangeRatio,
        });
        return {
            shouldSend: change.changed,
            reason: change.reason,
            diffRatio: change.diffRatio,
            frameHash: change.nextHash,
            elapsedMs,
        };
    }
    /**
     * Evaluates the frame and updates internal state/stats.
     * When `decision.shouldSend` is true, records this frame as the latest sent frame.
     */
    shouldSend(frame, nowMs = frame.timestamp ?? Date.now()) {
        const decision = this.evaluate(frame, nowMs);
        this.totalEvaluated += 1;
        if (decision.shouldSend) {
            this.totalSent += 1;
            this.lastFrame = frame;
            this.lastHash = decision.frameHash;
            this.lastSentAt = nowMs;
        }
        else {
            this.totalSkipped += 1;
        }
        return decision;
    }
    /**
     * Resets tracked frame history and counters.
     */
    reset() {
        this.lastFrame = null;
        this.lastHash = null;
        this.lastSentAt = null;
        this.totalEvaluated = 0;
        this.totalSent = 0;
        this.totalSkipped = 0;
    }
    /**
     * Returns current gate metrics for token/latency observability.
     */
    getStats() {
        return {
            totalEvaluated: this.totalEvaluated,
            totalSent: this.totalSent,
            totalSkipped: this.totalSkipped,
            lastSentAt: this.lastSentAt,
            lastHash: this.lastHash,
        };
    }
}
exports.ScreenFrameGate = ScreenFrameGate;
//# sourceMappingURL=frameDiff.js.map