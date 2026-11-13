import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BugAnalysisSchema,
  ExerciseFeedbackSchema,
  LogicChallengeSchema,
  extractJsonPayload,
  parseBugAnalysis,
  parseExerciseFeedback,
  parseLogicChallenge,
} from '../src/schemas';

describe('schemas', () => {
  describe('LogicChallengeSchema & parseLogicChallenge', () => {
    it('parses a valid LogicChallenge object with optional starterCode', () => {
      const payload = {
        title: 'Two Sum',
        difficulty: 'easy',
        prompt: 'Find two numbers that add up to target.',
        hints: ['Use a hash map to track visited numbers.'],
        expectedConcepts: ['hash-map', 'time-complexity'],
        starterCode: 'function twoSum(nums: number[], target: number) {}',
      };

      const result = parseLogicChallenge(payload);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.data.title, 'Two Sum');
        assert.equal(result.data.difficulty, 'easy');
        assert.equal(result.data.starterCode, payload.starterCode);
      }

      assert.equal(LogicChallengeSchema.safeParse({ ...payload, starterCode: undefined }).success, true);
    });

    it('parses JSON wrapped in markdown code fences', () => {
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

      const result = parseLogicChallenge(fenced);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.data.title, 'Binary Search');
        assert.equal(result.data.difficulty, 'medium');
      }
    });

    it('rejects invalid difficulty or missing required fields', () => {
      const result = parseLogicChallenge({
        title: '',
        difficulty: 'impossible',
        prompt: 'Test',
        hints: [],
        expectedConcepts: [],
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.ok(result.issues && result.issues.length >= 2);
      }
    });
  });

  describe('BugAnalysisSchema & parseBugAnalysis', () => {
    it('parses a valid BugAnalysis JSON string', () => {
      const raw = JSON.stringify({
        summary: 'Off-by-one error in loop condition',
        rootCause: 'Using <= instead of < causes out-of-bounds access.',
        severity: 'high',
        suggestedFix: 'Change i <= arr.length to i < arr.length.',
        explanation: 'Arrays are zero-indexed, so the last valid index is length - 1.',
      });

      const result = parseBugAnalysis(raw);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.data.severity, 'high');
      }
      assert.equal(BugAnalysisSchema.safeParse(JSON.parse(raw)).success, true);
    });

    it('fails safely on invalid severity or malformed JSON', () => {
      const badSeverity = parseBugAnalysis({
        summary: 'Bug',
        rootCause: 'Cause',
        severity: 'urgent',
        suggestedFix: 'Fix',
        explanation: 'Exp',
      });
      assert.equal(badSeverity.ok, false);

      const badJson = parseBugAnalysis('{not valid json');
      assert.equal(badJson.ok, false);
      if (!badJson.ok) {
        assert.match(badJson.error, /Invalid JSON/);
      }
    });
  });

  describe('ExerciseFeedbackSchema & parseExerciseFeedback', () => {
    it('parses a valid ExerciseFeedback payload', () => {
      const result = parseExerciseFeedback({
        passed: true,
        score: 92,
        strengths: ['Clean variable naming', 'Handles empty input'],
        improvements: ['Add unit tests for negative numbers'],
        nextStep: 'Try optimizing space complexity to O(1).',
      });

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.data.passed, true);
        assert.equal(result.data.score, 92);
      }
    });

    it('rejects out-of-range score or non-boolean passed', () => {
      const outOfRange = ExerciseFeedbackSchema.safeParse({
        passed: true,
        score: 150,
        strengths: ['Good'],
        improvements: [],
        nextStep: 'Next',
      });
      assert.equal(outOfRange.success, false);

      const badPassed = parseExerciseFeedback({
        passed: 'yes',
        score: 80,
        strengths: [],
        improvements: [],
        nextStep: 'Next',
      });
      assert.equal(badPassed.ok, false);
    });
  });

  describe('extractJsonPayload', () => {
    it('strips markdown fences and handles empty string safely', () => {
      assert.equal(extractJsonPayload('```json\n{"a":1}\n```'), '{"a":1}');
      assert.equal(extractJsonPayload('  {"a":1}  '), '{"a":1}');

      const emptyResult = parseLogicChallenge('   ');
      assert.equal(emptyResult.ok, false);
      if (!emptyResult.ok) {
        assert.match(emptyResult.error, /Empty JSON input/);
      }
    });
  });
});
