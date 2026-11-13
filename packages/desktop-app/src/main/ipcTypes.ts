import type {
  IdeContextPayload,
  LiveSessionStatus,
  ScreenFrame,
  TutorMode,
} from '@botprogracraft/shared';
import type {
  ChallengeDifficulty,
  ExerciseFeedback,
  LogicChallenge,
} from '@botprogracraft/ai-core';
import type { CaptureSourceSummary } from './screenCapture';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface ScreenFramePreview {
  dataUrl: string;
  sent: boolean;
  reason: string;
  timestamp: number;
}

export interface DesktopStateSnapshot {
  ideConnected: boolean;
  ideContext: IdeContextPayload | null;
  liveStatus: LiveSessionStatus;
  tutorMode: TutorMode;
  screenShareEnabled: boolean;
  latestFrame: ScreenFrame | null;
  apiKeyConfigured: boolean;
  selectedCaptureSourceId: string | null;
}

export interface ProgressStatsSummary {
  totalAttempts: number;
  passedAttempts: number;
  totalMessages: number;
  recurringErrorCount: number;
}

export interface RecentAttemptSummary {
  id: number;
  title: string;
  mode: string;
  passed: boolean;
  score: number | null;
  createdAt: string;
}

export interface RecurringErrorSummary {
  id: number;
  errorSignature: string;
  languageId: string;
  filePath: string;
  occurrenceCount: number;
  lastSeenAt: string;
}

export interface DesktopBridgeApi {
  getInitialState: () => Promise<DesktopStateSnapshot>;
  captureScreenFrame: () => Promise<ScreenFrame | null>;
  listCaptureSources: () => Promise<CaptureSourceSummary[]>;
  setCaptureSource: (sourceId: string | null) => Promise<void>;
  setScreenShareEnabled: (enabled: boolean) => Promise<void>;
  setTutorMode: (mode: TutorMode) => Promise<void>;
  startLiveSession: () => Promise<void>;
  stopLiveSession: () => Promise<void>;
  sendTextTurn: (text: string) => Promise<void>;
  sendAudioChunk: (base64Pcm16: string, sampleRate: number) => void;
  requestIdeContext: () => Promise<void>;
  toggleMinimize: () => Promise<void>;
  getProgressStats: () => Promise<ProgressStatsSummary>;
  listRecentAttempts: (limit?: number) => Promise<RecentAttemptSummary[]>;
  listRecurringErrors: (limit?: number) => Promise<RecurringErrorSummary[]>;
  generateLogicChallenge: (
    difficulty: ChallengeDifficulty,
    topic?: string,
  ) => Promise<LogicChallenge>;
  evaluateSolution: (
    challenge: LogicChallenge,
    userCode: string,
  ) => Promise<ExerciseFeedback>;
  onIdeConnection: (cb: (connected: boolean) => void) => () => void;
  onIdeContext: (cb: (context: IdeContextPayload) => void) => () => void;
  onLiveStatus: (cb: (status: LiveSessionStatus, message?: string) => void) => () => void;
  onTranscript: (cb: (entry: TranscriptEntry) => void) => () => void;
  onAudioOutput: (cb: (dataBase64: string, mimeType: string, sampleRate: number) => void) => () => void;
  onInterrupted: (cb: () => void) => () => void;
  onTurnComplete: (cb: () => void) => () => void;
  onScreenFrame: (cb: (frame: ScreenFrame) => void) => () => void;
  onScreenFramePreview: (cb: (preview: ScreenFramePreview) => void) => () => void;
  onPushToTalkShortcut: (cb: () => void) => () => void;
  onPushToTalkToggle: (cb: () => void) => () => void;
}
