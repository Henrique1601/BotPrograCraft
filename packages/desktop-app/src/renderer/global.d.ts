import type { DesktopBridgeApi } from '../main/ipcTypes';

export interface ProgressStats {
  totalAttempts: number;
  passedAttempts: number;
  totalMessages: number;
  recurringErrorCount: number;
}

export interface RecentAttempt {
  id: number;
  title: string;
  mode: string;
  passed: boolean;
  score: number | null;
  createdAt: string;
}

export interface ProgressBridgeExtension {
  getProgressStats?: () => Promise<ProgressStats>;
  listRecentAttempts?: (limit?: number) => Promise<RecentAttempt[]>;
}

declare global {
  interface Window {
    botprogracraft: DesktopBridgeApi & ProgressBridgeExtension;
  }
}

export {};
