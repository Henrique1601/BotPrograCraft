"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runExerciseCheck = runExerciseCheck;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_TIMEOUT_MS = 3000;
function normalizeOutput(value) {
    return value.replace(/\r\n/g, '\n').trim();
}
function getRunnerSpec(language, filePath) {
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
function getFileExtension(language) {
    switch (language) {
        case 'javascript':
            return '.js';
        case 'typescript':
            return '.ts';
        case 'python':
            return '.py';
    }
}
function runSingleTestCase(command, args, testCase, timeoutMs) {
    return new Promise((resolve) => {
        const child = (0, node_child_process_1.spawn)(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let settled = false;
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
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
async function runExerciseCheck(params) {
    const timeoutMs = params.timeoutMs && params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_TIMEOUT_MS;
    const tempDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'bpc-exercise-'));
    const filePath = node_path_1.default.join(tempDir, `solution${getFileExtension(params.language)}`);
    try {
        node_fs_1.default.writeFileSync(filePath, params.code, 'utf8');
        const { command, args } = getRunnerSpec(params.language, filePath);
        const results = [];
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
    }
    finally {
        node_fs_1.default.rmSync(tempDir, { recursive: true, force: true });
    }
}
//# sourceMappingURL=exerciseRunner.js.map