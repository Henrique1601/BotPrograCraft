import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ExerciseLanguage = 'javascript' | 'typescript' | 'python';

export interface ExerciseTestCase {
  input: string;
  expectedOutput: string;
}

export interface ExerciseTestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
}

export interface ExerciseCheckParams {
  language: ExerciseLanguage;
  code: string;
  testCases: ExerciseTestCase[];
  timeoutMs?: number;
}

export interface ExerciseCheckResult {
  passed: boolean;
  passedCount: number;
  totalCount: number;
  results: ExerciseTestCaseResult[];
}

const DEFAULT_TIMEOUT_MS = 3000;

function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function getRunnerSpec(
  language: ExerciseLanguage,
  filePath: string,
): { command: string; args: string[] } {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return { command: process.execPath, args: [filePath] };
    case 'python':
      return { command: 'python', args: [filePath] };
    default:
      throw new Error(`Unsupported exercise language: ${String(language)}`);
  }
}

function getFileExtension(language: ExerciseLanguage): string {
  switch (language) {
    case 'javascript':
      return '.js';
    case 'typescript':
      return '.ts';
    case 'python':
      return '.py';
  }
}

function runSingleTestCase(
  command: string,
  args: string[],
  testCase: ExerciseTestCase,
  timeoutMs: number,
): Promise<ExerciseTestCaseResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (result: ExerciseTestCaseResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      finish({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: normalizeOutput(stdout),
        passed: false,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      const actualOutput = normalizeOutput(stdout);
      const expectedNormalized = normalizeOutput(testCase.expectedOutput);

      if (timedOut) {
        finish({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput,
          passed: false,
          error: `Execution timed out after ${timeoutMs}ms`,
        });
        return;
      }

      if (code !== 0) {
        finish({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput,
          passed: false,
          error: stderr.trim() || `Process exited with code ${code ?? 'null'}`,
        });
        return;
      }

      finish({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        passed: actualOutput === expectedNormalized,
      });
    });

    child.stdin.on('error', () => {
      // Ignore EPIPE if process exits before reading stdin.
    });
    child.stdin.write(testCase.input);
    child.stdin.end();
  });
}

/**
 * Executes user code against test cases in isolated child processes with a strict timeout.
 */
export async function runExerciseCheck(
  params: ExerciseCheckParams,
): Promise<ExerciseCheckResult> {
  const timeoutMs = params.timeoutMs && params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_TIMEOUT_MS;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bpc-exercise-'));
  const filePath = path.join(tempDir, `solution${getFileExtension(params.language)}`);

  try {
    fs.writeFileSync(filePath, params.code, 'utf8');
    const { command, args } = getRunnerSpec(params.language, filePath);

    const results: ExerciseTestCaseResult[] = [];
    for (const testCase of params.testCases) {
      results.push(await runSingleTestCase(command, args, testCase, timeoutMs));
    }

    const passedCount = results.filter((r) => r.passed).length;
    return {
      passed: passedCount === results.length,
      passedCount,
      totalCount: results.length,
      results,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
