import { type LiveScreenSnapshot } from './stateReader';
export type ScreenCaptureExecFn = (jpgPath: string, metaPath: string) => Promise<void>;
export interface CaptureWindowsScreenOptions {
    homeDir?: string;
    execCapture?: ScreenCaptureExecFn;
    timeoutMs?: number;
}
/**
 * Captures the primary Windows screen as a JPEG into `<home>/latest-frame.jpg`
 * and writes `<home>/latest-frame.meta.json`, returning the resulting frame snapshot.
 */
export declare function captureWindowsScreenJpeg(options?: CaptureWindowsScreenOptions): Promise<LiveScreenSnapshot | null>;
//# sourceMappingURL=screenFallback.d.ts.map