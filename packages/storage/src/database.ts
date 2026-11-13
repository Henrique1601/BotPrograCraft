import * as fs from 'node:fs';
import * as path from 'node:path';
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
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,
  language_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  user_code TEXT NOT NULL,
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
  feedback_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_attempts_created_at
  ON exercise_attempts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_attempts_mode_lang
  ON exercise_attempts (mode, language_id, passed);

CREATE TABLE IF NOT EXISTS recurring_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  error_signature TEXT NOT NULL,
  language_id TEXT NOT NULL,
  file_path TEXT NOT NULL DEFAULT '',
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notes TEXT,
  UNIQUE (error_signature, language_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_recurring_errors_rank
  ON recurring_errors (occurrence_count DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_recurring_errors_language
  ON recurring_errors (language_id, occurrence_count DESC);

CREATE TABLE IF NOT EXISTS session_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  mode TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session_created
  ON session_messages (session_id, created_at DESC, id DESC);
`;

/**
 * Applies PRAGMAs and creates tables/indexes on an open DatabaseSync instance.
 */
export function applySchema(
  db: DatabaseSync,
  options: { isInMemory?: boolean; busyTimeoutMs?: number } = {},
): void {
  const busyTimeoutMs = options.busyTimeoutMs ?? 5000;

  db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(busyTimeoutMs))};`);
  db.exec('PRAGMA foreign_keys = ON;');

  if (!options.isInMemory) {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }

  db.exec(SCHEMA_SQL);
}

/**
 * Opens (or creates) a SQLite database at `dbPath` (or `:memory:`) and initializes the schema.
 */
export function initializeDatabase(options: DatabaseOptions = {}): DatabaseSync {
  const dbPath = options.dbPath ?? ':memory:';
  const isInMemory = dbPath === ':memory:' || dbPath.startsWith('file::memory:');

  if (!isInMemory && !dbPath.startsWith('file:')) {
    const parentDir = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath, {
    timeout: options.busyTimeoutMs ?? 5000,
  });

  applySchema(db, {
    isInMemory,
    busyTimeoutMs: options.busyTimeoutMs,
  });

  return db;
}
