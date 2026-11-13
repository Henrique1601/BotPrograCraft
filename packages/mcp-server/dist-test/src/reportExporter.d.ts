import type { ExerciseAttemptRecord, ProgressStats, RecurringErrorRecord } from '@botprogracraft/storage';
export interface StudyReportInput {
    stats: ProgressStats;
    recentAttempts: ExerciseAttemptRecord[];
    recurringErrors: RecurringErrorRecord[];
    generatedAt?: string;
}
export interface SaveStudyReportOptions {
    homeDir?: string;
    fileName?: string;
}
/**
 * Formats learning progress stats, recent attempts, and recurring errors into
 * an Obsidian-friendly Markdown study report.
 */
export declare function formatStudyReportMarkdown(input: StudyReportInput): string;
/**
 * Safely saves a Markdown study report inside `<BOTPROGRACRAFT_HOME>/reports/`,
 * rejecting any path traversal or directory escape attempts.
 */
export declare function saveStudyReportToFile(markdown: string, options?: SaveStudyReportOptions): string;
//# sourceMappingURL=reportExporter.d.ts.map