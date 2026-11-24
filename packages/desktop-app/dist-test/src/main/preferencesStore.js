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
exports.normalizePreferences = normalizePreferences;
exports.loadPreferences = loadPreferences;
exports.savePreferences = savePreferences;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const shared_1 = require("@botprogracraft/shared");
const PREFERENCES_FILENAME = 'preferences.json';
function cloneDefaultPreferences() {
    return {
        ...shared_1.DEFAULT_USER_PREFERENCES,
        shortcuts: { ...shared_1.DEFAULT_SHORTCUTS },
    };
}
function atomicWriteFileSync(targetPath, data) {
    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, data, 'utf8');
    fs.renameSync(tmpPath, targetPath);
}
function normalizeShortcut(value, fallback) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return fallback;
}
/**
 * Validates and normalizes an untrusted preferences object against a safe fallback.
 */
function normalizePreferences(raw, fallback = cloneDefaultPreferences()) {
    if (!raw || typeof raw !== 'object') {
        return {
            ...fallback,
            shortcuts: { ...fallback.shortcuts },
        };
    }
    const obj = raw;
    const rawShortcuts = obj.shortcuts && typeof obj.shortcuts === 'object'
        ? obj.shortcuts
        : {};
    return {
        mascotStyle: (0, shared_1.isMascotStyle)(obj.mascotStyle)
            ? obj.mascotStyle
            : fallback.mascotStyle,
        theme: (0, shared_1.isHudTheme)(obj.theme) ? obj.theme : fallback.theme,
        opacity: typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
            ? (0, shared_1.clampHudOpacity)(obj.opacity)
            : fallback.opacity,
        autoStart: typeof obj.autoStart === 'boolean' ? obj.autoStart : fallback.autoStart,
        shortcuts: {
            pushToTalk: normalizeShortcut(rawShortcuts.pushToTalk, fallback.shortcuts.pushToTalk),
            toggleCompact: normalizeShortcut(rawShortcuts.toggleCompact, fallback.shortcuts.toggleCompact),
            captureNow: normalizeShortcut(rawShortcuts.captureNow, fallback.shortcuts.captureNow),
        },
    };
}
/**
 * Loads user preferences from `<homeDir>/preferences.json`, falling back to
 * `DEFAULT_USER_PREFERENCES` when missing or invalid.
 */
function loadPreferences(homeDir) {
    const prefsPath = path.join(homeDir, PREFERENCES_FILENAME);
    try {
        if (!fs.existsSync(prefsPath)) {
            return cloneDefaultPreferences();
        }
        const raw = fs.readFileSync(prefsPath, 'utf8');
        const parsed = JSON.parse(raw);
        return normalizePreferences(parsed, cloneDefaultPreferences());
    }
    catch {
        return cloneDefaultPreferences();
    }
}
/**
 * Merges `partial` into existing preferences, validates/clamps all fields,
 * atomically writes `<homeDir>/preferences.json`, and returns the saved object.
 */
function savePreferences(homeDir, partial) {
    const current = loadPreferences(homeDir);
    const merged = normalizePreferences({
        ...current,
        ...partial,
        shortcuts: {
            ...current.shortcuts,
            ...(partial.shortcuts ?? {}),
        },
    }, current);
    const prefsPath = path.join(homeDir, PREFERENCES_FILENAME);
    atomicWriteFileSync(prefsPath, JSON.stringify(merged, null, 2));
    return merged;
}
//# sourceMappingURL=preferencesStore.js.map