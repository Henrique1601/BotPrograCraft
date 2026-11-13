import { GoogleGenAI, type SafetySetting } from '@google/genai';
import type { IdeContextPayload, LiveSessionConfig, LiveSessionStatus, ScreenFrame, TutorMode } from '@botprogracraft/shared';
import { ContextAggregator } from './contextAggregator';
export declare const DEFAULT_GEMINI_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
export declare const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
export interface TranscriptEvent {
    role: 'user' | 'assistant';
    text: string;
    isFinal: boolean;
    timestamp: number;
}
export interface AudioOutputEvent {
    dataBase64: string;
    mimeType: string;
    sampleRate: number;
    timestamp: number;
}
export interface LiveSessionEvents {
    onStatusChange?: (status: LiveSessionStatus, detail?: string) => void;
    onTranscript?: (event: TranscriptEvent) => void;
    onAudioOutput?: (event: AudioOutputEvent) => void;
    onTurnComplete?: () => void;
    onInterrupted?: () => void;
    onError?: (error: Error) => void;
}
export interface GeminiLiveSessionOptions {
    config: LiveSessionConfig;
    contextAggregator?: ContextAggregator;
    events?: LiveSessionEvents;
    createClient?: (apiKey: string) => Pick<GoogleGenAI, 'live'>;
}
/**
 * Extracts the PCM sample rate from a mimeType such as `audio/pcm;rate=24000`.
 */
export declare function parseAudioSampleRate(mimeType: string, fallback?: number): number;
/**
 * Builds permissive SafetySetting entries supported by Gemini LiveConnectConfig.
 */
export declare function buildPermissiveSafetySettings(): SafetySetting[];
/**
 * Manages a Gemini Live API multimodal session (audio chunks, JPEG/PNG screen frames,
 * text turns, IDE context injection, and reconnect/error states).
 */
export declare class GeminiLiveSessionManager {
    private config;
    private readonly contextAggregator;
    private readonly events;
    private readonly createClient;
    private session;
    private status;
    private manualDisconnect;
    private reconnectTimer;
    private reconnectAttempt;
    constructor(options: GeminiLiveSessionOptions);
    getStatus(): LiveSessionStatus;
    getConfig(): Readonly<LiveSessionConfig>;
    getContextAggregator(): ContextAggregator;
    updateIdeContext(payload: IdeContextPayload): void;
    updateTutorMode(mode: TutorMode, unfiltered?: boolean): void;
    connect(): Promise<void>;
    disconnect(): void;
    sendAudioChunk(dataBase64: string, mimeType?: string): void;
    endAudioStream(): void;
    sendScreenFrame(frame: ScreenFrame): void;
    sendTextTurn(text: string, includeContext?: boolean): void;
    private resolveSystemInstruction;
    private requireConnectedSession;
    private setStatus;
    private scheduleReconnect;
    private clearReconnectTimer;
    private handleServerMessage;
}
//# sourceMappingURL=liveSession.d.ts.map