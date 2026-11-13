import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StructuredChallengeService } from '../src/challengeService';
import { OllamaClient } from '../src/ollamaClient';
import type { LogicChallenge } from '../src/schemas';

const SAMPLE_CHALLENGE: LogicChallenge = {
  title: 'Soma de Dois Números',
  difficulty: 'easy',
  prompt: 'Dado um array de inteiros nums e um alvo target, retorne os índices de dois números cuja soma seja igual a target.',
  hints: ['Considere usar um Map para buscar o complemento em O(1).'],
  expectedConcepts: ['hash map', 'time complexity O(n)'],
  starterCode: 'function twoSum(nums: number[], target: number): [number, number] {\n  // TODO\n}',
};

describe('StructuredChallengeService', () => {
  it('generates and validates a LogicChallenge from fenced JSON via Gemini', async () => {
    const service = new StructuredChallengeService({
      generateFn: async ({ prompt, unfiltered }) => {
        assert.match(prompt, /Difficulty: "easy"/);
        assert.match(prompt, /Topic focus: arrays/);
        assert.equal(unfiltered, false);
        return `\`\`\`json\n${JSON.stringify(SAMPLE_CHALLENGE)}\n\`\`\``;
      },
    });

    const challenge = await service.generateLogicChallenge({
      difficulty: 'easy',
      languageId: 'typescript',
      topic: 'arrays',
    });

    assert.equal(challenge.title, SAMPLE_CHALLENGE.title);
    assert.equal(challenge.source, 'gemini');
  });

  it('retries once when first response fails schema validation', async () => {
    let calls = 0;
    const service = new StructuredChallengeService({
      maxAttempts: 2,
      generateFn: async ({ prompt }) => {
        calls += 1;
        if (calls === 1) {
          return '{ "title": "" }';
        }
        assert.match(prompt, /Previous response failed LogicChallenge validation/);
        return JSON.stringify(SAMPLE_CHALLENGE);
      },
    });

    const challenge = await service.generateLogicChallenge({
      difficulty: 'easy',
      languageId: 'typescript',
    });

    assert.equal(calls, 2);
    assert.equal(challenge.title, SAMPLE_CHALLENGE.title);
  });

  it('falls back to Ollama when Gemini is missing or fails, then to curated offline bank', async () => {
    const ollamaHealthy = new OllamaClient({
      fetchFn: async (url) => {
        if (url.endsWith('/api/tags')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ models: [{ name: 'qwen2.5-coder:7b' }] }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            message: { content: JSON.stringify(SAMPLE_CHALLENGE) },
          }),
        };
      },
    });

    const ollamaFallbackService = new StructuredChallengeService({
      apiKey: '',
      ollamaClient: ollamaHealthy,
    });
    const fromOllama = await ollamaFallbackService.generateLogicChallenge({
      difficulty: 'easy',
      languageId: 'typescript',
    });
    assert.equal(fromOllama.source, 'ollama');
    assert.equal(fromOllama.title, SAMPLE_CHALLENGE.title);

    const offlineService = new StructuredChallengeService({
      apiKey: '',
      ollamaClient: new OllamaClient({
        fetchFn: async () => {
          throw new Error('ECONNREFUSED');
        },
      }),
    });
    const fromCurated = await offlineService.generateLogicChallenge({
      difficulty: 'medium',
      languageId: 'typescript',
      topic: 'arrays',
    });
    assert.equal(fromCurated.source, 'curated');
    assert.equal(fromCurated.difficulty, 'medium');
    assert.ok(fromCurated.testCases && fromCurated.testCases.length > 0);
  });

  it('evaluates user solution via Gemini, or falls back to runExerciseCheck when testCases provided without API key', async () => {
    const service = new StructuredChallengeService({
      generateFn: async ({ prompt, unfiltered }) => {
        assert.equal(unfiltered, true);
        assert.match(prompt, /new Map/);
        return JSON.stringify({
          passed: true,
          score: 95,
          strengths: ['Complexidade O(n) usando Map'],
          improvements: ['Tratar array vazio explicitamente'],
          nextStep: 'Tente resolver a variação 3Sum.',
        });
      },
    });

    const feedback = await service.evaluateExerciseSolution({
      challenge: SAMPLE_CHALLENGE,
      userCode: 'const seen = new Map<number, number>();',
      languageId: 'typescript',
      unfiltered: true,
    });

    assert.equal(feedback.passed, true);
    assert.equal(feedback.score, 95);

    const offlineService = new StructuredChallengeService({ apiKey: '' });
    const offlineFeedback = await offlineService.evaluateExerciseSolution({
      challenge: SAMPLE_CHALLENGE,
      userCode: `const fs = require('node:fs'); console.log(Number(fs.readFileSync(0, 'utf8').trim()) * 2);`,
      languageId: 'javascript',
      testCases: [
        { input: '4', expectedOutput: '8' },
        { input: '5', expectedOutput: '10' },
      ],
    });
    assert.equal(offlineFeedback.passed, true);
    assert.equal(offlineFeedback.score, 100);

    await assert.rejects(
      () =>
        offlineService.evaluateExerciseSolution({
          challenge: SAMPLE_CHALLENGE,
          userCode: 'const x = 1;',
          languageId: 'typescript',
        }),
      /Gemini API key is required/,
    );

    await assert.rejects(
      () =>
        service.evaluateExerciseSolution({
          challenge: SAMPLE_CHALLENGE,
          userCode: '   ',
          languageId: 'typescript',
        }),
      /User code must not be empty/,
    );
  });
});
