import { type ShortcutConfig, type UserPreferences } from '@botprogracraft/shared';
export type PartialUserPreferences = Partial<Omit<UserPreferences, 'shortcuts'>> & {
    shortcuts?: Partial<ShortcutConfig>;
};
/**
 * Validates and normalizes an untrusted preferences object against a safe fallback.
 */
export declare function normalizePreferences(raw: unknown, fallback?: UserPreferences): UserPreferences;
/**
 * Loads user preferences from `<homeDir>/preferences.json`, falling back to
 * `DEFAULT_USER_PREFERENCES` when missing or invalid.
 */
export declare function loadPreferences(homeDir: string): UserPreferences;
/**
 * Merges `partial` into existing preferences, validates/clamps all fields,
 * atomically writes `<homeDir>/preferences.json`, and returns the saved object.
 */
export declare function savePreferences(homeDir: string, partial: PartialUserPreferences): UserPreferences;
//# sourceMappingURL=preferencesStore.d.ts.map