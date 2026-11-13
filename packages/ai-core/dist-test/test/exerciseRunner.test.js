"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const exerciseRunner_1 = require("../src/exerciseRunner");
(0, node_test_1.describe)('runExerciseCheck', () => {
    (0, node_test_1.it)('runs JavaScript code against multiple test cases via stdin/stdout', async () => {
        const code = `
      const fs = require('node:fs');
      const input = fs.readFileSync(0, 'utf8').trim();
      const [a, b] = input.split(/\\s+/).map(Number);
      console.log(a + b);
    `;
        const result = await (0, exerciseRunner_1.runExerciseCheck)({
            language: 'javascript',
            code,
            testCases: [
                { input: '2 3', expectedOutput: '5' },
                { input: '10 -4', expectedOutput: '6' },
            ],
        });
        strict_1.default.equal(result.passed, true);
        strict_1.default.equal(result.passedCount, 2);
        strict_1.default.equal(result.totalCount, 2);
    });
    (0, node_test_1.it)('runs TypeScript code natively on Node', async () => {
        const code = `
      import fs from 'node:fs';
      const n: number = Number(fs.readFileSync(0, 'utf8').trim());
      console.log(n * 2);
    `;
        const result = await (0, exerciseRunner_1.runExerciseCheck)({
            language: 'typescript',
            code,
            testCases: [
                { input: '7', expectedOutput: '14' },
                { input: '3', expectedOutput: '999' },
            ],
        });
        strict_1.default.equal(result.passed, false);
        strict_1.default.equal(result.passedCount, 1);
        strict_1.default.equal(result.totalCount, 2);
        strict_1.default.equal(result.results[0].passed, true);
        strict_1.default.equal(result.results[1].passed, false);
        strict_1.default.equal(result.results[1].actualOutput, '6');
    });
    (0, node_test_1.it)('enforces timeoutMs on infinite loops', async () => {
        const result = await (0, exerciseRunner_1.runExerciseCheck)({
            language: 'javascript',
            code: 'while (true) {}',
            testCases: [{ input: '', expectedOutput: '' }],
            timeoutMs: 150,
        });
        strict_1.default.equal(result.passed, false);
        strict_1.default.equal(result.passedCount, 0);
        strict_1.default.match(result.results[0].error ?? '', /timed out/i);
    });
});
//# sourceMappingURL=exerciseRunner.test.js.map