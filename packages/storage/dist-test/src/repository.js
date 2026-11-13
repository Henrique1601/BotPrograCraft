"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressRepository = void 0;
const database_1 = require("./database");
function normalizeLimit(limit, fallback) {
    if (limit === undefined) {
        return fallback;
    }
    if (!Number.isFinite(limit) || limit < 1) {
        return 1;
    }
    return Math.floor(limit);
}
function safeParseJsonObject(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
        return { value: parsed };
    }
    catch {
        return {};
    }
}
function mapAttemptRow(row) {
    return {
        id: Number(row.id),
        title: String(row.title),
        mode: String(row.mode),
        languageId: String(row.language_id),
        prompt: String(row.prompt),
        userCode: String(row.user_code),
        passed: Number(row.passed) === 1,
        score: Number(row.score),
        feedback: safeParseJsonObject(String(row.feedback_json ?? '{}')),
        createdAt: String(row.created_at),
    };
}
function mapRecurringErrorRow(row) {
    return {
        id: Number(row.id),
        errorSignature: String(row.error_signature),
        languageId: String(row.language_id),
        filePath: String(row.file_path),
        occurrenceCount: Number(row.occurrence_count),
        lastSeenAt: String(row.last_seen_at),
        notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    };
}
function mapMessageRow(row) {
    return {
        id: Number(row.id),
        sessionId: String(row.session_id),
        role: String(row.role),
        mode: String(row.mode),
        content: String(row.content),
        createdAt: String(row.created_at),
    };
}
/**
 * Typed SQLite repository for tracking exercise attempts, recurring errors,
 * and tutoring session messages.
 */
class ProgressRepository {
    db;
    constructor(dbOrOptions) {
        if (dbOrOptions && 'prepare' in dbOrOptions && 'exec' in dbOrOptions) {
            this.db = dbOrOptions;
        }
        else {
            this.db = (0, database_1.initializeDatabase)(dbOrOptions);
        }
    }
    /**
     * Returns the underlying `DatabaseSync` instance.
     */
    getDatabase() {
        return this.db;
    }
    /**
     * Closes the underlying SQLite connection.
     */
    close() {
        this.db.close();
    }
    /**
     * Records a completed or attempted exercise evaluation.
     */
    recordAttempt(input) {
        const createdAt = input.createdAt ?? new Date().toISOString();
        const feedbackJson = JSON.stringify(input.feedback ?? {});
        const passedInt = input.passed ? 1 : 0;
        const stmt = this.db.prepare(`
      INSERT INTO exercise_attempts (
        title, mode, language_id, prompt, user_code, passed, score, feedback_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
        const row = stmt.get(input.title, input.mode, input.languageId, input.prompt, input.userCode, passedInt, input.score, feedbackJson, createdAt);
        if (!row) {
            throw new Error('Failed to insert exercise attempt.');
        }
        return mapAttemptRow(row);
    }
    /**
     * Lists the most recent exercise attempts, optionally filtered by mode, language, or pass status.
     */
    listRecentAttempts(options = {}) {
        const limit = normalizeLimit(options.limit, 20);
        const clauses = [];
        const params = [];
        if (options.mode !== undefined) {
            clauses.push('mode = ?');
            params.push(options.mode);
        }
        if (options.languageId !== undefined) {
            clauses.push('language_id = ?');
            params.push(options.languageId);
        }
        if (options.passed !== undefined) {
            clauses.push('passed = ?');
            params.push(options.passed ? 1 : 0);
        }
        const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
        params.push(limit);
        const stmt = this.db.prepare(`
      SELECT id, title, mode, language_id, prompt, user_code, passed, score, feedback_json, created_at
      FROM exercise_attempts
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `);
        return stmt.all(...params).map(mapAttemptRow);
    }
    /**
     * Records an error occurrence, incrementing `occurrence_count` if the same
     * `(errorSignature, languageId, filePath)` tuple already exists.
     */
    recordRecurringError(input) {
        const filePath = input.filePath ?? '';
        const seenAt = input.seenAt ?? new Date().toISOString();
        const notes = input.notes ?? null;
        const stmt = this.db.prepare(`
      INSERT INTO recurring_errors (
        error_signature, language_id, file_path, occurrence_count, last_seen_at, notes
      )
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT (error_signature, language_id, file_path)
      DO UPDATE SET
        occurrence_count = recurring_errors.occurrence_count + 1,
        last_seen_at = excluded.last_seen_at,
        notes = COALESCE(excluded.notes, recurring_errors.notes)
      RETURNING *
    `);
        const row = stmt.get(input.errorSignature, input.languageId, filePath, seenAt, notes);
        if (!row) {
            throw new Error('Failed to upsert recurring error.');
        }
        return mapRecurringErrorRow(row);
    }
    /**
     * Returns the most frequent recurring errors, optionally filtered by `languageId`.
     */
    getTopRecurringErrors(options = {}) {
        const limit = normalizeLimit(options.limit, 10);
        const params = [];
        let whereSql = '';
        if (options.languageId !== undefined) {
            whereSql = 'WHERE language_id = ?';
            params.push(options.languageId);
        }
        params.push(limit);
        const stmt = this.db.prepare(`
      SELECT id, error_signature, language_id, file_path, occurrence_count, last_seen_at, notes
      FROM recurring_errors
      ${whereSql}
      ORDER BY occurrence_count DESC, last_seen_at DESC, id DESC
      LIMIT ?
    `);
        return stmt.all(...params).map(mapRecurringErrorRow);
    }
    /**
     * Appends a message to a tutoring session log.
     */
    appendMessage(input) {
        const createdAt = input.createdAt ?? new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO session_messages (session_id, role, mode, content, created_at)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
        const row = stmt.get(input.sessionId, input.role, input.mode, input.content, createdAt);
        if (!row) {
            throw new Error('Failed to append session message.');
        }
        return mapMessageRow(row);
    }
    /**
     * Lists the most recent `limit` messages for a given `sessionId`.
     * By default returns them in chronological order (`'asc'`) suitable for LLM context windows.
     */
    listRecentMessages(sessionId, limit = 50, order = 'asc') {
        const safeLimit = normalizeLimit(limit, 50);
        if (order === 'desc') {
            const stmt = this.db.prepare(`
        SELECT id, session_id, role, mode, content, created_at
        FROM session_messages
        WHERE session_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `);
            return stmt.all(sessionId, safeLimit).map(mapMessageRow);
        }
        const stmt = this.db.prepare(`
      SELECT id, session_id, role, mode, content, created_at
      FROM (
        SELECT id, session_id, role, mode, content, created_at
        FROM session_messages
        WHERE session_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      )
      ORDER BY created_at ASC, id ASC
    `);
        return stmt.all(sessionId, safeLimit).map(mapMessageRow);
    }
    /**
     * Computes aggregate progress, error, and messaging statistics.
     */
    getStats() {
        const attemptSummary = this.db
            .prepare(`
        SELECT
          COUNT(*) AS total_attempts,
          COALESCE(SUM(passed), 0) AS passed_attempts,
          COALESCE(AVG(score), 0) AS avg_score
        FROM exercise_attempts
      `)
            .get();
        const totalAttempts = Number(attemptSummary?.total_attempts ?? 0);
        const passedAttempts = Number(attemptSummary?.passed_attempts ?? 0);
        const averageScore = totalAttempts > 0 ? Number(attemptSummary?.avg_score ?? 0) : 0;
        const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
        const errorSummary = this.db
            .prepare(`
        SELECT
          COUNT(*) AS total_errors,
          COALESCE(SUM(occurrence_count), 0) AS total_occurrences
        FROM recurring_errors
      `)
            .get();
        const messageSummary = this.db
            .prepare(`
        SELECT COUNT(*) AS total_messages
        FROM session_messages
      `)
            .get();
        const modeRows = this.db
            .prepare(`
        SELECT
          mode,
          COUNT(*) AS total,
          COALESCE(SUM(passed), 0) AS passed,
          COALESCE(AVG(score), 0) AS avg_score
        FROM exercise_attempts
        GROUP BY mode
      `)
            .all();
        const attemptsByMode = {};
        for (const row of modeRows) {
            attemptsByMode[String(row.mode)] = {
                total: Number(row.total),
                passed: Number(row.passed),
                averageScore: Number(row.avg_score),
            };
        }
        const languageRows = this.db
            .prepare(`
        SELECT
          language_id,
          COUNT(*) AS total,
          COALESCE(SUM(passed), 0) AS passed,
          COALESCE(AVG(score), 0) AS avg_score
        FROM exercise_attempts
        GROUP BY language_id
      `)
            .all();
        const attemptsByLanguage = {};
        for (const row of languageRows) {
            attemptsByLanguage[String(row.language_id)] = {
                total: Number(row.total),
                passed: Number(row.passed),
                averageScore: Number(row.avg_score),
            };
        }
        return {
            totalAttempts,
            passedAttempts,
            passRate,
            averageScore,
            totalRecurringErrors: Number(errorSummary?.total_errors ?? 0),
            totalErrorOccurrences: Number(errorSummary?.total_occurrences ?? 0),
            totalMessages: Number(messageSummary?.total_messages ?? 0),
            attemptsByMode,
            attemptsByLanguage,
        };
    }
}
exports.ProgressRepository = ProgressRepository;
//# sourceMappingURL=repository.js.map