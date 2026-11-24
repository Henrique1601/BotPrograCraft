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
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const shared_1 = require("@botprogracraft/shared");
const windowState_1 = require("../src/main/windowState");
const preferencesStore_1 = require("../src/main/preferencesStore");
(0, node_test_1.describe)('windowState persistence & multi-monitor validation', () => {
    let tmpHome;
    const primaryDisplay = {
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    const secondaryDisplay = {
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
    };
    (0, node_test_1.beforeEach)(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bpc-winstate-'));
    });
    (0, node_test_1.afterEach)(() => {
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });
    (0, node_test_1.it)('returns null when window-state.json does not exist', () => {
        const loaded = (0, windowState_1.loadWindowState)(tmpHome, [primaryDisplay]);
        assert.equal(loaded, null);
    });
    (0, node_test_1.it)('saves and loads valid coordinates within primary display', () => {
        (0, windowState_1.saveWindowState)(tmpHome, { x: 1400, y: 400 });
        const loaded = (0, windowState_1.loadWindowState)(tmpHome, [primaryDisplay]);
        assert.deepEqual(loaded, { x: 1400, y: 400 });
    });
    (0, node_test_1.it)('falls back to null when secondary monitor is disconnected', () => {
        (0, windowState_1.saveWindowState)(tmpHome, { x: 2400, y: 300 });
        const withSecondary = (0, windowState_1.loadWindowState)(tmpHome, [
            primaryDisplay,
            secondaryDisplay,
        ]);
        assert.deepEqual(withSecondary, { x: 2400, y: 300 });
        const withoutSecondary = (0, windowState_1.loadWindowState)(tmpHome, [primaryDisplay]);
        assert.equal(withoutSecondary, null);
    });
    (0, node_test_1.it)('requires at least 80x80px intersection with an active display workArea', () => {
        // Window width=420, height=560 -> at x=-360 overlapX is 60 (< 80)
        (0, windowState_1.saveWindowState)(tmpHome, { x: -360, y: 100 });
        assert.equal((0, windowState_1.loadWindowState)(tmpHome, [primaryDisplay]), null);
        // At x=-340 overlapX is 80 (>= 80) and overlapY is 560 (>= 80)
        (0, windowState_1.saveWindowState)(tmpHome, { x: -340, y: 100 });
        assert.deepEqual((0, windowState_1.loadWindowState)(tmpHome, [primaryDisplay]), {
            x: -340,
            y: 100,
        });
    });
    (0, node_test_1.it)('recovers gracefully from corrupted JSON', () => {
        fs.writeFileSync(path.join(tmpHome, 'window-state.json'), '{not-valid-json', 'utf8');
        assert.equal((0, windowState_1.loadWindowState)(tmpHome, [primaryDisplay]), null);
    });
});
(0, node_test_1.describe)('preferencesStore persistence & validation', () => {
    let tmpHome;
    (0, node_test_1.beforeEach)(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bpc-prefs-'));
    });
    (0, node_test_1.afterEach)(() => {
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });
    (0, node_test_1.it)('returns DEFAULT_USER_PREFERENCES when preferences.json does not exist', () => {
        const prefs = (0, preferencesStore_1.loadPreferences)(tmpHome);
        assert.deepEqual(prefs, shared_1.DEFAULT_USER_PREFERENCES);
    });
    (0, node_test_1.it)('saves partial updates and preserves existing fields', () => {
        (0, preferencesStore_1.savePreferences)(tmpHome, {
            mascotStyle: 'pixel',
            theme: 'emerald',
            shortcuts: { captureNow: 'CommandOrControl+Alt+S' },
        });
        const updated = (0, preferencesStore_1.savePreferences)(tmpHome, {
            theme: 'cyberpunk',
            autoStart: true,
        });
        assert.equal(updated.mascotStyle, 'pixel');
        assert.equal(updated.theme, 'cyberpunk');
        assert.equal(updated.autoStart, true);
        assert.equal(updated.shortcuts.captureNow, 'CommandOrControl+Alt+S');
        assert.equal(updated.shortcuts.pushToTalk, shared_1.DEFAULT_SHORTCUTS.pushToTalk);
        assert.equal(updated.shortcuts.toggleCompact, shared_1.DEFAULT_SHORTCUTS.toggleCompact);
        const reloaded = (0, preferencesStore_1.loadPreferences)(tmpHome);
        assert.deepEqual(reloaded, updated);
    });
    (0, node_test_1.it)('clamps opacity to [0.55, 1.0]', () => {
        const low = (0, preferencesStore_1.savePreferences)(tmpHome, { opacity: 0.1 });
        assert.equal(low.opacity, shared_1.MIN_HUD_OPACITY);
        const high = (0, preferencesStore_1.savePreferences)(tmpHome, { opacity: 2.5 });
        assert.equal(high.opacity, shared_1.MAX_HUD_OPACITY);
        const valid = (0, preferencesStore_1.savePreferences)(tmpHome, { opacity: 0.78 });
        assert.equal(valid.opacity, 0.78);
    });
    (0, node_test_1.it)('rejects invalid theme/mascotStyle and recovers from corrupted JSON', () => {
        (0, preferencesStore_1.savePreferences)(tmpHome, { mascotStyle: 'orb', theme: 'emerald' });
        const afterInvalid = (0, preferencesStore_1.savePreferences)(tmpHome, {
            mascotStyle: 'invalid-style',
            theme: 'neon-pink',
        });
        assert.equal(afterInvalid.mascotStyle, 'orb');
        assert.equal(afterInvalid.theme, 'emerald');
        fs.writeFileSync(path.join(tmpHome, 'preferences.json'), '<<<corrupted>>>', 'utf8');
        const recovered = (0, preferencesStore_1.loadPreferences)(tmpHome);
        assert.deepEqual(recovered, shared_1.DEFAULT_USER_PREFERENCES);
    });
});
//# sourceMappingURL=preferencesAndWindow.test.js.map