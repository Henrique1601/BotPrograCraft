import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isTutorMode, type IdeContextPayload, type TutorMode } from '@botprogracraft/shared';
import { ProgressRepository } from '@botprogracraft/storage';

export interface LiveStateSnapshot {
  ideContext: IdeContextPayload | null;
  tutorMode: TutorMode | null;
  updatedAt: string | number | null;
}

export interface LiveFrameMeta {
  width: number | null;
  height: number | null;
  timestamp: number | string | null;
}

export interface LiveScreenSnapshot extends LiveFrameMeta {
  imageBase64: string;
  mimeType: 'image/jpeg';
}

const LIVE_STATE_FILENAME = 'live-state.json';
const LATEST_FRAME_FILENAME = 'latest-frame.jpg';
const LATEST_FRAME_META_FILENAME = 'latest-frame.meta.json';
const DATABASE_FILENAME = 'botprogracraft.db';

/**
 * Resolves the shared BotPrograCraft state directory.
 * Respects an explicit override, then `process.env.BOTPROGRACRAFT_HOME`,
 * falling back to `~/.botprogracraft`.
 */
export function getBotPrograCraftHome(homeOverride?: string): string {
  const explicit = homeOverride?.trim();
  if (explicit) {
    return path.resolve(explicit);
  }

  const fromEnv = process.env.BOTPROGRACRAFT_HOME?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  return path.join(os.homedir(), '.botprogracraft');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function readJsonFileIfExists(filePath: string): Record<string, unknown> | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

/**
 * Reads `live-state.json` from the shared BotPrograCraft home directory.
 * Returns `null` if the file does not exist yet.
 */
export function readLiveState(homeOverride?: string): LiveStateSnapshot | null {
  const home = getBotPrograCraftHome(homeOverride);
  const parsed = readJsonFileIfExists(path.join(home, LIVE_STATE_FILENAME));
  if (!parsed) {
    return null;
  }

  const ideContext =
    parsed.ideContext !== null &&
    typeof parsed.ideContext === 'object' &&
    !Array.isArray(parsed.ideContext)
      ? (parsed.ideContext as IdeContextPayload)
      : null;

  const tutorMode = isTutorMode(parsed.tutorMode) ? parsed.tutorMode : null;
  const updatedAt =
    typeof parsed.updatedAt === 'string' || typeof parsed.updatedAt === 'number'
      ? parsed.updatedAt
      : null;

  return {
    ideContext,
    tutorMode,
    updatedAt,
  };
}

/**
 * Reads `latest-frame.jpg` and optional `latest-frame.meta.json` from the shared
 * BotPrograCraft home directory. Returns `null` if no frame has been captured yet.
 */
export function readLatestFrame(homeOverride?: string): LiveScreenSnapshot | null {
  const home = getBotPrograCraftHome(homeOverride);
  const framePath = path.join(home, LATEST_FRAME_FILENAME);

  let frameBuffer: Buffer;
  try {
    frameBuffer = fs.readFileSync(framePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  let meta: LiveFrameMeta = {
    width: null,
    height: null,
    timestamp: null,
  };

  try {
    const parsedMeta = readJsonFileIfExists(path.join(home, LATEST_FRAME_META_FILENAME));
    if (parsedMeta) {
      meta = {
        width: typeof parsedMeta.width === 'number' ? parsedMeta.width : null,
        height: typeof parsedMeta.height === 'number' ? parsedMeta.height : null,
        timestamp:
          typeof parsedMeta.timestamp === 'number' || typeof parsedMeta.timestamp === 'string'
            ? parsedMeta.timestamp
            : null,
      };
    }
  } catch {
    // Metadata is optional; keep null fields if meta JSON is temporarily unreadable.
  }

  return {
    imageBase64: frameBuffer.toString('base64'),
    mimeType: 'image/jpeg',
    ...meta,
  };
}

/**
 * Opens the shared SQLite `ProgressRepository` at `<home>/botprogracraft.db`.
 * Callers should invoke `repo.close()` when finished to avoid holding file locks.
 */
export function openProgressRepository(homeOverride?: string): ProgressRepository {
  const home = getBotPrograCraftHome(homeOverride);
  fs.mkdirSync(home, { recursive: true });
  const dbPath = path.join(home, DATABASE_FILENAME);
  return new ProgressRepository({ dbPath });
}
