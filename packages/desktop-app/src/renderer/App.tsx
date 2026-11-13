import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TUTOR_MODES,
  TUTOR_MODE_INFO,
  type IdeContextPayload,
  type LiveSessionStatus,
  type ScreenFrame,
  type TutorMode,
} from '@botprogracraft/shared';
import type { TranscriptEntry } from '../main/ipcTypes';
import type { ProgressStats, RecentAttempt } from './global';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useAudioPlayback } from './hooks/useAudioPlayback';

type HudTab = 'chat' | 'progress';

function VoiceWave({
  active,
  label,
}: {
  active: boolean;
  label?: string;
}): React.ReactElement {
  return (
    <span
      className={`voice-wave ${active ? 'voice-wave--active' : ''}`}
      aria-label={label}
      aria-hidden={!label}
    >
      <span className="voice-wave-bar" />
      <span className="voice-wave-bar" />
      <span className="voice-wave-bar" />
      <span className="voice-wave-bar" />
    </span>
  );
}

function MicIcon(): React.ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function ScreenIcon(): React.ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }): React.ReactElement {
  if (muted) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="22" x2="16" y1="9" y2="15" />
        <line x1="16" x2="22" y1="9" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SyncIcon(): React.ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function CompactToggleIcon({ compact }: { compact: boolean }): React.ReactElement {
  if (compact) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" x2="14" y1="3" y2="10" />
        <line x1="3" x2="10" y1="21" y2="14" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" x2="21" y1="10" y2="3" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  );
}

function formatAttemptDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function App(): React.ReactElement {
  const [ideConnected, setIdeConnected] = useState(false);
  const [ideContext, setIdeContext] = useState<IdeContextPayload | null>(null);
  const [liveStatus, setLiveStatus] =
    useState<LiveSessionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [tutorMode, setTutorMode] = useState<TutorMode>('socratic');
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [latestFrame, setLatestFrame] = useState<ScreenFrame | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [inputText, setInputText] = useState('');

  // Compact HUD pill & active tab state
  const [isCompact, setIsCompact] = useState(false);
  const [activeTab, setActiveTab] = useState<HudTab>('chat');

  // SQLite progress state
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressAvailable, setProgressAvailable] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const audioPlayback = useAudioPlayback();
  const { enqueueAudio, stop: stopPlayback } = audioPlayback;

  const audioCapture = useAudioCapture({
    sampleRate: 16000,
    onAudioChunk: (base64Pcm16, sampleRate) => {
      window.botprogracraft.sendAudioChunk(base64Pcm16, sampleRate);
    },
  });

  const handleToggleVoice = useCallback(async () => {
    if (audioCapture.isCapturing) {
      audioCapture.stopCapture();
      await window.botprogracraft.stopLiveSession();
    } else {
      await window.botprogracraft.startLiveSession();
      await audioCapture.startCapture();
    }
  }, [audioCapture]);

  const loadProgress = useCallback(async () => {
    const getStats = window.botprogracraft?.getProgressStats;
    const listAttempts = window.botprogracraft?.listRecentAttempts;

    if (!getStats && !listAttempts) {
      setProgressAvailable(false);
      setProgressStats({
        totalAttempts: 0,
        passedAttempts: 0,
        totalMessages: 0,
        recurringErrorCount: 0,
      });
      setRecentAttempts([]);
      return;
    }

    setProgressAvailable(true);
    setProgressLoading(true);
    setProgressError(null);

    try {
      const [stats, attempts] = await Promise.all([
        getStats
          ? getStats()
          : Promise.resolve({
              totalAttempts: 0,
              passedAttempts: 0,
              totalMessages: 0,
              recurringErrorCount: 0,
            }),
        listAttempts ? listAttempts(5) : Promise.resolve([]),
      ]);
      setProgressStats(stats);
      setRecentAttempts(attempts);
    } catch (err) {
      setProgressError(
        err instanceof Error ? err.message : 'Failed to load progress',
      );
    } finally {
      setProgressLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void window.botprogracraft.getInitialState().then((snapshot) => {
      if (!mounted) return;
      setIdeConnected(snapshot.ideConnected);
      setIdeContext(snapshot.ideContext);
      setLiveStatus(snapshot.liveStatus);
      setTutorMode(snapshot.tutorMode);
      setScreenShareEnabled(snapshot.screenShareEnabled);
      setLatestFrame(snapshot.latestFrame);
      setApiKeyConfigured(snapshot.apiKeyConfigured);
    });

    const unsubs = [
      window.botprogracraft.onIdeConnection(setIdeConnected),
      window.botprogracraft.onIdeContext(setIdeContext),
      window.botprogracraft.onLiveStatus((status, message) => {
        setLiveStatus(status);
        setStatusMessage(message);
      }),
      window.botprogracraft.onTranscript((entry) => {
        setTranscript((prev) => [...prev.slice(-99), entry]);
      }),
      window.botprogracraft.onAudioOutput((dataBase64, mimeType) => {
        enqueueAudio(dataBase64, mimeType);
      }),
      window.botprogracraft.onInterrupted(() => {
        stopPlayback();
      }),
      window.botprogracraft.onScreenFrame(setLatestFrame),
      window.botprogracraft.onPushToTalkShortcut(() => {
        void handleToggleVoice();
      }),
    ];

    return () => {
      mounted = false;
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [enqueueAudio, handleToggleVoice, stopPlayback]);

  useEffect(() => {
    if (activeTab === 'chat') {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, activeTab]);

  useEffect(() => {
    if (activeTab === 'progress') {
      void loadProgress();
    }
  }, [activeTab, loadProgress]);

  const handleModeChange = async (mode: TutorMode) => {
    setTutorMode(mode);
    await window.botprogracraft.setTutorMode(mode);
  };

  const handleToggleScreen = async () => {
    const next = !screenShareEnabled;
    setScreenShareEnabled(next);
    await window.botprogracraft.setScreenShareEnabled(next);
    if (next) {
      const frame = await window.botprogracraft.captureScreenFrame();
      if (frame) {
        setLatestFrame(frame);
      }
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    setActiveTab('chat');
    await window.botprogracraft.sendTextTurn(trimmed);
  };

  const activeFileLabel = ideContext?.activeFile
    ? ideContext.activeFile.split(/[/\\]/).pop() ?? ideContext.activeFile
    : 'No active file';

  const diagnosticsCount = ideContext?.diagnostics.length ?? 0;
  const isVoiceActive = audioCapture.isCapturing || audioPlayback.isPlaying;
  const passRate =
    progressStats && progressStats.totalAttempts > 0
      ? Math.round(
          (progressStats.passedAttempts / progressStats.totalAttempts) * 100,
        )
      : 0;

  if (isCompact) {
    return (
      <div className="hud-compact-wrapper">
        <div className="hud-pill" role="region" aria-label="BotPrograCraft Compact HUD">
          <div
            className="hud-pill-status"
            title={
              ideConnected
                ? 'IDE extension connected'
                : 'Waiting for IDE extension'
            }
          >
            <span
              className={`badge-dot ${
                ideConnected ? '' : ''
              }`}
              style={{
                background: ideConnected ? 'var(--success)' : 'var(--text-muted)',
                boxShadow: ideConnected
                  ? '0 0 8px rgba(34, 197, 94, 0.7)'
                  : 'none',
              }}
            />
            <span>{ideConnected ? 'IDE' : 'Offline'}</span>
          </div>

          <span className="hud-pill-divider" aria-hidden="true" />

          <span className="hud-pill-mode" title={TUTOR_MODE_INFO[tutorMode].description}>
            {TUTOR_MODE_INFO[tutorMode].label}
          </span>

          <div className="hud-pill-actions">
            <button
              type="button"
              className={`pill-icon-btn ${
                audioCapture.isCapturing
                  ? 'pill-icon-btn--live'
                  : audioPlayback.isPlaying
                    ? 'pill-icon-btn--speaking'
                    : ''
              }`}
              onClick={() => void handleToggleVoice()}
              aria-pressed={audioCapture.isCapturing}
              title={
                audioCapture.isCapturing
                  ? 'Stop voice capture'
                  : audioPlayback.isPlaying
                    ? 'AI speaking — click to start mic'
                    : 'Start voice capture (Ctrl+Shift+Space)'
              }
            >
              <VoiceWave
                active={isVoiceActive}
                label={
                  audioCapture.isCapturing
                    ? 'Microphone active'
                    : audioPlayback.isPlaying
                      ? 'AI speaking'
                      : 'Voice idle'
                }
              />
              <span>
                {audioCapture.isCapturing
                  ? 'Live'
                  : audioPlayback.isPlaying
                    ? 'AI'
                    : 'Mic'}
              </span>
            </button>

            <button
              type="button"
              className="pill-icon-btn"
              onClick={() => setIsCompact(false)}
              title="Expand HUD"
              aria-label="Expand HUD"
            >
              <CompactToggleIcon compact />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hud-shell">
      <header className="hud-titlebar">
        <div className="hud-brand">
          <span
            className={`hud-logo-dot ${isVoiceActive ? 'hud-logo-dot--active' : ''}`}
          />
          <span>BotPrograCraft</span>
        </div>
        <div className="hud-titlebar-actions">
          <span
            className={`badge ${ideConnected ? 'badge--connected' : ''}`}
            title={
              ideConnected
                ? 'IDE extension connected on ws://localhost:4848'
                : 'Waiting for IDE extension on ws://localhost:4848'
            }
          >
            <span className="badge-dot" />
            {ideConnected ? 'IDE' : 'Offline'}
          </span>
          <span
            className={`badge badge--${liveStatus}`}
            title={statusMessage ?? `Live API: ${liveStatus}`}
          >
            <span className="badge-dot" />
            {liveStatus}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsCompact(true)}
            title="Switch to compact pill"
            aria-label="Switch to compact pill"
          >
            <CompactToggleIcon compact={false} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => void window.botprogracraft.toggleMinimize()}
            title="Minimize HUD"
            aria-label="Minimize HUD"
          >
            —
          </button>
        </div>
      </header>

      <section className="hud-modes" aria-label="Tutor Mode">
        {TUTOR_MODES.map((mode) => {
          const info = TUTOR_MODE_INFO[mode];
          const active = tutorMode === mode;
          return (
            <button
              key={mode}
              type="button"
              className={`mode-btn ${active ? 'mode-btn--active' : ''}`}
              title={info.description}
              aria-pressed={active}
              onClick={() => void handleModeChange(mode)}
            >
              {info.label}
            </button>
          );
        })}
      </section>

      <div className="hud-context-strip">
        <div className="hud-context-left">
          <span className="hud-context-file" title={ideContext?.activeFile ?? ''}>
            {activeFileLabel}
            {ideContext?.languageId ? ` · ${ideContext.languageId}` : ''}
          </span>
          <span>
            {diagnosticsCount > 0
              ? `· ${diagnosticsCount} issue${diagnosticsCount === 1 ? '' : 's'}`
              : ''}
          </span>
        </div>

        <div className="hud-tabs" role="tablist" aria-label="HUD View">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            className={`hud-tab ${activeTab === 'chat' ? 'hud-tab--active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'progress'}
            className={`hud-tab ${activeTab === 'progress' ? 'hud-tab--active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            Progresso
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <main className="hud-transcript" role="tabpanel" aria-label="Chat Transcript">
          {transcript.length === 0 ? (
            <div className="hud-empty">
              {TUTOR_MODE_INFO[tutorMode].description}
              <br />
              <br />
              Press <strong>Ctrl+Shift+Space</strong> or click{' '}
              <strong>Voice</strong> to start, or ask a question below.
            </div>
          ) : (
            transcript.map((entry) => (
              <div key={entry.id} className={`msg msg--${entry.role}`}>
                {entry.role !== 'system' && (
                  <span className="msg-role">{entry.role}</span>
                )}
                <span>{entry.text}</span>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </main>
      ) : (
        <section className="progress-panel" role="tabpanel" aria-label="Progresso">
          <div className="progress-header">
            <div>
              <div className="progress-title">Progresso do Aluno</div>
              <div className="progress-subtitle">
                Histórico local de sessões e tentativas
              </div>
            </div>
            <button
              type="button"
              className="pill-btn"
              onClick={() => void loadProgress()}
              disabled={progressLoading}
              title="Atualizar métricas"
            >
              <SyncIcon />
              <span>{progressLoading ? '...' : 'Atualizar'}</span>
            </button>
          </div>

          {!progressAvailable && (
            <div className="progress-notice">
              Integração SQLite aguardando bridge IPC (<code>getProgressStats</code> /{' '}
              <code>listRecentAttempts</code>). As métricas aparecerão aqui automaticamente
              assim que o storage estiver conectado.
            </div>
          )}

          {progressError && (
            <div className="hud-alert hud-alert--error">
              Erro ao carregar progresso: {progressError}
            </div>
          )}

          <div className="progress-bento">
            <div className="stat-card">
              <span className="stat-label">Tentativas</span>
              <span className="stat-value">
                {progressStats?.totalAttempts ?? 0}
              </span>
              <span className="stat-hint">
                {progressStats?.passedAttempts ?? 0} aprovadas
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Taxa de Sucesso</span>
              <span
                className={`stat-value ${
                  passRate >= 70 ? 'stat-value--success' : ''
                }`}
              >
                {passRate}%
              </span>
              <span className="stat-hint">desafios concluídos</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Mensagens</span>
              <span className="stat-value">
                {progressStats?.totalMessages ?? 0}
              </span>
              <span className="stat-hint">interações registradas</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Erros Recorrentes</span>
              <span
                className={`stat-value ${
                  (progressStats?.recurringErrorCount ?? 0) > 0
                    ? 'stat-value--warning'
                    : ''
                }`}
              >
                {progressStats?.recurringErrorCount ?? 0}
              </span>
              <span className="stat-hint">pontos de atenção</span>
            </div>
          </div>

          <div className="attempts-section">
            <div className="progress-title">Tentativas Recentes</div>
            {recentAttempts.length === 0 ? (
              <div className="progress-notice">
                Nenhuma tentativa registrada ainda. Resolva um desafio ou peça
                feedback em modo Challenge para acompanhar sua evolução.
              </div>
            ) : (
              <div className="attempts-list">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="attempt-row">
                    <div className="attempt-main">
                      <span className="attempt-title" title={attempt.title}>
                        {attempt.title}
                      </span>
                      <span className="attempt-meta">
                        <span className="attempt-mode-tag">{attempt.mode}</span>
                        <span>{formatAttemptDate(attempt.createdAt)}</span>
                      </span>
                    </div>
                    <div className="attempt-right">
                      <span className="attempt-score">
                        {attempt.score !== null ? `${attempt.score}%` : '—'}
                      </span>
                      <span
                        className={`attempt-badge ${
                          attempt.passed
                            ? 'attempt-badge--pass'
                            : 'attempt-badge--fail'
                        }`}
                      >
                        {attempt.passed ? 'Pass' : 'Review'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {screenShareEnabled && latestFrame && (
        <div className="hud-preview-bar">
          <img
            className="hud-preview-thumb"
            src={`data:${latestFrame.mimeType};base64,${latestFrame.dataBase64}`}
            alt="Screen capture preview"
          />
          <span>
            Screen active ({latestFrame.width}×{latestFrame.height})
          </span>
        </div>
      )}

      <footer className="hud-controls">
        <div className="hud-toolbar">
          <div className="hud-toolbar-left">
            <button
              type="button"
              className={`pill-btn ${audioCapture.isCapturing ? 'pill-btn--live' : ''}`}
              onClick={() => void handleToggleVoice()}
              aria-pressed={audioCapture.isCapturing}
              title="Toggle live voice capture (Ctrl+Shift+Space)"
            >
              {audioCapture.isCapturing ? (
                <>
                  <VoiceWave active label="Microphone active" />
                  <span>Live Mic</span>
                  <span className="mic-meter" aria-hidden="true">
                    <span
                      className="mic-meter-fill"
                      style={{ width: `${audioCapture.micLevel}%` }}
                    />
                  </span>
                </>
              ) : (
                <>
                  <MicIcon />
                  <span>Voice</span>
                </>
              )}
            </button>

            <button
              type="button"
              className={`pill-btn ${screenShareEnabled ? 'pill-btn--screen-on' : ''}`}
              onClick={() => void handleToggleScreen()}
              aria-pressed={screenShareEnabled}
              title="Toggle periodic screen capture"
            >
              <ScreenIcon />
              <span>{screenShareEnabled ? 'Screen On' : 'Screen'}</span>
            </button>

            <button
              type="button"
              className={`pill-btn ${audioPlayback.isPlaying ? 'pill-btn--speaking' : ''}`}
              onClick={audioPlayback.toggleMute}
              aria-pressed={audioPlayback.isMuted}
              title={
                audioPlayback.isMuted
                  ? 'Unmute AI voice playback'
                  : 'Mute AI voice playback'
              }
            >
              {audioPlayback.isPlaying ? (
                <>
                  <VoiceWave active label="AI speaking" />
                  <span>AI Speaking</span>
                </>
              ) : (
                <>
                  <VolumeIcon muted={audioPlayback.isMuted} />
                  <span>{audioPlayback.isMuted ? 'Muted' : 'Sound'}</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            className="pill-btn"
            onClick={() => void window.botprogracraft.requestIdeContext()}
            disabled={!ideConnected}
            title="Sync latest context from IDE"
          >
            <SyncIcon />
            <span>Sync</span>
          </button>
        </div>

        {!apiKeyConfigured && (
          <div className="hud-alert hud-alert--warn">
            GEMINI_API_KEY missing — add it to root .env and restart.
          </div>
        )}

        {audioCapture.error && (
          <div className="hud-alert hud-alert--error">
            Mic error: {audioCapture.error}
          </div>
        )}

        <form className="hud-input-row" onSubmit={(e) => void handleSendText(e)}>
          <input
            type="text"
            className="hud-input"
            placeholder={`Ask in ${TUTOR_MODE_INFO[tutorMode].label} mode...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={!inputText.trim()}
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
