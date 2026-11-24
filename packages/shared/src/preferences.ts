/**
 * Selectable visual styles for the on-screen BotPrograCraft mascot.
 */
export type MascotStyle = 'robot' | 'pixel' | 'orb';

export const MASCOT_STYLES: readonly MascotStyle[] = ['robot', 'pixel', 'orb'];

export function isMascotStyle(value: unknown): value is MascotStyle {
  return typeof value === 'string' && (MASCOT_STYLES as readonly string[]).includes(value);
}

/**
 * Selectable color themes for the floating HUD.
 */
export type HudTheme = 'cyan' | 'emerald' | 'cyberpunk';

export const HUD_THEMES: readonly HudTheme[] = ['cyan', 'emerald', 'cyberpunk'];

export function isHudTheme(value: unknown): value is HudTheme {
  return typeof value === 'string' && (HUD_THEMES as readonly string[]).includes(value);
}

/**
 * Customizable global keyboard shortcuts (Electron accelerator strings).
 */
export interface ShortcutConfig {
  pushToTalk: string;
  toggleCompact: string;
  captureNow: string;
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  pushToTalk: 'CommandOrControl+Shift+Space',
  toggleCompact: 'CommandOrControl+Shift+M',
  captureNow: 'CommandOrControl+Shift+S',
};

/**
 * Persisted user preferences stored in ~/.botprogracraft/preferences.json.
 */
export interface UserPreferences {
  mascotStyle: MascotStyle;
  theme: HudTheme;
  /** Opacity between 0.55 and 1.0 */
  opacity: number;
  autoStart: boolean;
  shortcuts: ShortcutConfig;
}

export const MIN_HUD_OPACITY = 0.55;
export const MAX_HUD_OPACITY = 1.0;

export function clampHudOpacity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.96;
  }
  return Math.min(MAX_HUD_OPACITY, Math.max(MIN_HUD_OPACITY, Math.round(value * 100) / 100));
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  mascotStyle: 'robot',
  theme: 'cyan',
  opacity: 0.96,
  autoStart: false,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};
