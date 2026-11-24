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
exports.DEFAULT_WINDOW_SIZE = void 0;
exports.isPositionVisibleOnDisplays = isPositionVisibleOnDisplays;
exports.loadWindowState = loadWindowState;
exports.saveWindowState = saveWindowState;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
exports.DEFAULT_WINDOW_SIZE = {
    width: 420,
    height: 560,
};
const MIN_VISIBLE_INTERSECTION_PX = 80;
const WINDOW_STATE_FILENAME = 'window-state.json';
function atomicWriteFileSync(targetPath, data) {
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
function isPositionVisibleOnDisplays(pos, displays, windowSize = exports.DEFAULT_WINDOW_SIZE) {
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
        const overlapX = Math.min(pos.x + winWidth, workArea.x + workArea.width) -
            Math.max(pos.x, workArea.x);
        const overlapY = Math.min(pos.y + winHeight, workArea.y + workArea.height) -
            Math.max(pos.y, workArea.y);
        return overlapX >= minXOverlap && overlapY >= minYOverlap;
    });
}
/**
 * Loads the persisted window position from `<homeDir>/window-state.json`
 * and validates that it intersects with at least one connected display.
 * Returns `null` if missing, corrupted, or off-screen.
 */
function loadWindowState(homeDir, displays, windowSize = exports.DEFAULT_WINDOW_SIZE) {
    const statePath = path.join(homeDir, WINDOW_STATE_FILENAME);
    try {
        if (!fs.existsSync(statePath)) {
            return null;
        }
        const raw = fs.readFileSync(statePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        const candidate = parsed;
        if (typeof candidate.x !== 'number' ||
            typeof candidate.y !== 'number' ||
            !Number.isFinite(candidate.x) ||
            !Number.isFinite(candidate.y)) {
            return null;
        }
        const pos = {
            x: Math.round(candidate.x),
            y: Math.round(candidate.y),
        };
        if (!isPositionVisibleOnDisplays(pos, displays, windowSize)) {
            return null;
        }
        return pos;
    }
    catch {
        return null;
    }
}
/**
 * Atomically persists the window `(x, y)` coordinates to `<homeDir>/window-state.json`.
 */
function saveWindowState(homeDir, pos) {
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
//# sourceMappingURL=windowState.js.map