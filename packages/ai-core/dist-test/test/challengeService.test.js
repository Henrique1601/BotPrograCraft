"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const challengeService_1 = require("../src/challengeService");
const ollamaClient_1 = require("../src/ollamaClient");
const SAMPLE_CHALLENGE = {
    title: 'Soma de Dois Números',
    difficulty: 'easy',
    prompt: 'Dado um array de inteiros nums e um alvo target, retorne os índices de dois números cuja soma seja igual a target.',
    hints: ['Considere usar um Map para buscar o complemento em O(1).'],
    expectedConcepts: ['hash map', 'time complexity O(n)'],
    starterCode: 'function twoSum(nums: number[], target: number): [number, number] {\n  // TODO\n}',
};
(0, node_test_1.describe)('StructuredChallengeService', () => {
    (0, node_test_1.it)('generates and validates a LogicChallenge from fenced JSON via Gemini', async () => {
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
        strict_1.default.equal(challenge.title, SAMPLE_CHALLENGE.title);
        strict_1.default.equal(challenge.source, 'gemini');
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
    (0, node_test_1.it)('falls back to Ollama when Gemini is missing or fails, then to curated offline bank', async () => {
        const ollamaHealthy = new ollamaClient_1.OllamaClient({
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
        const ollamaFallbackService = new challengeService_1.StructuredChallengeService({
            apiKey: '',
            ollamaClient: ollamaHealthy,
        });
        const fromOllama = await ollamaFallbackService.generateLogicChallenge({
            difficulty: 'easy',
            languageId: 'typescript',
        });
        strict_1.default.equal(fromOllama.source, 'ollama');
        strict_1.default.equal(fromOllama.title, SAMPLE_CHALLENGE.title);
        const offlineService = new challengeService_1.StructuredChallengeService({
            apiKey: '',
            ollamaClient: new ollamaClient_1.OllamaClient({
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
        strict_1.default.equal(fromCurated.source, 'curated');
        strict_1.default.equal(fromCurated.difficulty, 'medium');
        strict_1.default.ok(fromCurated.testCases && fromCurated.testCases.length > 0);
    });
    (0, node_test_1.it)('evaluates user solution via Gemini, or falls back to runExerciseCheck when testCases provided without API key', async () => {
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
        const offlineService = new challengeService_1.StructuredChallengeService({ apiKey: '' });
        const offlineFeedback = await offlineService.evaluateExerciseSolution({
            challenge: SAMPLE_CHALLENGE,
            userCode: `const fs = require('node:fs'); console.log(Number(fs.readFileSync(0, 'utf8').trim()) * 2);`,
            languageId: 'javascript',
            testCases: [
                { input: '4', expectedOutput: '8' },
                { input: '5', expectedOutput: '10' },
            ],
        });
        strict_1.default.equal(offlineFeedback.passed, true);
        strict_1.default.equal(offlineFeedback.score, 100);
        await strict_1.default.rejects(() => offlineService.evaluateExerciseSolution({
            challenge: SAMPLE_CHALLENGE,
            userCode: 'const x = 1;',
            languageId: 'typescript',
        }), /Gemini API key is required/);
        await strict_1.default.rejects(() => service.evaluateExerciseSolution({
            challenge: SAMPLE_CHALLENGE,
            userCode: '   ',
            languageId: 'typescript',
        }), /User code must not be empty/);
    });
});
//# sourceMappingURL=challengeService.test.js.map