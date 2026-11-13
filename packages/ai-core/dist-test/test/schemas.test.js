"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const schemas_1 = require("../src/schemas");
(0, node_test_1.describe)('schemas', () => {
    (0, node_test_1.describe)('LogicChallengeSchema & parseLogicChallenge', () => {
        (0, node_test_1.it)('parses a valid LogicChallenge object with optional starterCode', () => {
            const payload = {
                title: 'Two Sum',
                difficulty: 'easy',
                prompt: 'Find two numbers that add up to target.',
                hints: ['Use a hash map to track visited numbers.'],
                expectedConcepts: ['hash-map', 'time-complexity'],
                starterCode: 'function twoSum(nums: number[], target: number) {}',
            };
            const result = (0, schemas_1.parseLogicChallenge)(payload);
            strict_1.default.equal(result.ok, true);
            if (result.ok) {
                strict_1.default.equal(result.data.title, 'Two Sum');
                strict_1.default.equal(result.data.difficulty, 'easy');
                strict_1.default.equal(result.data.starterCode, payload.starterCode);
            }
            strict_1.default.equal(schemas_1.LogicChallengeSchema.safeParse({ ...payload, starterCode: undefined }).success, true);
        });
        (0, node_test_1.it)('parses JSON wrapped in markdown code fences', () => {
            const fenced = [
                '```json',
                JSON.stringify({
                    title: 'Binary Search',
                    difficulty: 'medium',
                    prompt: 'Search a sorted array in O(log n).',
                    hints: ['Compare with middle element'],
                    expectedConcepts: ['divide-and-conquer'],
                }),
                '```',
            ].join('\n');
            const result = (0, schemas_1.parseLogicChallenge)(fenced);
            strict_1.default.equal(result.ok, true);
            if (result.ok) {
                strict_1.default.equal(result.data.title, 'Binary Search');
                strict_1.default.equal(result.data.difficulty, 'medium');
            }
        });
        (0, node_test_1.it)('rejects invalid difficulty or missing required fields', () => {
            const result = (0, schemas_1.parseLogicChallenge)({
                title: '',
                difficulty: 'impossible',
                prompt: 'Test',
                hints: [],
                expectedConcepts: [],
            });
            strict_1.default.equal(result.ok, false);
            if (!result.ok) {
                strict_1.default.ok(result.issues && result.issues.length >= 2);
            }
        });
    });
    (0, node_test_1.describe)('BugAnalysisSchema & parseBugAnalysis', () => {
        (0, node_test_1.it)('parses a valid BugAnalysis JSON string', () => {
            const raw = JSON.stringify({
                summary: 'Off-by-one error in loop condition',
                rootCause: 'Using <= instead of < causes out-of-bounds access.',
                severity: 'high',
                suggestedFix: 'Change i <= arr.length to i < arr.length.',
                explanation: 'Arrays are zero-indexed, so the last valid index is length - 1.',
            });
            const result = (0, schemas_1.parseBugAnalysis)(raw);
            strict_1.default.equal(result.ok, true);
            if (result.ok) {
                strict_1.default.equal(result.data.severity, 'high');
            }
            strict_1.default.equal(schemas_1.BugAnalysisSchema.safeParse(JSON.parse(raw)).success, true);
        });
        (0, node_test_1.it)('fails safely on invalid severity or malformed JSON', () => {
            const badSeverity = (0, schemas_1.parseBugAnalysis)({
                summary: 'Bug',
                rootCause: 'Cause',
                severity: 'urgent',
                suggestedFix: 'Fix',
                explanation: 'Exp',
            });
            strict_1.default.equal(badSeverity.ok, false);
            const badJson = (0, schemas_1.parseBugAnalysis)('{not valid json');
            strict_1.default.equal(badJson.ok, false);
            if (!badJson.ok) {
                strict_1.default.match(badJson.error, /Invalid JSON/);
            }
        });
    });
    (0, node_test_1.describe)('ExerciseFeedbackSchema & parseExerciseFeedback', () => {
        (0, node_test_1.it)('parses a valid ExerciseFeedback payload', () => {
            const result = (0, schemas_1.parseExerciseFeedback)({
                passed: true,
                score: 92,
                strengths: ['Clean variable naming', 'Handles empty input'],
                improvements: ['Add unit tests for negative numbers'],
                nextStep: 'Try optimizing space complexity to O(1).',
            });
            strict_1.default.equal(result.ok, true);
            if (result.ok) {
                strict_1.default.equal(result.data.passed, true);
                strict_1.default.equal(result.data.score, 92);
            }
        });
        (0, node_test_1.it)('rejects out-of-range score or non-boolean passed', () => {
            const outOfRange = schemas_1.ExerciseFeedbackSchema.safeParse({
                passed: true,
                score: 150,
                strengths: ['Good'],
                improvements: [],
                nextStep: 'Next',
            });
            strict_1.default.equal(outOfRange.success, false);
            const badPassed = (0, schemas_1.parseExerciseFeedback)({
                passed: 'yes',
                score: 80,
                strengths: [],
                improvements: [],
                nextStep: 'Next',
            });
            strict_1.default.equal(badPassed.ok, false);
        });
    });
    (0, node_test_1.describe)('extractJsonPayload', () => {
        (0, node_test_1.it)('strips markdown fences and handles empty string safely', () => {
            strict_1.default.equal((0, schemas_1.extractJsonPayload)('```json\n{"a":1}\n```'), '{"a":1}');
            strict_1.default.equal((0, schemas_1.extractJsonPayload)('  {"a":1}  '), '{"a":1}');
            const emptyResult = (0, schemas_1.parseLogicChallenge)('   ');
            strict_1.default.equal(emptyResult.ok, false);
            if (!emptyResult.ok) {
                strict_1.default.match(emptyResult.error, /Empty JSON input/);
            }
        });
    });
});
//# sourceMappingURL=schemas.test.js.map