import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runExerciseCheck } from '../src/exerciseRunner';

describe('runExerciseCheck', () => {
  it('runs JavaScript code against multiple test cases via stdin/stdout', async () => {
    const code = `
      const fs = require('node:fs');
      const input = fs.readFileSync(0, 'utf8').trim();
      const [a, b] = input.split(/\\s+/).map(Number);
      console.log(a + b);
    `;

    const result = await runExerciseCheck({
      language: 'javascript',
      code,
      testCases: [
        { input: '2 3', expectedOutput: '5' },
        { input: '10 -4', expectedOutput: '6' },
      ],
    });

    assert.equal(result.passed, true);
    assert.equal(result.passedCount, 2);
    assert.equal(result.totalCount, 2);
  });

  it('runs TypeScript code natively on Node', async () => {
    const code = `
      import fs from 'node:fs';
      const n: number = Number(fs.readFileSync(0, 'utf8').trim());
      console.log(n * 2);
    `;

    const result = await runExerciseCheck({
      language: 'typescript',
      code,
      testCases: [
        { input: '7', expectedOutput: '14' },
        { input: '3', expectedOutput: '999' },
      ],
    });

    assert.equal(result.passed, false);
    assert.equal(result.passedCount, 1);
    assert.equal(result.totalCount, 2);
    assert.equal(result.results[0].passed, true);
    assert.equal(result.results[1].passed, false);
    assert.equal(result.results[1].actualOutput, '6');
  });

  it('enforces timeoutMs on infinite loops', async () => {
    const result = await runExerciseCheck({
      language: 'javascript',
      code: 'while (true) {}',
      testCases: [{ input: '', expectedOutput: '' }],
      timeoutMs: 150,
    });

    assert.equal(result.passed, false);
    assert.equal(result.passedCount, 0);
    assert.match(result.results[0].error ?? '', /timed out/i);
  });
});
