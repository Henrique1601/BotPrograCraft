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

export interface RendererDesktopBridgeApi extends DesktopBridgeApi {
  setIgnoreMouseEvents?: (ignore: boolean) => Promise<void>;
}

declare global {
  interface Window {
    botprogracraft: RendererDesktopBridgeApi;
  }
}

export {};
