"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const challengeBank_1 = require("../src/challengeBank");
const schemas_1 = require("../src/schemas");
(0, node_test_1.describe)('challengeBank', () => {
    (0, node_test_1.it)('all curated challenges pass LogicChallengeSchema and include testCases', () => {
        strict_1.default.ok(challengeBank_1.CURATED_CHALLENGES.length >= 6);
        for (const item of challengeBank_1.CURATED_CHALLENGES) {
            const parsed = (0, schemas_1.parseLogicChallenge)({
                title: item.title,
                difficulty: item.difficulty,
                prompt: item.prompt,
                hints: item.hints,
                expectedConcepts: item.expectedConcepts,
                starterCode: item.starterByLanguage.typescript,
            });
            strict_1.default.equal(parsed.ok, true, `Expected ${item.id} to be valid`);
            strict_1.default.ok(item.testCases.length >= 2, `Expected >=2 testCases for ${item.id}`);
        }
    });
    (0, node_test_1.it)('filters by difficulty and topic and adapts starterCode by languageId', () => {
        strict_1.default.ok((0, challengeBank_1.listCuratedChallenges)('easy').length >= 2);
        strict_1.default.ok((0, challengeBank_1.listCuratedChallenges)('medium').length >= 2);
        strict_1.default.ok((0, challengeBank_1.listCuratedChallenges)('hard').length >= 2);
        const pyPalindrome = (0, challengeBank_1.getCuratedChallenge)({
            difficulty: 'easy',
            languageId: 'python',
            topic: 'strings',
        });
        strict_1.default.equal(pyPalindrome.id, 'easy-palindrome');
        strict_1.default.match(pyPalindrome.starterCode ?? '', /import sys/);
        strict_1.default.ok(pyPalindrome.testCases.length >= 2);
        const jsTwoSum = (0, challengeBank_1.getCuratedChallenge)({
            difficulty: 'medium',
            languageId: 'javascript',
            topic: 'arrays',
        });
        strict_1.default.equal(jsTwoSum.id, 'medium-two-sum');
        strict_1.default.match(jsTwoSum.starterCode ?? '', /require\('node:fs'\)/);
    });
});
//# sourceMappingURL=challengeBank.test.js.map