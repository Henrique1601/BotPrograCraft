import type { TutorMode } from './tutor';

/**
 * Captured screen frame sent to multimodal AI sessions.
 */
export interface ScreenFrame {
  mimeType: 'image/jpeg' | 'image/png';
  /** Base64-encoded image bytes (without a `data:...;base64,` prefix). */
  dataBase64: string;
  width: number;
  height: number;
  timestamp: number;
  sourceId?: string;
  sourceName?: string;
}

/**
 * Connection lifecycle states for the Gemini Live API session.
 */
export type LiveSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Configuration for initializing or updating a Gemini Live API session.
 */
export interface LiveSessionConfig {
  apiKey: string;
  model?: string;
  tutorMode: TutorMode;
  voiceName?: string;
  language?: string;
  systemInstruction?: string;
  includeScreenFrames?: boolean;
  unfiltered?: boolean;
  reconnectAttempts?: number;
  reconnectDelayMs?: number;
}
