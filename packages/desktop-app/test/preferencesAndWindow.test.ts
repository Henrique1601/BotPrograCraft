import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DEFAULT_SHORTCUTS,
  DEFAULT_USER_PREFERENCES,
  MAX_HUD_OPACITY,
  MIN_HUD_OPACITY,
} from '@botprogracraft/shared';
import {
  loadWindowState,
  saveWindowState,
  type DisplayLike,
} from '../src/main/windowState';
import {
  loadPreferences,
  savePreferences,
} from '../src/main/preferencesStore';

describe('windowState persistence & multi-monitor validation', () => {
  let tmpHome: string;

  const primaryDisplay: DisplayLike = {
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  };
  const secondaryDisplay: DisplayLike = {
    workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
  };

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bpc-winstate-'));
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('returns null when window-state.json does not exist', () => {
    const loaded = loadWindowState(tmpHome, [primaryDisplay]);
    assert.equal(loaded, null);
  });

  it('saves and loads valid coordinates within primary display', () => {
    saveWindowState(tmpHome, { x: 1400, y: 400 });
    const loaded = loadWindowState(tmpHome, [primaryDisplay]);
    assert.deepEqual(loaded, { x: 1400, y: 400 });
  });

  it('falls back to null when secondary monitor is disconnected', () => {
    saveWindowState(tmpHome, { x: 2400, y: 300 });

    const withSecondary = loadWindowState(tmpHome, [
      primaryDisplay,
      secondaryDisplay,
    ]);
    assert.deepEqual(withSecondary, { x: 2400, y: 300 });

    const withoutSecondary = loadWindowState(tmpHome, [primaryDisplay]);
    assert.equal(withoutSecondary, null);
  });

  it('requires at least 80x80px intersection with an active display workArea', () => {
    // Window width=420, height=560 -> at x=-360 overlapX is 60 (< 80)
    saveWindowState(tmpHome, { x: -360, y: 100 });
    assert.equal(loadWindowState(tmpHome, [primaryDisplay]), null);

    // At x=-340 overlapX is 80 (>= 80) and overlapY is 560 (>= 80)
    saveWindowState(tmpHome, { x: -340, y: 100 });
    assert.deepEqual(loadWindowState(tmpHome, [primaryDisplay]), {
      x: -340,
      y: 100,
    });
  });

  it('recovers gracefully from corrupted JSON', () => {
    fs.writeFileSync(
      path.join(tmpHome, 'window-state.json'),
      '{not-valid-json',
      'utf8',
    );
    assert.equal(loadWindowState(tmpHome, [primaryDisplay]), null);
  });
});

describe('preferencesStore persistence & validation', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bpc-prefs-'));
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('returns DEFAULT_USER_PREFERENCES when preferences.json does not exist', () => {
    const prefs = loadPreferences(tmpHome);
    assert.deepEqual(prefs, DEFAULT_USER_PREFERENCES);
  });

  it('saves partial updates and preserves existing fields', () => {
    savePreferences(tmpHome, {
      mascotStyle: 'pixel',
      theme: 'emerald',
      shortcuts: { captureNow: 'CommandOrControl+Alt+S' },
    });

    const updated = savePreferences(tmpHome, {
      theme: 'cyberpunk',
      autoStart: true,
    });

    assert.equal(updated.mascotStyle, 'pixel');
    assert.equal(updated.theme, 'cyberpunk');
    assert.equal(updated.autoStart, true);
    assert.equal(updated.shortcuts.captureNow, 'CommandOrControl+Alt+S');
    assert.equal(updated.shortcuts.pushToTalk, DEFAULT_SHORTCUTS.pushToTalk);
    assert.equal(updated.shortcuts.toggleCompact, DEFAULT_SHORTCUTS.toggleCompact);

    const reloaded = loadPreferences(tmpHome);
    assert.deepEqual(reloaded, updated);
  });

  it('clamps opacity to [0.55, 1.0]', () => {
    const low = savePreferences(tmpHome, { opacity: 0.1 });
    assert.equal(low.opacity, MIN_HUD_OPACITY);

    const high = savePreferences(tmpHome, { opacity: 2.5 });
    assert.equal(high.opacity, MAX_HUD_OPACITY);

    const valid = savePreferences(tmpHome, { opacity: 0.78 });
    assert.equal(valid.opacity, 0.78);
  });

  it('rejects invalid theme/mascotStyle and recovers from corrupted JSON', () => {
    savePreferences(tmpHome, { mascotStyle: 'orb', theme: 'emerald' });

    const afterInvalid = savePreferences(tmpHome, {
      mascotStyle: 'invalid-style' as unknown as 'robot',
      theme: 'neon-pink' as unknown as 'cyan',
    });
    assert.equal(afterInvalid.mascotStyle, 'orb');
    assert.equal(afterInvalid.theme, 'emerald');

    fs.writeFileSync(
      path.join(tmpHome, 'preferences.json'),
      '<<<corrupted>>>',
      'utf8',
    );
    const recovered = loadPreferences(tmpHome);
    assert.deepEqual(recovered, DEFAULT_USER_PREFERENCES);
  });
});
