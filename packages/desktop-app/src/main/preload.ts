import { contextBridge, ipcRenderer } from 'electron';
import type {
  AiProviderType,
  IdeContextPayload,
  LiveSessionStatus,
  ScreenFrame,
  TutorMode,
  UserPreferences,
} from '@botprogracraft/shared';
import type {
  ChallengeDifficulty,
  ExerciseCheckParams,
  GeneratedLogicChallenge,
} from '@botprogracraft/ai-core';
import type {
  DesktopBridgeApi,
  PartialUserPreferences,
  ScreenFramePreview,
  TranscriptEntry,
} from './ipcTypes';

function subscribe<T extends unknown[]>(
  channel: string,
  cb: (...args: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
    cb(...(args as T));
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api: DesktopBridgeApi = {
  getInitialState: () => ipcRenderer.invoke('desktop:get-initial-state'),
  captureScreenFrame: () => ipcRenderer.invoke('desktop:capture-screen'),
  listCaptureSources: () => ipcRenderer.invoke('desktop:list-capture-sources'),
  setCaptureSource: (sourceId: string | null) =>
    ipcRenderer.invoke('desktop:set-capture-source', sourceId),
  setScreenShareEnabled: (enabled) =>
    ipcRenderer.invoke('desktop:set-screen-share', enabled),
  setTutorMode: (mode: TutorMode) =>
    ipcRenderer.invoke('desktop:set-tutor-mode', mode),
  setAiProvider: (provider: AiProviderType, ollamaModel?: string) =>
    ipcRenderer.invoke('desktop:set-ai-provider', provider, ollamaModel),
  checkOllamaHealth: () => ipcRenderer.invoke('desktop:check-ollama-health'),
  startLiveSession: () => ipcRenderer.invoke('desktop:start-live'),
  stopLiveSession: () => ipcRenderer.invoke('desktop:stop-live'),
  sendTextTurn: (text: string) => ipcRenderer.invoke('desktop:send-text', text),
  sendAudioChunk: (base64Pcm16: string, sampleRate: number) => {
    ipcRenderer.send('desktop:audio-chunk', base64Pcm16, sampleRate);
  },
  requestIdeContext: () => ipcRenderer.invoke('desktop:request-ide-context'),
  toggleMinimize: () => ipcRenderer.invoke('desktop:toggle-minimize'),
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.invoke('desktop:set-ignore-mouse', ignore),
  getProgressStats: () => ipcRenderer.invoke('desktop:get-progress-stats'),
  listRecentAttempts: (limit?: number) =>
    ipcRenderer.invoke('desktop:list-recent-attempts', limit),
  listRecurringErrors: (limit?: number) =>
    ipcRenderer.invoke('desktop:list-recurring-errors', limit),
  generateLogicChallenge: (difficulty: ChallengeDifficulty, topic?: string) =>
    ipcRenderer.invoke('desktop:generate-logic-challenge', difficulty, topic),
  evaluateSolution: (challenge: GeneratedLogicChallenge, userCode: string) =>
    ipcRenderer.invoke('desktop:evaluate-solution', challenge, userCode),
  runExerciseCheck: (params: ExerciseCheckParams) =>
    ipcRenderer.invoke('desktop:run-exercise-check', params),
  installAntigravityMcp: () =>
    ipcRenderer.invoke('desktop:install-antigravity-mcp'),
  exportStudyReport: () =>
    ipcRenderer.invoke('desktop:export-study-report'),
  getPreferences: () =>
    ipcRenderer.invoke('desktop:get-preferences'),
  updatePreferences: (partial: PartialUserPreferences) =>
    ipcRenderer.invoke('desktop:update-preferences', partial),
  showMascotContextMenu: () =>
    ipcRenderer.invoke('desktop:show-mascot-menu'),
  onIdeConnection: (cb) =>
    subscribe<[connected: boolean]>('event:ide-connection', cb),
  onIdeContext: (cb) =>
    subscribe<[context: IdeContextPayload]>('event:ide-context', cb),
  onLiveStatus: (cb) =>
    subscribe<[status: LiveSessionStatus, message?: string]>(
      'event:live-status',
      cb,
    ),
  onTranscript: (cb) =>
    subscribe<[entry: TranscriptEntry]>('event:transcript', cb),
  onSpeakText: (cb) => subscribe<[text: string]>('event:speak-text', cb),
  onAudioOutput: (cb) =>
    subscribe<[dataBase64: string, mimeType: string, sampleRate: number]>(
      'event:audio-output',
      cb,
    ),
  onInterrupted: (cb) => subscribe<[]>('event:interrupted', cb),
  onTurnComplete: (cb) => subscribe<[]>('event:turn-complete', cb),
  onScreenFrame: (cb) =>
    subscribe<[frame: ScreenFrame]>('event:screen-frame', cb),
  onScreenFramePreview: (cb) =>
    subscribe<[preview: ScreenFramePreview]>('event:screen-frame-preview', cb),
  onPushToTalkShortcut: (cb) =>
    subscribe<[]>('event:push-to-talk', cb),
  onPushToTalkToggle: (cb) =>
    subscribe<[]>('event:push-to-talk-toggle', cb),
  onPreferencesUpdated: (cb) =>
    subscribe<[preferences: UserPreferences]>('event:preferences-updated', cb),
  onToggleCompact: (cb) =>
    subscribe<[]>('event:toggle-compact', cb),
  onTutorModeUpdated: (cb) =>
    subscribe<[mode: TutorMode]>('event:tutor-mode-updated', cb),
};

contextBridge.exposeInMainWorld('botprogracraft', api);
