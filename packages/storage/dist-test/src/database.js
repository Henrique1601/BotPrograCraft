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
exports.SCHEMA_SQL = void 0;
exports.applySchema = applySchema;
exports.initializeDatabase = initializeDatabase;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_sqlite_1 = require("node:sqlite");
/**
 * Idempotent DDL schema for BotPrograCraft local progress, error tracking, and session history.
 */
exports.SCHEMA_SQL = `
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
function applySchema(db, options = {}) {
    const busyTimeoutMs = options.busyTimeoutMs ?? 5000;
    db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(busyTimeoutMs))};`);
    db.exec('PRAGMA foreign_keys = ON;');
    if (!options.isInMemory) {
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA synchronous = NORMAL;');
    }
    db.exec(exports.SCHEMA_SQL);
}
/**
 * Opens (or creates) a SQLite database at `dbPath` (or `:memory:`) and initializes the schema.
 */
function initializeDatabase(options = {}) {
    const dbPath = options.dbPath ?? ':memory:';
    const isInMemory = dbPath === ':memory:' || dbPath.startsWith('file::memory:');
    if (!isInMemory && !dbPath.startsWith('file:')) {
        const parentDir = path.dirname(path.resolve(dbPath));
        fs.mkdirSync(parentDir, { recursive: true });
    }
    const db = new node_sqlite_1.DatabaseSync(dbPath, {
        timeout: options.busyTimeoutMs ?? 5000,
    });
    applySchema(db, {
        isInMemory,
        busyTimeoutMs: options.busyTimeoutMs,
    });
    return db;
}
//# sourceMappingURL=database.js.map