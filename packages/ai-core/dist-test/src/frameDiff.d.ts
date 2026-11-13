import type { ScreenFrame } from '@botprogracraft/shared';
export type FrameLike = Pick<ScreenFrame, 'dataBase64'> & Partial<Pick<ScreenFrame, 'mimeType' | 'width' | 'height' | 'timestamp'>>;
export type FrameChangeReason = 'first-frame' | 'dimensions-changed' | 'hash-changed' | 'identical' | 'below-threshold';
export type FrameGateDecisionReason = FrameChangeReason | 'min-interval' | 'force-after-interval';
export interface FrameDiffOptions {
    /**
     * Minimum byte-level difference ratio in [0, 1] required to treat
     * two frames with different hashes as significantly changed.
     * Defaults to 0 (any hash difference is treated as a change).
     */
    minChangeRatio?: number;
}
export interface FrameChangeResult {
    changed: boolean;
    reason: FrameChangeReason;
    diffRatio: number;
    prevHash: string | null;
    nextHash: string;
}
export interface ScreenFrameGateOptions extends FrameDiffOptions {
    /**
     * Minimum time in milliseconds between consecutive sent frames.
     * Frames arriving sooner than this interval are skipped (unless `forceAfterMs` triggers).
     * Defaults to 1000 ms.
     */
    minIntervalMs?: number;
    /**
     * Maximum time in milliseconds before a frame is forced through even if identical.
     * Set to `Infinity` or `0` to disable forced periodic sends.
     * Defaults to 15000 ms.
     */
    forceAfterMs?: number;
}
export interface FrameGateDecision {
    shouldSend: boolean;
    reason: FrameGateDecisionReason;
    diffRatio: number;
    frameHash: string;
    elapsedMs: number | null;
}
export interface FrameGateStats {
    totalEvaluated: number;
    totalSent: number;
    totalSkipped: number;
    lastSentAt: number | null;
    lastHash: string | null;
}
/**
 * Computes a deterministic SHA-256 hex digest for a base64-encoded frame payload.
 */
export declare function computeFrameHash(dataBase64: string): string;
/**
 * Estimates the normalized byte difference ratio in [0, 1] between two base64 payloads.
 * Uses uniform stride sampling for large buffers to keep evaluation fast.
 */
export declare function estimateByteDifferenceRatio(prevBase64: string, nextBase64: string): number;
/**
 * Compares two frames using SHA-256 hashing, optional dimensions, and byte-level sampling.
 */
export declare function hasSignificantFrameChange(prevFrame: FrameLike | null, nextFrame: FrameLike, options?: FrameDiffOptions): FrameChangeResult;
/**
 * Stateful gate that deduplicates identical screen frames and enforces
 * `minIntervalMs` throttling and `forceAfterMs` periodic refresh to save tokens and latency.
 */
export declare class ScreenFrameGate {
    private readonly minIntervalMs;
    private readonly forceAfterMs;
    private readonly minChangeRatio;
    private lastFrame;
    private lastHash;
    private lastSentAt;
    private totalEvaluated;
    private totalSent;
    private totalSkipped;
    constructor(options?: ScreenFrameGateOptions);
    /**
     * Evaluates whether a frame should be sent without mutating gate state.
     */
    evaluate(frame: FrameLike, nowMs?: number): FrameGateDecision;
    /**
     * Evaluates the frame and updates internal state/stats.
     * When `decision.shouldSend` is true, records this frame as the latest sent frame.
     */
    shouldSend(frame: FrameLike, nowMs?: number): FrameGateDecision;
    /**
     * Resets tracked frame history and counters.
     */
    reset(): void;
    /**
     * Returns current gate metrics for token/latency observability.
     */
    getStats(): FrameGateStats;
}
//# sourceMappingURL=frameDiff.d.ts.map