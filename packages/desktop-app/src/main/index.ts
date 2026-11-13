import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  session,
  Tray,
} from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_WS_PORT,
  isTutorMode,
  type IdeContextPayload,
  type LiveSessionStatus,
  type ScreenFrame,
  type TutorMode,
} from '@botprogracraft/shared';
import {
  ChallengeDifficultySchema,
  ContextAggregator,
  GeminiLiveSessionManager,
  LogicChallengeSchema,
  ScreenFrameGate,
  StructuredChallengeService,
  type ChallengeDifficulty,
  type ExerciseFeedback,
  type LogicChallenge,
} from '@botprogracraft/ai-core';
import { ProgressRepository } from '@botprogracraft/storage';
import { loadWorkspaceEnv } from './envLoader';
import type {
  DesktopStateSnapshot,
  ProgressStatsSummary,
  RecentAttemptSummary,
  RecurringErrorSummary,
  ScreenFramePreview,
  TranscriptEntry,
} from './ipcTypes';
import { createOverlayWindow } from './overlayWindow';
import {
  capturePrimaryScreenFrame,
  getCaptureSource,
  listCaptureSources,
  setCaptureSource,
} from './screenCapture';
import { IdeWsServer } from './wsServer';

loadWorkspaceEnv();

const PUSH_TO_TALK_SHORTCUT = 'CommandOrControl+Shift+Space';
const SCREEN_CAPTURE_INTERVAL_MS = 5000;
const MAX_TEXT_TURN_LENGTH = 16_000;
const MAX_AUDIO_CHUNK_BASE64_LENGTH = 512 * 1024;
const SESSION_ID = `session-${Date.now()}`;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let screenInterval: ReturnType<typeof setInterval> | null = null;
let screenShareEnabled = false;
let currentTutorMode: TutorMode = 'socratic';
let currentLiveStatus: LiveSessionStatus = 'disconnected';
let progressRepo: ProgressRepository | null = null;

const contextAggregator = new ContextAggregator();
const wsServer = new IdeWsServer(DEFAULT_WS_PORT);
const challengeService = new StructuredChallengeService({
  apiKey: process.env.GEMINI_API_KEY ?? '',
});
const screenFrameGate = new ScreenFrameGate({
  minIntervalMs: 1000,
  forceAfterMs: 15_000,
  minChangeRatio: 0.02,
});

function resolveAssetPath(filename: string): string | undefined {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'assets', filename),
    path.resolve(process.cwd(), 'assets', filename),
    path.resolve(process.resourcesPath ?? '', 'assets', filename),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function redactSensitiveText(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED_API_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

function getAllowedDevServerUrl(): string | undefined {
  if (app.isPackaged) {
    return undefined;
  }
  const raw = process.env.VITE_DEV_SERVER_URL?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.toString();
    }
  } catch {
    // Ignore malformed URL.
  }
  return undefined;
}

function isAllowedAppOrigin(
  requestingUrl: string,
  devServerUrl?: string,
): boolean {
  if (!requestingUrl) {
    return false;
  }
  if (devServerUrl) {
    try {
      return new URL(requestingUrl).origin === new URL(devServerUrl).origin;
    } catch {
      return false;
    }
  }
  return requestingUrl.startsWith('file://');
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function emitTranscript(entry: Omit<TranscriptEntry, 'id'>): void {
  const fullEntry: TranscriptEntry = {
    ...entry,
    id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  };
  sendToRenderer('event:transcript', fullEntry);
  wsServer.broadcast({
    type: 'ai:transcript',
    role: entry.role,
    text: entry.text,
    isFinal: entry.isFinal,
    tutorMode: currentTutorMode,
    timestamp: entry.timestamp,
  });

  if (progressRepo && entry.isFinal && entry.role !== 'system') {
    try {
      progressRepo.appendMessage({
        sessionId: SESSION_ID,
        role: entry.role,
        mode: currentTutorMode,
        content: entry.text,
      });
    } catch {
      // Do not interrupt tutoring if local persistence fails.
    }
  }
}

const liveManager = new GeminiLiveSessionManager({
  config: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    tutorMode: currentTutorMode,
    unfiltered: false,
    includeScreenFrames: true,
  },
  contextAggregator,
  events: {
    onStatusChange: (status, detail) => {
      currentLiveStatus = status;
      const safeDetail = detail ? redactSensitiveText(detail) : undefined;
      sendToRenderer('event:live-status', status, safeDetail);
      wsServer.broadcast({
        type: 'ai:status',
        status,
        tutorMode: currentTutorMode,
        message: safeDetail,
        timestamp: Date.now(),
      });
    },
    onTranscript: (event) => {
      emitTranscript({
        role: event.role,
        text: event.text,
        isFinal: event.isFinal,
        timestamp: event.timestamp,
      });
    },
    onAudioOutput: (event) => {
      sendToRenderer(
        'event:audio-output',
        event.dataBase64,
        event.mimeType,
        event.sampleRate,
      );
    },
    onInterrupted: () => {
      sendToRenderer('event:interrupted');
    },
    onTurnComplete: () => {
      sendToRenderer('event:turn-complete');
    },
    onError: (error) => {
      emitTranscript({
        role: 'system',
        text: `Live session error: ${redactSensitiveText(error.message)}`,
        isFinal: true,
        timestamp: Date.now(),
      });
    },
  },
});

async function captureAndBroadcastFrame(): Promise<ScreenFrame | null> {
  const frame = await capturePrimaryScreenFrame();
  if (!frame) return null;

  const decision = screenFrameGate.shouldSend(frame);
  const preview: ScreenFramePreview = {
    dataUrl: `data:${frame.mimeType};base64,${frame.dataBase64}`,
    sent: decision.shouldSend,
    reason: decision.reason,
    timestamp: frame.timestamp,
  };
  sendToRenderer('event:screen-frame-preview', preview);

  if (!decision.shouldSend) {
    return null;
  }

  contextAggregator.updateScreenFrame(frame);
  sendToRenderer('event:screen-frame', frame);

  if (liveManager.getStatus() === 'connected') {
    try {
      liveManager.sendScreenFrame(frame);
    } catch {
      // Ignore if session disconnected mid-frame.
    }
  }

  return frame;
}

function stopScreenCaptureLoop(): void {
  if (screenInterval) {
    clearInterval(screenInterval);
    screenInterval = null;
  }
}

function startScreenCaptureLoop(): void {
  stopScreenCaptureLoop();
  screenInterval = setInterval(() => {
    void captureAndBroadcastFrame();
  }, SCREEN_CAPTURE_INTERVAL_MS);
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    'desktop:get-initial-state',
    (): DesktopStateSnapshot => ({
      ideConnected: wsServer.isIdeConnected(),
      ideContext: contextAggregator.getIdeContext(),
      liveStatus: currentLiveStatus,
      tutorMode: currentTutorMode,
      screenShareEnabled,
      latestFrame: contextAggregator.getLatestScreenFrame(),
      apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      selectedCaptureSourceId: getCaptureSource(),
    }),
  );

  ipcMain.handle('desktop:capture-screen', async () => {
    return captureAndBroadcastFrame();
  });

  ipcMain.handle('desktop:list-capture-sources', async () => {
    return listCaptureSources();
  });

  ipcMain.handle(
    'desktop:set-capture-source',
    (_event, sourceId: unknown) => {
      if (sourceId !== null && typeof sourceId !== 'string') {
        throw new Error('Invalid capture sourceId parameter.');
      }
      setCaptureSource(sourceId);
      screenFrameGate.reset();
    },
  );

  ipcMain.handle(
    'desktop:set-screen-share',
    async (_event, enabled: unknown) => {
      if (typeof enabled !== 'boolean') {
        throw new Error('Invalid screen share parameter: expected boolean.');
      }
      screenShareEnabled = enabled;
      if (enabled) {
        await captureAndBroadcastFrame();
        startScreenCaptureLoop();
      } else {
        stopScreenCaptureLoop();
        screenFrameGate.reset();
      }
    },
  );

  ipcMain.handle('desktop:set-tutor-mode', (_event, mode: unknown) => {
    if (!isTutorMode(mode)) {
      throw new Error('Invalid tutor mode parameter.');
    }
    currentTutorMode = mode;
    liveManager.updateTutorMode(mode, mode === 'direct');
    wsServer.broadcast({
      type: 'ai:status',
      status: currentLiveStatus,
      tutorMode: currentTutorMode,
      timestamp: Date.now(),
    });
  });

  ipcMain.handle('desktop:start-live', async () => {
    if (!process.env.GEMINI_API_KEY?.trim()) {
      sendToRenderer(
        'event:live-status',
        'error',
        'Missing GEMINI_API_KEY in .env',
      );
      emitTranscript({
        role: 'system',
        text: 'GEMINI_API_KEY is not set. Add GEMINI_API_KEY=... to the workspace .env file and restart.',
        isFinal: true,
        timestamp: Date.now(),
      });
      return;
    }
    try {
      await liveManager.connect();
    } catch {
      // Error already surfaced via onError event.
    }
  });

  ipcMain.handle('desktop:stop-live', () => {
    liveManager.disconnect();
  });

  ipcMain.handle('desktop:send-text', async (_event, text: unknown) => {
    if (typeof text !== 'string') {
      throw new Error('Invalid text parameter: expected string.');
    }
    const trimmed = text.trim().slice(0, MAX_TEXT_TURN_LENGTH);
    if (!trimmed) return;

    emitTranscript({
      role: 'user',
      text: trimmed,
      isFinal: true,
      timestamp: Date.now(),
    });

    if (liveManager.getStatus() !== 'connected') {
      if (!process.env.GEMINI_API_KEY?.trim()) {
        emitTranscript({
          role: 'system',
          text: 'Cannot send to Gemini Live: GEMINI_API_KEY is not configured.',
          isFinal: true,
          timestamp: Date.now(),
        });
        return;
      }
      try {
        await liveManager.connect();
      } catch {
        return;
      }
    }

    liveManager.sendTextTurn(trimmed, true);
  });

  ipcMain.on(
    'desktop:audio-chunk',
    (_event, base64Pcm16: unknown, sampleRate: unknown) => {
      if (
        typeof base64Pcm16 !== 'string' ||
        base64Pcm16.length === 0 ||
        base64Pcm16.length > MAX_AUDIO_CHUNK_BASE64_LENGTH ||
        typeof sampleRate !== 'number' ||
        !Number.isFinite(sampleRate) ||
        sampleRate < 8000 ||
        sampleRate > 96_000
      ) {
        return;
      }
      if (liveManager.getStatus() === 'connected') {
        try {
          liveManager.sendAudioChunk(
            base64Pcm16,
            `audio/pcm;rate=${Math.round(sampleRate)}`,
          );
        } catch {
          // Ignore transient send errors while reconnecting.
        }
      }
    },
  );

  ipcMain.handle('desktop:request-ide-context', () => {
    wsServer.requestContext('hud-sync-button');
  });

  ipcMain.handle('desktop:toggle-minimize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    } else {
      mainWindow.minimize();
    }
  });

  ipcMain.handle(
    'desktop:get-progress-stats',
    (): ProgressStatsSummary => {
      if (!progressRepo) {
        return {
          totalAttempts: 0,
          passedAttempts: 0,
          totalMessages: 0,
          recurringErrorCount: 0,
        };
      }
      const stats = progressRepo.getStats();
      return {
        totalAttempts: stats.totalAttempts,
        passedAttempts: stats.passedAttempts,
        totalMessages: stats.totalMessages,
        recurringErrorCount: stats.totalRecurringErrors,
      };
    },
  );

  ipcMain.handle(
    'desktop:list-recent-attempts',
    (_event, limit?: unknown): RecentAttemptSummary[] => {
      if (
        limit !== undefined &&
        (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1)
      ) {
        throw new Error('Invalid limit parameter: expected positive number.');
      }
      if (!progressRepo) {
        return [];
      }
      const safeLimit = limit === undefined ? 20 : Math.min(200, Math.floor(limit));
      return progressRepo
        .listRecentAttempts({ limit: safeLimit })
        .map((attempt) => ({
          id: attempt.id,
          title: attempt.title,
          mode: attempt.mode,
          passed: attempt.passed,
          score: attempt.score ?? null,
          createdAt: attempt.createdAt,
        }));
    },
  );

  ipcMain.handle(
    'desktop:list-recurring-errors',
    (_event, limit?: unknown): RecurringErrorSummary[] => {
      if (
        limit !== undefined &&
        (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1)
      ) {
        throw new Error('Invalid limit parameter: expected positive number.');
      }
      if (!progressRepo) {
        return [];
      }
      const safeLimit = limit === undefined ? 10 : Math.min(100, Math.floor(limit));
      return progressRepo
        .getTopRecurringErrors({ limit: safeLimit })
        .map((err) => ({
          id: err.id,
          errorSignature: err.errorSignature,
          languageId: err.languageId,
          filePath: err.filePath,
          occurrenceCount: err.occurrenceCount,
          lastSeenAt: err.lastSeenAt,
        }));
    },
  );

  ipcMain.handle(
    'desktop:generate-logic-challenge',
    async (
      _event,
      difficulty: unknown,
      topic?: unknown,
    ): Promise<LogicChallenge> => {
      const parsedDifficulty = ChallengeDifficultySchema.safeParse(difficulty);
      if (!parsedDifficulty.success) {
        throw new Error('Invalid difficulty parameter.');
      }
      if (topic !== undefined && typeof topic !== 'string') {
        throw new Error('Invalid topic parameter: expected string.');
      }
      const languageId =
        contextAggregator.getIdeContext()?.languageId || 'typescript';
      return challengeService.generateLogicChallenge({
        difficulty: parsedDifficulty.data as ChallengeDifficulty,
        languageId,
        topic: topic?.trim() || undefined,
        unfiltered: currentTutorMode === 'direct',
      });
    },
  );

  ipcMain.handle(
    'desktop:evaluate-solution',
    async (
      _event,
      challenge: unknown,
      userCode: unknown,
    ): Promise<ExerciseFeedback> => {
      const parsedChallenge = LogicChallengeSchema.safeParse(challenge);
      if (!parsedChallenge.success) {
        throw new Error('Invalid challenge payload.');
      }
      if (typeof userCode !== 'string' || !userCode.trim()) {
        throw new Error('Solution code must not be empty.');
      }
      const languageId =
        contextAggregator.getIdeContext()?.languageId || 'typescript';
      const feedback = await challengeService.evaluateExerciseSolution({
        challenge: parsedChallenge.data,
        userCode,
        languageId,
        unfiltered: currentTutorMode === 'direct',
      });

      if (progressRepo) {
        try {
          progressRepo.recordAttempt({
            title: parsedChallenge.data.title,
            mode: currentTutorMode,
            languageId,
            prompt: parsedChallenge.data.prompt,
            userCode,
            passed: feedback.passed,
            score: feedback.score,
            feedback: {
              strengths: feedback.strengths,
              improvements: feedback.improvements,
              nextStep: feedback.nextStep,
            },
          });
        } catch {
          // Do not fail evaluation response if local storage write fails.
        }
      }

      return feedback;
    },
  );
}

function setupWsBridge(): void {
  wsServer.on('connection', (connected: boolean) => {
    sendToRenderer('event:ide-connection', connected);
  });

  wsServer.on('context', (payload: IdeContextPayload) => {
    liveManager.updateIdeContext(payload);
    sendToRenderer('event:ide-context', payload);

    if (progressRepo && payload.diagnostics.length > 0) {
      const errorDiags = payload.diagnostics.filter((d) => d.severity === 'error');
      for (const diag of errorDiags.slice(0, 10)) {
        try {
          progressRepo.recordRecurringError({
            errorSignature: diag.message.slice(0, 240),
            languageId: payload.languageId || 'unknown',
            filePath: payload.activeFile ?? '',
            notes: diag.source
              ? `${diag.source}${diag.code !== undefined ? ` (${String(diag.code)})` : ''}`
              : null,
          });
        } catch {
          // Ignore storage errors while processing IDE context.
        }
      }
    }
  });

  wsServer.on('error', (err: Error) => {
    emitTranscript({
      role: 'system',
      text: `IDE bridge warning: ${redactSensitiveText(err.message)}`,
      isFinal: true,
      timestamp: Date.now(),
    });
  });

  wsServer.start();
}

void app.whenReady().then(() => {
  const devServerUrl = getAllowedDevServerUrl();

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      if (permission !== 'media') {
        callback(false);
        return;
      }
      const requestingUrl = details.requestingUrl || webContents.getURL();
      callback(isAllowedAppOrigin(requestingUrl, devServerUrl));
    },
  );

  try {
    progressRepo = new ProgressRepository({
      dbPath: path.join(app.getPath('userData'), 'botprogracraft.db'),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to initialize ProgressRepository: ${redactSensitiveText(msg)}`);
  }

  registerIpcHandlers();
  setupWsBridge();

  const iconPath =
    resolveAssetPath(process.platform === 'win32' ? 'icon.ico' : 'icon.png') ??
    resolveAssetPath('icon.png');

  mainWindow = createOverlayWindow({
    preloadPath: path.join(__dirname, 'preload.js'),
    rendererHtmlPath: path.join(__dirname, '..', 'renderer', 'index.html'),
    devServerUrl,
    iconPath,
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const trayIconPath = resolveAssetPath('icon.png') ?? iconPath;
  if (trayIconPath) {
    const trayImage = nativeImage.createFromPath(trayIconPath).resize({
      width: 16,
      height: 16,
    });
    tray = new Tray(trayImage);
    tray.setToolTip('BotPrograCraft');

    const toggleWindow = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    };

    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Mostrar / Ocultar HUD', click: toggleWindow },
        { type: 'separator' },
        {
          label: 'Sair',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on('double-click', toggleWindow);
  }

  globalShortcut.register(PUSH_TO_TALK_SHORTCUT, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
    }
    sendToRenderer('event:push-to-talk-toggle');
    sendToRenderer('event:push-to-talk');
    if (screenShareEnabled) {
      void captureAndBroadcastFrame();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createOverlayWindow({
        preloadPath: path.join(__dirname, 'preload.js'),
        rendererHtmlPath: path.join(__dirname, '..', 'renderer', 'index.html'),
        devServerUrl,
        iconPath,
      });
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopScreenCaptureLoop();
  liveManager.disconnect();
  wsServer.stop();
  tray?.destroy();
  tray = null;
  if (progressRepo) {
    progressRepo.close();
    progressRepo = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
