import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WindowPosition {
  x: number;
  y: number;
}

export interface DisplayWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayLike {
  workArea: DisplayWorkArea;
}

export interface WindowSize {
  width: number;
  height: number;
}

export const DEFAULT_WINDOW_SIZE: WindowSize = {
  width: 420,
  height: 560,
};

const MIN_VISIBLE_INTERSECTION_PX = 80;
const WINDOW_STATE_FILENAME = 'window-state.json';

function atomicWriteFileSync(targetPath: string, data: string): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, data, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Checks whether a window at `pos` with `windowSize` has at least
 * MIN_VISIBLE_INTERSECTION_PX of overlap with at least one active display's workArea.
 */
export function isPositionVisibleOnDisplays(
  pos: WindowPosition,
  displays: readonly DisplayLike[],
  windowSize: WindowSize = DEFAULT_WINDOW_SIZE,
): boolean {
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
    return false;
  }
  if (displays.length === 0) {
    return false;
  }

  const winWidth = Math.max(1, windowSize.width);
  const winHeight = Math.max(1, windowSize.height);
  const minXOverlap = Math.min(MIN_VISIBLE_INTERSECTION_PX, winWidth);
  const minYOverlap = Math.min(MIN_VISIBLE_INTERSECTION_PX, winHeight);

  return displays.some(({ workArea }) => {
    const overlapX =
      Math.min(pos.x + winWidth, workArea.x + workArea.width) -
      Math.max(pos.x, workArea.x);
    const overlapY =
      Math.min(pos.y + winHeight, workArea.y + workArea.height) -
      Math.max(pos.y, workArea.y);
    return overlapX >= minXOverlap && overlapY >= minYOverlap;
  });
}

/**
 * Loads the persisted window position from `<homeDir>/window-state.json`
 * and validates that it intersects with at least one connected display.
 * Returns `null` if missing, corrupted, or off-screen.
 */
export function loadWindowState(
  homeDir: string,
  displays: readonly DisplayLike[],
  windowSize: WindowSize = DEFAULT_WINDOW_SIZE,
): WindowPosition | null {
  const statePath = path.join(homeDir, WINDOW_STATE_FILENAME);
  try {
    if (!fs.existsSync(statePath)) {
      return null;
    }
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const candidate = parsed as Partial<WindowPosition>;
    if (
      typeof candidate.x !== 'number' ||
      typeof candidate.y !== 'number' ||
      !Number.isFinite(candidate.x) ||
      !Number.isFinite(candidate.y)
    ) {
      return null;
    }

    const pos: WindowPosition = {
      x: Math.round(candidate.x),
      y: Math.round(candidate.y),
    };

    if (!isPositionVisibleOnDisplays(pos, displays, windowSize)) {
      return null;
    }

    return pos;
  } catch {
    return null;
  }
}

/**
 * Atomically persists the window `(x, y)` coordinates to `<homeDir>/window-state.json`.
 */
export function saveWindowState(homeDir: string, pos: WindowPosition): void {
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
    return;
  }
  const statePath = path.join(homeDir, WINDOW_STATE_FILENAME);
  const payload = {
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    updatedAt: Date.now(),
  };
  atomicWriteFileSync(statePath, JSON.stringify(payload, null, 2));
}
