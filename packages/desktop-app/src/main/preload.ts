import { contextBridge, ipcRenderer } from 'electron';
import type {
  IdeContextPayload,
  LiveSessionStatus,
  ScreenFrame,
  TutorMode,
} from '@botprogracraft/shared';
import type { DesktopBridgeApi, TranscriptEntry } from './ipcTypes';

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
  setScreenShareEnabled: (enabled) =>
    ipcRenderer.invoke('desktop:set-screen-share', enabled),
  setTutorMode: (mode: TutorMode) =>
    ipcRenderer.invoke('desktop:set-tutor-mode', mode),
  startLiveSession: () => ipcRenderer.invoke('desktop:start-live'),
  stopLiveSession: () => ipcRenderer.invoke('desktop:stop-live'),
  sendTextTurn: (text: string) => ipcRenderer.invoke('desktop:send-text', text),
  sendAudioChunk: (base64Pcm16: string, sampleRate: number) => {
    ipcRenderer.send('desktop:audio-chunk', base64Pcm16, sampleRate);
  },
  requestIdeContext: () => ipcRenderer.invoke('desktop:request-ide-context'),
  toggleMinimize: () => ipcRenderer.invoke('desktop:toggle-minimize'),
  getProgressStats: () => ipcRenderer.invoke('desktop:get-progress-stats'),
  listRecentAttempts: (limit?: number) =>
    ipcRenderer.invoke('desktop:list-recent-attempts', limit),
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
  onAudioOutput: (cb) =>
    subscribe<[dataBase64: string, mimeType: string, sampleRate: number]>(
      'event:audio-output',
      cb,
    ),
  onInterrupted: (cb) => subscribe<[]>('event:interrupted', cb),
  onTurnComplete: (cb) => subscribe<[]>('event:turn-complete', cb),
  onScreenFrame: (cb) =>
    subscribe<[frame: ScreenFrame]>('event:screen-frame', cb),
  onPushToTalkShortcut: (cb) =>
    subscribe<[]>('event:push-to-talk', cb),
};

contextBridge.exposeInMainWorld('botprogracraft', api);
