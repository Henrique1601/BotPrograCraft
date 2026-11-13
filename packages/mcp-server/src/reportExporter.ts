import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ExerciseAttemptRecord,
  ProgressStats,
  RecurringErrorRecord,
} from '@botprogracraft/storage';
import { getBotPrograCraftHome } from './stateReader';

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

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/**
 * Formats learning progress stats, recent attempts, and recurring errors into
 * an Obsidian-friendly Markdown study report.
 */
export function formatStudyReportMarkdown(input: StudyReportInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const { stats, recentAttempts, recurringErrors } = input;

  const lines: string[] = [
    '---',
    'title: "BotPrograCraft Study Report"',
    `date: "${generatedAt}"`,
    'tags:',
    '  - botprogracraft',
    '  - study-report',
    '---',
    '',
    '# BotPrograCraft Study Report',
    '',
    `Generated at: \`${generatedAt}\``,
    '',
    '## Summary Metrics',
    '',
    `- **Total Attempts:** ${stats.totalAttempts}`,
    `- **Passed Attempts:** ${stats.passedAttempts}`,
    `- **Pass Rate:** ${stats.passRate.toFixed(1)}%`,
    `- **Average Score:** ${stats.averageScore.toFixed(1)}`,
    `- **Recurring Errors:** ${stats.totalRecurringErrors} (${stats.totalErrorOccurrences} total occurrences)`,
    `- **Session Messages:** ${stats.totalMessages}`,
  ];

  const modeEntries = Object.entries(stats.attemptsByMode);
  if (modeEntries.length > 0) {
    lines.push('', '### Attempts by Mode', '');
    lines.push('| Mode | Total | Passed | Avg Score |');
    lines.push('| --- | ---: | ---: | ---: |');
    for (const [mode, cat] of modeEntries) {
      lines.push(
        `| ${escapeMarkdownCell(mode)} | ${cat.total} | ${cat.passed} | ${cat.averageScore.toFixed(1)} |`,
      );
    }
  }

  const langEntries = Object.entries(stats.attemptsByLanguage);
  if (langEntries.length > 0) {
    lines.push('', '### Attempts by Language', '');
    lines.push('| Language | Total | Passed | Avg Score |');
    lines.push('| --- | ---: | ---: | ---: |');
    for (const [lang, cat] of langEntries) {
      lines.push(
        `| ${escapeMarkdownCell(lang)} | ${cat.total} | ${cat.passed} | ${cat.averageScore.toFixed(1)} |`,
      );
    }
  }

  lines.push('', '## Recent Exercise Attempts', '');
  if (recentAttempts.length === 0) {
    lines.push('_No exercise attempts recorded yet._');
  } else {
    lines.push('| Date | Title | Mode | Language | Result | Score |');
    lines.push('| --- | --- | --- | --- | --- | ---: |');
    for (const attempt of recentAttempts) {
      const resultLabel = attempt.passed ? 'PASS' : 'FAIL';
      lines.push(
        `| ${escapeMarkdownCell(attempt.createdAt)} | ${escapeMarkdownCell(attempt.title)} | ${escapeMarkdownCell(attempt.mode)} | ${escapeMarkdownCell(attempt.languageId)} | ${resultLabel} | ${attempt.score} |`,
      );
    }
  }

  lines.push('', '## Top Recurring Errors', '');
  if (recurringErrors.length === 0) {
    lines.push('_No recurring errors recorded yet._');
  } else {
    lines.push('| Occurrences | Language | File | Error Signature | Last Seen |');
    lines.push('| ---: | --- | --- | --- | --- |');
    for (const err of recurringErrors) {
      const fileCell = err.filePath ? `\`${escapeMarkdownCell(err.filePath)}\`` : '-';
      lines.push(
        `| ${err.occurrenceCount} | ${escapeMarkdownCell(err.languageId)} | ${fileCell} | ${escapeMarkdownCell(err.errorSignature)} | ${escapeMarkdownCell(err.lastSeenAt)} |`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Safely saves a Markdown study report inside `<BOTPROGRACRAFT_HOME>/reports/`,
 * rejecting any path traversal or directory escape attempts.
 */
export function saveStudyReportToFile(
  markdown: string,
  options: SaveStudyReportOptions = {},
): string {
  const reportsDir = path.resolve(getBotPrograCraftHome(options.homeDir), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const defaultName = `study-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  const requestedName = options.fileName?.trim() || defaultName;

  if (
    path.isAbsolute(requestedName) ||
    requestedName.includes('..') ||
    requestedName.includes('/') ||
    requestedName.includes('\\') ||
    path.basename(requestedName) !== requestedName
  ) {
    throw new Error('Invalid report filename: path traversal is not allowed.');
  }

  const finalName = requestedName.endsWith('.md') ? requestedName : `${requestedName}.md`;
  const targetPath = path.resolve(reportsDir, finalName);
  const relative = path.relative(reportsDir, targetPath);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid report filename: resolved path escapes reports directory.');
  }

  fs.writeFileSync(targetPath, markdown, 'utf8');
  return targetPath;
}
