import type { IdeContextPayload, ScreenFrame } from '@botprogracraft/shared';
export interface ScreenFrameMetadata {
    mimeType: ScreenFrame['mimeType'];
    width: number;
    height: number;
    timestamp: number;
    sourceId?: string;
    sourceName?: string;
    approxBytes: number;
    ageMs: number;
}
export interface AggregatedContext {
    ideContext: IdeContextPayload | null;
    screenFrame: ScreenFrame | null;
    screenFrameMetadata: ScreenFrameMetadata | null;
    formattedText: string;
    updatedAt: number | null;
}
export interface ContextAggregatorOptions {
    maxVisibleChars?: number;
    maxSelectionChars?: number;
    maxDiagnostics?: number;
}
/**
 * Aggregates live IDE editor state and latest screen-capture frame metadata
 * into a structured snapshot and prompt-ready text summary.
 */
export declare class ContextAggregator {
    private ideContext;
    private screenFrame;
    private readonly maxVisibleChars;
    private readonly maxSelectionChars;
    private readonly maxDiagnostics;
    constructor(options?: ContextAggregatorOptions);
    updateIdeContext(payload: IdeContextPayload): void;
    updateScreenFrame(frame: ScreenFrame): void;
    clearIdeContext(): void;
    clearScreenFrame(): void;
    clearAll(): void;
    getIdeContext(): IdeContextPayload | null;
    getLatestScreenFrame(): ScreenFrame | null;
    getScreenFrameMetadata(now?: number): ScreenFrameMetadata | null;
    getSnapshot(now?: number): AggregatedContext;
    formatContext(now?: number): string;
}
//# sourceMappingURL=contextAggregator.d.ts.map