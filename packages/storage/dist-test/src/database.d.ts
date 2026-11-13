import { DatabaseSync } from 'node:sqlite';
/**
 * Configuration options for initializing the BotPrograCraft SQLite database.
 */
export interface DatabaseOptions {
    /**
     * File path for the SQLite database, or `':memory:'` for an ephemeral in-memory database.
     * Defaults to `':memory:'`.
     */
    dbPath?: string;
    /**
     * Maximum time in milliseconds SQLite waits when the database is locked.
     * Defaults to `5000`.
     */
    busyTimeoutMs?: number;
}
/**
 * Idempotent DDL schema for BotPrograCraft local progress, error tracking, and session history.
 */
export declare const SCHEMA_SQL = "\nCREATE TABLE IF NOT EXISTS exercise_attempts (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  title TEXT NOT NULL,\n  mode TEXT NOT NULL,\n  language_id TEXT NOT NULL,\n  prompt TEXT NOT NULL,\n  user_code TEXT NOT NULL,\n  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),\n  score REAL NOT NULL CHECK (score >= 0 AND score <= 100),\n  feedback_json TEXT NOT NULL DEFAULT '{}',\n  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_exercise_attempts_created_at\n  ON exercise_attempts (created_at DESC, id DESC);\n\nCREATE INDEX IF NOT EXISTS idx_exercise_attempts_mode_lang\n  ON exercise_attempts (mode, language_id, passed);\n\nCREATE TABLE IF NOT EXISTS recurring_errors (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  error_signature TEXT NOT NULL,\n  language_id TEXT NOT NULL,\n  file_path TEXT NOT NULL DEFAULT '',\n  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),\n  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n  notes TEXT,\n  UNIQUE (error_signature, language_id, file_path)\n);\n\nCREATE INDEX IF NOT EXISTS idx_recurring_errors_rank\n  ON recurring_errors (occurrence_count DESC, last_seen_at DESC);\n\nCREATE INDEX IF NOT EXISTS idx_recurring_errors_language\n  ON recurring_errors (language_id, occurrence_count DESC);\n\nCREATE TABLE IF NOT EXISTS session_messages (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  session_id TEXT NOT NULL,\n  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),\n  mode TEXT NOT NULL,\n  content TEXT NOT NULL,\n  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_session_messages_session_created\n  ON session_messages (session_id, created_at DESC, id DESC);\n";
/**
 * Applies PRAGMAs and creates tables/indexes on an open DatabaseSync instance.
 */
export declare function applySchema(db: DatabaseSync, options?: {
    isInMemory?: boolean;
    busyTimeoutMs?: number;
}): void;
/**
 * Opens (or creates) a SQLite database at `dbPath` (or `:memory:`) and initializes the schema.
 */
export declare function initializeDatabase(options?: DatabaseOptions): DatabaseSync;
//# sourceMappingURL=database.d.ts.map