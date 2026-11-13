import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StructuredChallengeService } from '../src/challengeService';
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
  it('generates and validates a LogicChallenge from fenced JSON', async () => {
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

    assert.deepEqual(challenge, SAMPLE_CHALLENGE);
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

  it('throws clear error when API key is missing or validation fails after retries', async () => {
    const noKeyService = new StructuredChallengeService({ apiKey: '' });
    await assert.rejects(
      () => noKeyService.generateLogicChallenge({ difficulty: 'medium', languageId: 'python' }),
      /Gemini API key is required/,
    );

    const badService = new StructuredChallengeService({
      maxAttempts: 2,
      generateFn: async () => 'not json at all',
    });
    await assert.rejects(
      () => badService.generateLogicChallenge({ difficulty: 'hard', languageId: 'typescript' }),
      /Failed to parse LogicChallenge after 2 attempt\(s\)/,
    );
  });

  it('evaluates user solution and forwards unfiltered flag', async () => {
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
    assert.equal(feedback.strengths.length, 1);

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
