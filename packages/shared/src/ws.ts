import type { IdeContextPayload } from './ide';
import type { LiveSessionStatus } from './live';
import type { TutorMode } from './tutor';

/**
 * Default localhost WebSocket port for the IDE <-> Desktop HUD bridge.
 */
export const DEFAULT_WS_PORT = 4848;

export interface WsIdeContextMessage {
  type: 'ide:context';
  payload: IdeContextPayload;
  timestamp: number;
}

export interface WsIdePingMessage {
  type: 'ide:ping';
  source: 'ide-extension' | 'desktop-app';
  timestamp: number;
}

export interface WsDesktopRequestContextMessage {
  type: 'desktop:request-context';
  reason?: string;
  timestamp: number;
}

export interface WsAiTranscriptMessage {
  type: 'ai:transcript';
  role: 'user' | 'assistant' | 'system';
  text: string;
  isFinal: boolean;
  tutorMode?: TutorMode;
  timestamp: number;
}

export interface WsAiStatusMessage {
  type: 'ai:status';
  status: LiveSessionStatus;
  tutorMode: TutorMode;
  message?: string;
  timestamp: number;
}

/**
 * Discriminated union of all messages exchanged over the local WebSocket bridge.
 */
export type WsMessage =
  | WsIdeContextMessage
  | WsIdePingMessage
  | WsDesktopRequestContextMessage
  | WsAiTranscriptMessage
  | WsAiStatusMessage;

export type WsMessageType = WsMessage['type'];

const WS_MESSAGE_TYPES: ReadonlySet<string> = new Set<WsMessageType>([
  'ide:context',
  'ide:ping',
  'desktop:request-context',
  'ai:transcript',
  'ai:status',
]);

/**
 * Lightweight runtime check that a parsed JSON value is a known WsMessage envelope.
 */
export function isWsMessage(value: unknown): value is WsMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    WS_MESSAGE_TYPES.has(candidate.type) &&
    typeof candidate.timestamp === 'number'
  );
}
