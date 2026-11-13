"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const challengeService_1 = require("../src/challengeService");
const SAMPLE_CHALLENGE = {
    title: 'Soma de Dois Números',
    difficulty: 'easy',
    prompt: 'Dado um array de inteiros nums e um alvo target, retorne os índices de dois números cuja soma seja igual a target.',
    hints: ['Considere usar um Map para buscar o complemento em O(1).'],
    expectedConcepts: ['hash map', 'time complexity O(n)'],
    starterCode: 'function twoSum(nums: number[], target: number): [number, number] {\n  // TODO\n}',
};
(0, node_test_1.describe)('StructuredChallengeService', () => {
    (0, node_test_1.it)('generates and validates a LogicChallenge from fenced JSON', async () => {
        const service = new challengeService_1.StructuredChallengeService({
            generateFn: async ({ prompt, unfiltered }) => {
                strict_1.default.match(prompt, /Difficulty: "easy"/);
                strict_1.default.match(prompt, /Topic focus: arrays/);
                strict_1.default.equal(unfiltered, false);
                return `\`\`\`json\n${JSON.stringify(SAMPLE_CHALLENGE)}\n\`\`\``;
            },
        });
        const challenge = await service.generateLogicChallenge({
            difficulty: 'easy',
            languageId: 'typescript',
            topic: 'arrays',
        });
        strict_1.default.deepEqual(challenge, SAMPLE_CHALLENGE);
    });
    (0, node_test_1.it)('retries once when first response fails schema validation', async () => {
        let calls = 0;
        const service = new challengeService_1.StructuredChallengeService({
            maxAttempts: 2,
            generateFn: async ({ prompt }) => {
                calls += 1;
                if (calls === 1) {
                    return '{ "title": "" }';
                }
                strict_1.default.match(prompt, /Previous response failed LogicChallenge validation/);
                return JSON.stringify(SAMPLE_CHALLENGE);
            },
        });
        const challenge = await service.generateLogicChallenge({
            difficulty: 'easy',
            languageId: 'typescript',
        });
        strict_1.default.equal(calls, 2);
        strict_1.default.equal(challenge.title, SAMPLE_CHALLENGE.title);
    });
    (0, node_test_1.it)('throws clear error when API key is missing or validation fails after retries', async () => {
        const noKeyService = new challengeService_1.StructuredChallengeService({ apiKey: '' });
        await strict_1.default.rejects(() => noKeyService.generateLogicChallenge({ difficulty: 'medium', languageId: 'python' }), /Gemini API key is required/);
        const badService = new challengeService_1.StructuredChallengeService({
            maxAttempts: 2,
            generateFn: async () => 'not json at all',
        });
        await strict_1.default.rejects(() => badService.generateLogicChallenge({ difficulty: 'hard', languageId: 'typescript' }), /Failed to parse LogicChallenge after 2 attempt\(s\)/);
    });
    (0, node_test_1.it)('evaluates user solution and forwards unfiltered flag', async () => {
        const service = new challengeService_1.StructuredChallengeService({
            generateFn: async ({ prompt, unfiltered }) => {
                strict_1.default.equal(unfiltered, true);
                strict_1.default.match(prompt, /new Map/);
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
        strict_1.default.equal(feedback.passed, true);
        strict_1.default.equal(feedback.score, 95);
        strict_1.default.equal(feedback.strengths.length, 1);
        await strict_1.default.rejects(() => service.evaluateExerciseSolution({
            challenge: SAMPLE_CHALLENGE,
            userCode: '   ',
            languageId: 'typescript',
        }), /User code must not be empty/);
    });
});
//# sourceMappingURL=challengeService.test.js.map