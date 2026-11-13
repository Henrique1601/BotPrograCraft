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
const src_1 = require("../src");
(0, node_test_1.describe)('ProgressRepository', () => {
    let repo;
    (0, node_test_1.beforeEach)(() => {
        repo = new src_1.ProgressRepository({ dbPath: ':memory:' });
    });
    (0, node_test_1.afterEach)(() => {
        repo.close();
    });
    (0, node_test_1.it)('initializes required tables and strategic indexes', () => {
        const db = repo.getDatabase();
        const tables = db
            .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
            .all()
            .map((row) => String(row.name));
        assert.deepEqual(tables, [
            'exercise_attempts',
            'recurring_errors',
            'session_messages',
        ]);
        const indexes = db
            .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
            .all()
            .map((row) => String(row.name));
        assert.deepEqual(indexes, [
            'idx_exercise_attempts_created_at',
            'idx_exercise_attempts_mode_lang',
            'idx_recurring_errors_language',
            'idx_recurring_errors_rank',
            'idx_session_messages_session_created',
        ]);
    });
    (0, node_test_1.it)('records and lists recent exercise attempts with filters and JSON feedback', () => {
        const first = repo.recordAttempt({
            title: 'Two Sum',
            mode: 'logic-challenge',
            languageId: 'typescript',
            prompt: 'Find two indices adding up to target',
            userCode: 'function twoSum() { return []; }',
            passed: false,
            score: 40,
            feedback: { hint: 'Use a hash map', complexity: 'O(n^2)' },
            createdAt: '2026-11-13T10:00:00.000Z',
        });
        const second = repo.recordAttempt({
            title: 'Two Sum',
            mode: 'logic-challenge',
            languageId: 'typescript',
            prompt: 'Find two indices adding up to target',
            userCode: 'function twoSum(nums, target) { /* map */ }',
            passed: true,
            score: 95,
            feedback: { hint: 'Great!', complexity: 'O(n)' },
            createdAt: '2026-11-13T10:05:00.000Z',
        });
        const third = repo.recordAttempt({
            title: 'Async Retry',
            mode: 'pair-programming',
            languageId: 'python',
            prompt: 'Implement exponential backoff',
            userCode: 'async def retry(): pass',
            passed: true,
            score: 88,
            createdAt: '2026-11-13T10:10:00.000Z',
        });
        assert.equal(first.id, 1);
        assert.equal(first.passed, false);
        assert.deepEqual(first.feedback, { hint: 'Use a hash map', complexity: 'O(n^2)' });
        const allRecent = repo.listRecentAttempts();
        assert.equal(allRecent.length, 3);
        assert.deepEqual(allRecent.map((a) => a.id), [third.id, second.id, first.id]);
        const passedOnly = repo.listRecentAttempts({ passed: true });
        assert.equal(passedOnly.length, 2);
        assert.ok(passedOnly.every((a) => a.passed));
        const tsLogic = repo.listRecentAttempts({
            mode: 'logic-challenge',
            languageId: 'typescript',
            limit: 1,
        });
        assert.equal(tsLogic.length, 1);
        assert.equal(tsLogic[0]?.id, second.id);
    });
    (0, node_test_1.it)('upserts recurring errors and ranks top occurrences', () => {
        const e1 = repo.recordRecurringError({
            errorSignature: 'TS2322: Type string is not assignable to number',
            languageId: 'typescript',
            filePath: 'src/math.ts',
            notes: 'Check return type annotation',
            seenAt: '2026-11-13T10:00:00.000Z',
        });
        assert.equal(e1.occurrenceCount, 1);
        assert.equal(e1.notes, 'Check return type annotation');
        const e1Again = repo.recordRecurringError({
            errorSignature: 'TS2322: Type string is not assignable to number',
            languageId: 'typescript',
            filePath: 'src/math.ts',
            seenAt: '2026-11-13T10:02:00.000Z',
        });
        assert.equal(e1Again.id, e1.id);
        assert.equal(e1Again.occurrenceCount, 2);
        assert.equal(e1Again.lastSeenAt, '2026-11-13T10:02:00.000Z');
        assert.equal(e1Again.notes, 'Check return type annotation');
        repo.recordRecurringError({
            errorSignature: 'TS2322: Type string is not assignable to number',
            languageId: 'typescript',
            filePath: 'src/math.ts',
            notes: 'Updated note',
            seenAt: '2026-11-13T10:03:00.000Z',
        });
        repo.recordRecurringError({
            errorSignature: 'TypeError: Cannot read properties of undefined',
            languageId: 'javascript',
            filePath: 'src/app.js',
            seenAt: '2026-11-13T10:04:00.000Z',
        });
        const pyErr = repo.recordRecurringError({
            errorSignature: 'KeyError: user_id',
            languageId: 'python',
            filePath: 'app.py',
            seenAt: '2026-11-13T10:05:00.000Z',
        });
        repo.recordRecurringError({
            errorSignature: 'KeyError: user_id',
            languageId: 'python',
            filePath: 'app.py',
            seenAt: '2026-11-13T10:06:00.000Z',
        });
        assert.equal(pyErr.occurrenceCount, 1);
        const topAll = repo.getTopRecurringErrors({ limit: 2 });
        assert.equal(topAll.length, 2);
        assert.equal(topAll[0]?.occurrenceCount, 3);
        assert.equal(topAll[0]?.notes, 'Updated note');
        assert.equal(topAll[1]?.occurrenceCount, 2);
        assert.equal(topAll[1]?.languageId, 'python');
        const topJs = repo.getTopRecurringErrors({ languageId: 'javascript' });
        assert.equal(topJs.length, 1);
        assert.equal(topJs[0]?.errorSignature, 'TypeError: Cannot read properties of undefined');
    });
    (0, node_test_1.it)('appends and lists recent session messages in chronological window or descending order', () => {
        repo.appendMessage({
            sessionId: 'session-1',
            role: 'user',
            mode: 'socratic',
            content: 'Why is my loop infinite?',
            createdAt: '2026-11-13T11:00:00.000Z',
        });
        repo.appendMessage({
            sessionId: 'session-1',
            role: 'assistant',
            mode: 'socratic',
            content: 'What happens to your index variable on each iteration?',
            createdAt: '2026-11-13T11:00:05.000Z',
        });
        repo.appendMessage({
            sessionId: 'session-1',
            role: 'user',
            mode: 'socratic',
            content: 'Oh! I forgot to increment i.',
            createdAt: '2026-11-13T11:00:10.000Z',
        });
        repo.appendMessage({
            sessionId: 'session-2',
            role: 'system',
            mode: 'direct',
            content: 'Other session message',
            createdAt: '2026-11-13T11:00:15.000Z',
        });
        const lastTwoAsc = repo.listRecentMessages('session-1', 2, 'asc');
        assert.equal(lastTwoAsc.length, 2);
        assert.equal(lastTwoAsc[0]?.role, 'assistant');
        assert.equal(lastTwoAsc[1]?.content, 'Oh! I forgot to increment i.');
        const lastTwoDesc = repo.listRecentMessages('session-1', 2, 'desc');
        assert.equal(lastTwoDesc.length, 2);
        assert.equal(lastTwoDesc[0]?.content, 'Oh! I forgot to increment i.');
        assert.equal(lastTwoDesc[1]?.role, 'assistant');
    });
    (0, node_test_1.it)('computes accurate aggregate stats on empty and populated databases', () => {
        const emptyStats = repo.getStats();
        assert.deepEqual(emptyStats, {
            totalAttempts: 0,
            passedAttempts: 0,
            passRate: 0,
            averageScore: 0,
            totalRecurringErrors: 0,
            totalErrorOccurrences: 0,
            totalMessages: 0,
            attemptsByMode: {},
            attemptsByLanguage: {},
        });
        repo.recordAttempt({
            title: 'Ex 1',
            mode: 'socratic',
            languageId: 'typescript',
            prompt: 'p1',
            userCode: 'c1',
            passed: true,
            score: 100,
        });
        repo.recordAttempt({
            title: 'Ex 2',
            mode: 'socratic',
            languageId: 'typescript',
            prompt: 'p2',
            userCode: 'c2',
            passed: false,
            score: 50,
        });
        repo.recordAttempt({
            title: 'Ex 3',
            mode: 'explain-bug',
            languageId: 'python',
            prompt: 'p3',
            userCode: 'c3',
            passed: true,
            score: 90,
        });
        repo.recordRecurringError({
            errorSignature: 'SyntaxError',
            languageId: 'python',
        });
        repo.recordRecurringError({
            errorSignature: 'SyntaxError',
            languageId: 'python',
        });
        repo.appendMessage({
            sessionId: 's1',
            role: 'user',
            mode: 'socratic',
            content: 'hello',
        });
        const stats = repo.getStats();
        assert.equal(stats.totalAttempts, 3);
        assert.equal(stats.passedAttempts, 2);
        assert.ok(Math.abs(stats.passRate - (2 / 3) * 100) < 0.001);
        assert.equal(stats.averageScore, 80);
        assert.equal(stats.totalRecurringErrors, 1);
        assert.equal(stats.totalErrorOccurrences, 2);
        assert.equal(stats.totalMessages, 1);
        assert.deepEqual(stats.attemptsByMode['socratic'], {
            total: 2,
            passed: 1,
            averageScore: 75,
        });
        assert.deepEqual(stats.attemptsByLanguage['python'], {
            total: 1,
            passed: 1,
            averageScore: 90,
        });
    });
    (0, node_test_1.it)('supports file-backed SQLite databases and persists across reopens', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botprogracraft-storage-'));
        const dbPath = path.join(tmpDir, 'nested', 'progress.sqlite');
        try {
            const db1 = (0, src_1.initializeDatabase)({ dbPath });
            const repo1 = new src_1.ProgressRepository(db1);
            repo1.recordAttempt({
                title: 'Persisted Exercise',
                mode: 'direct',
                languageId: 'typescript',
                prompt: 'Write a sum function',
                userCode: 'export const sum = (a: number, b: number) => a + b;',
                passed: true,
                score: 100,
            });
            repo1.close();
            const repo2 = new src_1.ProgressRepository({ dbPath });
            const attempts = repo2.listRecentAttempts();
            assert.equal(attempts.length, 1);
            assert.equal(attempts[0]?.title, 'Persisted Exercise');
            repo2.close();
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=repository.test.js.map