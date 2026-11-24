import React, { useState } from 'react';

export type MascotStyle = 'robot' | 'pixel' | 'orb';
export type MascotMood =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'alert'
  | 'celebrating'
  | 'turbo';

export interface BotMascotProps {
  styleVariant: MascotStyle;
  mood: MascotMood;
  diagnosticsCount?: number;
  isListening?: boolean;
  isSpeaking?: boolean;
  ideConnected?: boolean;
  tutorModeLabel?: string;
  onToggleVoice?: () => void;
  onExpand?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

const MOOD_COLORS: Record<MascotMood, { primary: string; glow: string }> = {
  idle: { primary: '#6366f1', glow: 'rgba(99, 102, 241, 0.45)' },
  listening: { primary: '#06b6d4', glow: 'rgba(6, 182, 212, 0.55)' },
  speaking: { primary: '#818cf8', glow: 'rgba(129, 140, 248, 0.55)' },
  alert: { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' },
  celebrating: { primary: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)' },
  turbo: { primary: '#d946ef', glow: 'rgba(217, 70, 239, 0.6)' },
};

function RobotVisual({ mood }: { mood: MascotMood }): React.ReactElement {
  const palette = MOOD_COLORS[mood];
  return (
    <svg
      className={`mascot-svg mascot-svg--robot mascot-mood--${mood}`}
      viewBox="0 0 80 80"
      width="74"
      height="74"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="robotBodyGrad" x1="16" y1="18" x2="64" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#262f45" />
          <stop offset="100%" stopColor="#111726" />
        </linearGradient>
        <linearGradient id="robotVisorGrad" x1="20" y1="28" x2="60" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#090d16" />
          <stop offset="100%" stopColor="#121a2d" />
        </linearGradient>
      </defs>

      {/* Listening sonar rings */}
      {mood === 'listening' && (
        <>
          <circle cx="40" cy="11" r="6" stroke="#22d3ee" strokeWidth="1.4" className="mascot-antenna-ring" />
          <circle cx="40" cy="11" r="10" stroke="#22d3ee" strokeWidth="1" opacity="0.5" className="mascot-antenna-ring mascot-antenna-ring--delay" />
        </>
      )}

      {/* Antenna */}
      <line x1="40" y1="21" x2="40" y2="12" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
      <circle
        cx="40"
        cy="10"
        r="3.8"
        fill={palette.primary}
        className={mood === 'listening' || mood === 'alert' ? 'mascot-pulse' : ''}
      />

      {/* Side ear pods */}
      <rect x="10" y="34" width="6" height="16" rx="3" fill="#1e293b" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <rect x="64" y="34" width="6" height="16" rx="3" fill="#1e293b" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <rect x="11.5" y="38" width="3" height="8" rx="1.5" fill={palette.primary} opacity="0.85" />
      <rect x="65.5" y="38" width="3" height="8" rx="1.5" fill={palette.primary} opacity="0.85" />

      {/* Head chassis */}
      <rect
        x="16"
        y="21"
        width="48"
        height="42"
        rx="14"
        fill="url(#robotBodyGrad)"
        stroke={mood === 'turbo' ? '#e879f9' : 'rgba(255,255,255,0.18)'}
        strokeWidth="1.5"
      />
      {/* Top specular highlight */}
      <path d="M25 23.5 H55" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" strokeLinecap="round" />

      {/* Visor OLED */}
      <rect
        x="21"
        y="29"
        width="38"
        height="24"
        rx="8"
        fill="url(#robotVisorGrad)"
        stroke={palette.primary}
        strokeOpacity="0.65"
        strokeWidth="1.3"
      />

      {/* Visor expressions by mood */}
      {mood === 'idle' && (
        <g className="mascot-eyes-blink">
          <rect x="28" y="37" width="6" height="8" rx="3" fill="#818cf8" />
          <rect x="46" y="37" width="6" height="8" rx="3" fill="#818cf8" />
        </g>
      )}

      {mood === 'listening' && (
        <g>
          <circle cx="31" cy="41" r="4.2" fill="#22d3ee" className="mascot-pulse" />
          <circle cx="49" cy="41" r="4.2" fill="#22d3ee" className="mascot-pulse" />
          <circle cx="32.2" cy="39.5" r="1.2" fill="#ecfeff" />
          <circle cx="50.2" cy="39.5" r="1.2" fill="#ecfeff" />
        </g>
      )}

      {mood === 'speaking' && (
        <g className="mascot-visor-wave">
          <rect x="26" y="38" width="3.5" height="6" rx="1.7" fill="#a5b4fc" className="mascot-bar mascot-bar--1" />
          <rect x="32" y="34" width="3.5" height="14" rx="1.7" fill="#818cf8" className="mascot-bar mascot-bar--2" />
          <rect x="38" y="36" width="3.5" height="10" rx="1.7" fill="#c7d2fe" className="mascot-bar mascot-bar--3" />
          <rect x="44" y="34" width="3.5" height="14" rx="1.7" fill="#818cf8" className="mascot-bar mascot-bar--2" />
          <rect x="50" y="38" width="3.5" height="6" rx="1.7" fill="#a5b4fc" className="mascot-bar mascot-bar--1" />
        </g>
      )}

      {mood === 'alert' && (
        <g>
          <rect x="38" y="33" width="4" height="10" rx="2" fill="#fbbf24" className="mascot-pulse" />
          <circle cx="40" cy="47.5" r="2.2" fill="#fbbf24" />
        </g>
      )}

      {mood === 'celebrating' && (
        <g>
          <path d="M27 42 L31 37 L35 42" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M45 42 L49 37 L53 42" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          {/* Sparkles */}
          <path d="M12 18 L14 14 L16 18 L20 20 L16 22 L14 26 L12 22 L8 20 Z" fill="#fde047" className="mascot-sparkle" />
          <path d="M64 15 L65.5 12 L67 15 L70 16.5 L67 18 L65.5 21 L64 18 L61 16.5 Z" fill="#4ade80" className="mascot-sparkle mascot-sparkle--delay" />
        </g>
      )}

      {mood === 'turbo' && (
        <g>
          <path d="M25 39 H55" stroke="#f0abfc" strokeWidth="4" strokeLinecap="round" />
          <path d="M27 39 H53" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18 25 L23 29" stroke="#e879f9" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M62 25 L57 29" stroke="#e879f9" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {/* Subtle chin LED */}
      <rect x="34" y="57" width="12" height="2.4" rx="1.2" fill={palette.primary} opacity="0.7" />
    </svg>
  );
}

function PixelVisual({ mood }: { mood: MascotMood }): React.ReactElement {
  const palette = MOOD_COLORS[mood];
  const shellColor = mood === 'turbo' ? '#3b0764' : '#1e293b';
  const screenColor = '#090d16';

  return (
    <svg
      className={`mascot-svg mascot-svg--pixel mascot-mood--${mood}`}
      viewBox="0 0 16 16"
      width="74"
      height="74"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Antenna pixel */}
      <rect x="7" y="1" width="2" height="1" fill={palette.primary} className={mood === 'listening' ? 'mascot-pulse' : ''} />
      <rect x="7" y="2" width="2" height="1" fill="#64748b" />

      {/* Outer pixel chassis */}
      <rect x="3" y="3" width="10" height="1" fill="#475569" />
      <rect x="2" y="4" width="12" height="8" fill={shellColor} />
      <rect x="3" y="12" width="10" height="1" fill="#334155" />

      {/* Ears */}
      <rect x="1" y="6" width="1" height="4" fill={palette.primary} />
      <rect x="14" y="6" width="1" height="4" fill={palette.primary} />

      {/* Pixel screen */}
      <rect x="3" y="5" width="10" height="6" fill={screenColor} />

      {/* Mood expressions */}
      {mood === 'idle' && (
        <g className="mascot-eyes-blink">
          <rect x="5" y="7" width="2" height="2" fill="#38bdf8" />
          <rect x="9" y="7" width="2" height="2" fill="#38bdf8" />
        </g>
      )}

      {mood === 'listening' && (
        <g>
          <rect x="4" y="6" width="2" height="3" fill="#22d3ee" />
          <rect x="10" y="6" width="2" height="3" fill="#22d3ee" />
          <rect x="7" y="9" width="2" height="1" fill="#67e8f9" />
        </g>
      )}

      {mood === 'speaking' && (
        <g>
          <rect x="5" y="6" width="2" height="1" fill="#a5b4fc" />
          <rect x="9" y="6" width="2" height="1" fill="#a5b4fc" />
          <rect x="5" y="9" width="1" height="1" fill="#818cf8" className="mascot-bar--1" />
          <rect x="7" y="8" width="2" height="2" fill="#c7d2fe" className="mascot-bar--2" />
          <rect x="10" y="9" width="1" height="1" fill="#818cf8" className="mascot-bar--3" />
        </g>
      )}

      {mood === 'alert' && (
        <g>
          <rect x="7" y="5" width="2" height="3" fill="#fbbf24" className="mascot-pulse" />
          <rect x="7" y="9" width="2" height="1" fill="#ef4444" />
        </g>
      )}

      {mood === 'celebrating' && (
        <g>
          <rect x="4" y="7" width="1" height="1" fill="#4ade80" />
          <rect x="5" y="6" width="1" height="1" fill="#4ade80" />
          <rect x="6" y="7" width="1" height="1" fill="#4ade80" />
          <rect x="9" y="7" width="1" height="1" fill="#4ade80" />
          <rect x="10" y="6" width="1" height="1" fill="#4ade80" />
          <rect x="11" y="7" width="1" height="1" fill="#4ade80" />
          <rect x="2" y="2" width="1" height="1" fill="#fde047" className="mascot-sparkle" />
          <rect x="13" y="2" width="1" height="1" fill="#fde047" className="mascot-sparkle mascot-sparkle--delay" />
        </g>
      )}

      {mood === 'turbo' && (
        <g>
          {/* Cyber pixel shades */}
          <rect x="4" y="6" width="8" height="2" fill="#f0abfc" />
          <rect x="5" y="7" width="6" height="1" fill="#22d3ee" />
          <rect x="7" y="9" width="2" height="1" fill="#f472b6" />
        </g>
      )}

      {/* Pixel feet */}
      <rect x="4" y="13" width="2" height="1" fill="#475569" />
      <rect x="10" y="13" width="2" height="1" fill="#475569" />
    </svg>
  );
}

function OrbVisual({ mood }: { mood: MascotMood }): React.ReactElement {
  const palette = MOOD_COLORS[mood];
  return (
    <svg
      className={`mascot-svg mascot-svg--orb mascot-mood--${mood}`}
      viewBox="0 0 80 80"
      width="74"
      height="74"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`orbCore-${mood}`} cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor={palette.primary} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.98" />
        </radialGradient>
      </defs>

      {/* Outer aura */}
      <circle cx="40" cy="40" r="29" fill={palette.glow} opacity="0.35" className="mascot-orb-aura" />

      {/* Orbital Ring 1 */}
      <g className="mascot-orbit mascot-orbit--1">
        <ellipse
          cx="40"
          cy="40"
          rx="30"
          ry="11"
          transform="rotate(-24 40 40)"
          stroke={palette.primary}
          strokeWidth="1.6"
          strokeDasharray="18 8 6 8"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>

      {/* Orbital Ring 2 */}
      <g className="mascot-orbit mascot-orbit--2">
        <ellipse
          cx="40"
          cy="40"
          rx="27"
          ry="10"
          transform="rotate(32 40 40)"
          stroke="#e2e8f0"
          strokeWidth="1.2"
          strokeDasharray="12 10"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>

      {/* Core sphere */}
      <circle
        cx="40"
        cy="40"
        r="16.5"
        fill={`url(#orbCore-${mood})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
      />

      {/* Center glyph for alert / celebrating / speaking */}
      {mood === 'alert' && (
        <g>
          <rect x="38.5" y="32" width="3" height="9" rx="1.5" fill="#0f172a" />
          <circle cx="40" cy="45.5" r="1.8" fill="#0f172a" />
        </g>
      )}

      {mood === 'speaking' && (
        <circle cx="40" cy="40" r="9" stroke="#ffffff" strokeWidth="1.6" opacity="0.8" className="mascot-pulse" />
      )}

      {mood === 'celebrating' && (
        <>
          <circle cx="17" cy="20" r="2.2" fill="#fde047" className="mascot-sparkle" />
          <circle cx="64" cy="22" r="2" fill="#4ade80" className="mascot-sparkle mascot-sparkle--delay" />
          <circle cx="60" cy="61" r="1.8" fill="#fde047" className="mascot-sparkle" />
        </>
      )}
    </svg>
  );
}

function getBubbleMessage(
  mood: MascotMood,
  diagnosticsCount: number,
  hovered: boolean,
  tutorModeLabel?: string,
  ideConnected?: boolean,
): { text: string; clickable: boolean } | null {
  if (mood === 'alert' && diagnosticsCount > 0) {
    return { text: 'Vi erro na IDE — quer ajuda?', clickable: true };
  }
  if (mood === 'celebrating') {
    return { text: 'Boa! Mandou bem!', clickable: false };
  }
  if (mood === 'listening') {
    return { text: 'Ouvindo você...', clickable: false };
  }
  if (mood === 'speaking') {
    return { text: 'Falando...', clickable: false };
  }
  if (hovered) {
    if (mood === 'turbo') {
      return { text: 'Modo Turbo ativo', clickable: true };
    }
    const mode = tutorModeLabel ?? 'HUD';
    const ide = ideConnected ? 'IDE' : 'Offline';
    return { text: `${mode} · ${ide}`, clickable: true };
  }
  return null;
}

export function BotMascot({
  styleVariant,
  mood,
  diagnosticsCount = 0,
  isListening = false,
  isSpeaking = false,
  ideConnected = false,
  tutorModeLabel,
  onToggleVoice,
  onExpand,
  onHoverChange,
}: BotMascotProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    onHoverChange?.(false);
  };

  const bubble = getBubbleMessage(
    mood,
    diagnosticsCount,
    hovered,
    tutorModeLabel,
    ideConnected,
  );

  return (
    <div
      className="mascot-stage"
      role="region"
      aria-label="BotPrograCraft Mascote Interativo"
    >
      <div
        className={`mascot-interactive-zone ${hovered ? 'mascot-interactive-zone--hovered' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {bubble && (
          <button
            type="button"
            className={`mascot-bubble mascot-bubble--${mood} ${bubble.clickable ? 'mascot-bubble--clickable' : ''}`}
            onClick={() => {
              if (bubble.clickable) onExpand?.();
            }}
            title={bubble.clickable ? 'Clique para abrir o HUD' : undefined}
          >
            <span>{bubble.text}</span>
          </button>
        )}

        <div className={`mascot-body mascot-body--${mood}`} title="Arraste para mover o mascote">
          {styleVariant === 'robot' && <RobotVisual mood={mood} />}
          {styleVariant === 'pixel' && <PixelVisual mood={mood} />}
          {styleVariant === 'orb' && <OrbVisual mood={mood} />}
          {diagnosticsCount > 0 && (
            <span className="mascot-error-badge" aria-label={`${diagnosticsCount} erros na IDE`}>
              {diagnosticsCount > 9 ? '9+' : diagnosticsCount}
            </span>
          )}
        </div>

        <div className="mascot-actions" aria-label="Controles rápidos do mascote">
          <button
            type="button"
            className={`mascot-action-btn ${isListening ? 'mascot-action-btn--live' : isSpeaking ? 'mascot-action-btn--speaking' : ''}`}
            onClick={() => onToggleVoice?.()}
            aria-pressed={isListening}
            title={isListening ? 'Parar microfone' : 'Ativar microfone (Ctrl+Shift+Space)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <span>{isListening ? 'Live' : 'Mic'}</span>
          </button>

          <button
            type="button"
            className="mascot-action-btn"
            onClick={() => onExpand?.()}
            title="Expandir HUD"
            aria-label="Expandir HUD"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" x2="14" y1="3" y2="10" />
              <line x1="3" x2="10" y1="21" y2="14" />
            </svg>
            <span>HUD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
