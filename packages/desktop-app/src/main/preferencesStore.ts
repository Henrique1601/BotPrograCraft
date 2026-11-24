import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  clampHudOpacity,
  DEFAULT_SHORTCUTS,
  DEFAULT_USER_PREFERENCES,
  isHudTheme,
  isMascotStyle,
  type ShortcutConfig,
  type UserPreferences,
} from '@botprogracraft/shared';

export type PartialUserPreferences = Partial<Omit<UserPreferences, 'shortcuts'>> & {
  shortcuts?: Partial<ShortcutConfig>;
};

const PREFERENCES_FILENAME = 'preferences.json';

function cloneDefaultPreferences(): UserPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    shortcuts: { ...DEFAULT_SHORTCUTS },
  };
}

function atomicWriteFileSync(targetPath: string, data: string): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, data, 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

function normalizeShortcut(value: unknown, fallback: string): string {
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
export function normalizePreferences(
  raw: unknown,
  fallback: UserPreferences = cloneDefaultPreferences(),
): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return {
      ...fallback,
      shortcuts: { ...fallback.shortcuts },
    };
  }

  const obj = raw as Record<string, unknown>;
  const rawShortcuts =
    obj.shortcuts && typeof obj.shortcuts === 'object'
      ? (obj.shortcuts as Record<string, unknown>)
      : {};

  return {
    mascotStyle: isMascotStyle(obj.mascotStyle)
      ? obj.mascotStyle
      : fallback.mascotStyle,
    theme: isHudTheme(obj.theme) ? obj.theme : fallback.theme,
    opacity:
      typeof obj.opacity === 'number' && Number.isFinite(obj.opacity)
        ? clampHudOpacity(obj.opacity)
        : fallback.opacity,
    autoStart:
      typeof obj.autoStart === 'boolean' ? obj.autoStart : fallback.autoStart,
    shortcuts: {
      pushToTalk: normalizeShortcut(
        rawShortcuts.pushToTalk,
        fallback.shortcuts.pushToTalk,
      ),
      toggleCompact: normalizeShortcut(
        rawShortcuts.toggleCompact,
        fallback.shortcuts.toggleCompact,
      ),
      captureNow: normalizeShortcut(
        rawShortcuts.captureNow,
        fallback.shortcuts.captureNow,
      ),
    },
  };
}

/**
 * Loads user preferences from `<homeDir>/preferences.json`, falling back to
 * `DEFAULT_USER_PREFERENCES` when missing or invalid.
 */
export function loadPreferences(homeDir: string): UserPreferences {
  const prefsPath = path.join(homeDir, PREFERENCES_FILENAME);
  try {
    if (!fs.existsSync(prefsPath)) {
      return cloneDefaultPreferences();
    }
    const raw = fs.readFileSync(prefsPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return normalizePreferences(parsed, cloneDefaultPreferences());
  } catch {
    return cloneDefaultPreferences();
  }
}

/**
 * Merges `partial` into existing preferences, validates/clamps all fields,
 * atomically writes `<homeDir>/preferences.json`, and returns the saved object.
 */
export function savePreferences(
  homeDir: string,
  partial: PartialUserPreferences,
): UserPreferences {
  const current = loadPreferences(homeDir);
  const merged = normalizePreferences(
    {
      ...current,
      ...partial,
      shortcuts: {
        ...current.shortcuts,
        ...(partial.shortcuts ?? {}),
      },
    },
    current,
  );

  const prefsPath = path.join(homeDir, PREFERENCES_FILENAME);
  atomicWriteFileSync(prefsPath, JSON.stringify(merged, null, 2));
  return merged;
}
