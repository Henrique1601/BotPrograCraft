"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBotPrograCraftHome = getBotPrograCraftHome;
exports.readLiveState = readLiveState;
exports.readLatestFrame = readLatestFrame;
exports.openProgressRepository = openProgressRepository;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const shared_1 = require("@botprogracraft/shared");
const storage_1 = require("@botprogracraft/storage");
const LIVE_STATE_FILENAME = 'live-state.json';
const LATEST_FRAME_FILENAME = 'latest-frame.jpg';
const LATEST_FRAME_META_FILENAME = 'latest-frame.meta.json';
const DATABASE_FILENAME = 'botprogracraft.db';
/**
 * Resolves the shared BotPrograCraft state directory.
 * Respects an explicit override, then `process.env.BOTPROGRACRAFT_HOME`,
 * falling back to `~/.botprogracraft`.
 */
function getBotPrograCraftHome(homeOverride) {
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
function isNodeError(error) {
    return error instanceof Error && 'code' in error;
}
function readJsonFileIfExists(filePath) {
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    }
    catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    return parsed;
}
/**
 * Reads `live-state.json` from the shared BotPrograCraft home directory.
 * Returns `null` if the file does not exist yet.
 */
function readLiveState(homeOverride) {
    const home = getBotPrograCraftHome(homeOverride);
    const parsed = readJsonFileIfExists(path.join(home, LIVE_STATE_FILENAME));
    if (!parsed) {
        return null;
    }
    const ideContext = parsed.ideContext !== null &&
        typeof parsed.ideContext === 'object' &&
        !Array.isArray(parsed.ideContext)
        ? parsed.ideContext
        : null;
    const tutorMode = (0, shared_1.isTutorMode)(parsed.tutorMode) ? parsed.tutorMode : null;
    const updatedAt = typeof parsed.updatedAt === 'string' || typeof parsed.updatedAt === 'number'
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
function readLatestFrame(homeOverride) {
    const home = getBotPrograCraftHome(homeOverride);
    const framePath = path.join(home, LATEST_FRAME_FILENAME);
    let frameBuffer;
    try {
        frameBuffer = fs.readFileSync(framePath);
    }
    catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
    let meta = {
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
                timestamp: typeof parsedMeta.timestamp === 'number' || typeof parsedMeta.timestamp === 'string'
                    ? parsedMeta.timestamp
                    : null,
            };
        }
    }
    catch {
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
function openProgressRepository(homeOverride) {
    const home = getBotPrograCraftHome(homeOverride);
    fs.mkdirSync(home, { recursive: true });
    const dbPath = path.join(home, DATABASE_FILENAME);
    return new storage_1.ProgressRepository({ dbPath });
}
//# sourceMappingURL=stateReader.js.map