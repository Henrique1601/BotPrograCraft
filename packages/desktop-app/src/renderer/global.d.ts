import type { ShortcutConfig, TutorMode, UserPreferences } from '@botprogracraft/shared';
import type {
  DesktopBridgeApi,
  ProgressStatsSummary,
  RecentAttemptSummary,
  RecurringErrorSummary,
  ScreenFramePreview,
} from '../main/ipcTypes';
import type { CaptureSourceSummary } from '../main/screenCapture';

export type ProgressStats = ProgressStatsSummary;
export type RecentAttempt = RecentAttemptSummary;
export type RecurringError = RecurringErrorSummary;
export type { CaptureSourceSummary, ScreenFramePreview };

export interface PreferencesUpdateResponse {
  preferences?: UserPreferences;
  shortcutErrors?: Partial<Record<keyof ShortcutConfig, string>>;
  warnings?: string[];
  autoStartSupported?: boolean;
  error?: string;
}

export interface RendererDesktopBridgeApi extends DesktopBridgeApi {
  setIgnoreMouseEvents?: (ignore: boolean) => Promise<void>;
  getPreferences?: () => Promise<UserPreferences>;
  updatePreferences?: (
    patch: Partial<UserPreferences>,
  ) => Promise<UserPreferences | PreferencesUpdateResponse>;
  showMascotContextMenu?: () => Promise<void>;
  onPreferencesUpdated?: (cb: (prefs: UserPreferences) => void) => () => void;
  onToggleCompact?: (cb: () => void) => () => void;
  onTutorModeUpdated?: (cb: (mode: TutorMode) => void) => () => void;
}

declare global {
  interface Window {
    botprogracraft: RendererDesktopBridgeApi;
  }
}

export {};
