import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  getBotPrograCraftHome,
  readLatestFrame,
  type LiveScreenSnapshot,
} from './stateReader';

const execFileAsync = promisify(execFile);

export type ScreenCaptureExecFn = (
  jpgPath: string,
  metaPath: string,
) => Promise<void>;

export interface CaptureWindowsScreenOptions {
  homeDir?: string;
  execCapture?: ScreenCaptureExecFn;
  timeoutMs?: number;
}

const POWERSHELL_CAPTURE_SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms',
  'Add-Type -AssemblyName System.Drawing',
  '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
  '$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height',
  '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
  'try {',
  '  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
  '  $bitmap.Save($env:BPC_OUT_JPG, [System.Drawing.Imaging.ImageFormat]::Jpeg)',
  '} finally {',
  '  $graphics.Dispose()',
  '  $bitmap.Dispose()',
  '}',
  '$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()',
  '@{ width = $bounds.Width; height = $bounds.Height; timestamp = $ts } | ConvertTo-Json -Compress | Set-Content -Path $env:BPC_OUT_META -Encoding UTF8',
].join('; ');

async function runPowerShellCapture(
  jpgPath: string,
  metaPath: string,
  timeoutMs: number,
): Promise<void> {
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      POWERSHELL_CAPTURE_SCRIPT,
    ],
    {
      timeout: timeoutMs,
      env: {
        ...process.env,
        BPC_OUT_JPG: jpgPath,
        BPC_OUT_META: metaPath,
      },
    },
  );
}

/**
 * Captures the primary Windows screen as a JPEG into `<home>/latest-frame.jpg`
 * and writes `<home>/latest-frame.meta.json`, returning the resulting frame snapshot.
 */
export async function captureWindowsScreenJpeg(
  options: CaptureWindowsScreenOptions = {},
): Promise<LiveScreenSnapshot | null> {
  if (!options.execCapture && process.platform !== 'win32') {
    return null;
  }

  const home = getBotPrograCraftHome(options.homeDir);
  fs.mkdirSync(home, { recursive: true });

  const jpgPath = path.join(home, 'latest-frame.jpg');
  const metaPath = path.join(home, 'latest-frame.meta.json');
  const timeoutMs = options.timeoutMs ?? 10_000;

  if (options.execCapture) {
    await options.execCapture(jpgPath, metaPath);
  } else {
    await runPowerShellCapture(jpgPath, metaPath, timeoutMs);
  }

  return readLatestFrame(home);
}
