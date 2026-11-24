import { BrowserWindow, screen } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { WindowPosition } from './windowState';

export interface OverlayWindowOptions {
  preloadPath: string;
  rendererHtmlPath: string;
  devServerUrl?: string;
  iconPath?: string;
  initialPosition?: WindowPosition | null;
}

export function createOverlayWindow(options: OverlayWindowOptions): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 420;
  const height = 560;
  const margin = 20;
  const x = options.initialPosition?.x ?? workArea.x + workArea.width - width - margin;
  const y = options.initialPosition?.y ?? workArea.y + workArea.height - height - margin;

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 360,
    minHeight: 420,
    x,
    y,
    icon: options.iconPath,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const allowedDevOrigin = options.devServerUrl
    ? new URL(options.devServerUrl).origin
    : null;
  const allowedFileUrl = pathToFileURL(path.resolve(options.rendererHtmlPath)).href;

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      if (allowedDevOrigin) {
        const targetOrigin = new URL(navigationUrl).origin;
        if (targetOrigin === allowedDevOrigin) {
          return;
        }
      } else if (
        navigationUrl === allowedFileUrl ||
        navigationUrl.startsWith(`${allowedFileUrl}#`)
      ) {
        return;
      }
    } catch {
      // Invalid navigation URL; deny below.
    }
    event.preventDefault();
  });

  if (options.devServerUrl) {
    void win.loadURL(options.devServerUrl);
  } else {
    void win.loadFile(path.resolve(options.rendererHtmlPath));
  }

  return win;
}
