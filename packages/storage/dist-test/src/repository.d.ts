import type { DatabaseSync } from 'node:sqlite';
import { type DatabaseOptions } from './database';
export type MessageRole = 'user' | 'assistant' | 'system';
export interface RecordAttemptInput {
    title: string;
    mode: string;
    languageId: string;
    prompt: string;
    userCode: string;
    passed: boolean;
    score: number;
    feedback?: Record<string, unknown>;
    createdAt?: string;
}
export interface ExerciseAttemptRecord {
    id: number;
    title: string;
    mode: string;
    languageId: string;
    prompt: string;
    userCode: string;
    passed: boolean;
    score: number;
    feedback: Record<string, unknown>;
    createdAt: string;
}
export interface ListAttemptsOptions {
    limit?: number;
    mode?: string;
    languageId?: string;
    passed?: boolean;
}
export interface RecordRecurringErrorInput {
    errorSignature: string;
    languageId: string;
    filePath?: string;
    notes?: string | null;
    seenAt?: string;
}
export interface RecurringErrorRecord {
    id: number;
    errorSignature: string;
    languageId: string;
    filePath: string;
    occurrenceCount: number;
    lastSeenAt: string;
    notes: string | null;
}
export interface TopRecurringErrorsOptions {
    limit?: number;
    languageId?: string;
}
export interface AppendMessageInput {
    sessionId: string;
    role: MessageRole;
    mode: string;
    content: string;
    createdAt?: string;
}
export interface SessionMessageRecord {
    id: number;
    sessionId: string;
    role: MessageRole;
    mode: string;
    content: string;
    createdAt: string;
}
export interface CategoryStats {
    total: number;
    passed: number;
    averageScore: number;
}
export interface ProgressStats {
    totalAttempts: number;
    passedAttempts: number;
    passRate: number;
    averageScore: number;
    totalRecurringErrors: number;
    totalErrorOccurrences: number;
    totalMessages: number;
    attemptsByMode: Record<string, CategoryStats>;
    attemptsByLanguage: Record<string, CategoryStats>;
}
/**
 * Typed SQLite repository for tracking exercise attempts, recurring errors,
 * and tutoring session messages.
 */
export declare class ProgressRepository {
    private readonly db;
    constructor(dbOrOptions?: DatabaseSync | DatabaseOptions);
    /**
     * Returns the underlying `DatabaseSync` instance.
     */
    getDatabase(): DatabaseSync;
    /**
     * Closes the underlying SQLite connection.
     */
    close(): void;
    /**
     * Records a completed or attempted exercise evaluation.
     */
    recordAttempt(input: RecordAttemptInput): ExerciseAttemptRecord;
    /**
     * Lists the most recent exercise attempts, optionally filtered by mode, language, or pass status.
     */
    listRecentAttempts(options?: ListAttemptsOptions): ExerciseAttemptRecord[];
    /**
     * Records an error occurrence, incrementing `occurrence_count` if the same
     * `(errorSignature, languageId, filePath)` tuple already exists.
     */
    recordRecurringError(input: RecordRecurringErrorInput): RecurringErrorRecord;
    /**
     * Returns the most frequent recurring errors, optionally filtered by `languageId`.
     */
    getTopRecurringErrors(options?: TopRecurringErrorsOptions): RecurringErrorRecord[];
    /**
     * Appends a message to a tutoring session log.
     */
    appendMessage(input: AppendMessageInput): SessionMessageRecord;
    /**
     * Lists the most recent `limit` messages for a given `sessionId`.
     * By default returns them in chronological order (`'asc'`) suitable for LLM context windows.
     */
    listRecentMessages(sessionId: string, limit?: number, order?: 'asc' | 'desc'): SessionMessageRecord[];
    /**
     * Computes aggregate progress, error, and messaging statistics.
     */
    getStats(): ProgressStats;
}
//# sourceMappingURL=repository.d.ts.map