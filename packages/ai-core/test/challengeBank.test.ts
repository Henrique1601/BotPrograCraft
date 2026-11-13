import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURATED_CHALLENGES,
  getCuratedChallenge,
  listCuratedChallenges,
} from '../src/challengeBank';
import { parseLogicChallenge } from '../src/schemas';

describe('challengeBank', () => {
  it('all curated challenges pass LogicChallengeSchema and include testCases', () => {
    assert.ok(CURATED_CHALLENGES.length >= 6);
    for (const item of CURATED_CHALLENGES) {
      const parsed = parseLogicChallenge({
        title: item.title,
        difficulty: item.difficulty,
        prompt: item.prompt,
        hints: item.hints,
        expectedConcepts: item.expectedConcepts,
        starterCode: item.starterByLanguage.typescript,
      });
      assert.equal(parsed.ok, true, `Expected ${item.id} to be valid`);
      assert.ok(item.testCases.length >= 2, `Expected >=2 testCases for ${item.id}`);
    }
  });

  it('filters by difficulty and topic and adapts starterCode by languageId', () => {
    assert.ok(listCuratedChallenges('easy').length >= 2);
    assert.ok(listCuratedChallenges('medium').length >= 2);
    assert.ok(listCuratedChallenges('hard').length >= 2);

    const pyPalindrome = getCuratedChallenge({
      difficulty: 'easy',
      languageId: 'python',
      topic: 'strings',
    });
    assert.equal(pyPalindrome.id, 'easy-palindrome');
    assert.match(pyPalindrome.starterCode ?? '', /import sys/);
    assert.ok(pyPalindrome.testCases.length >= 2);

    const jsTwoSum = getCuratedChallenge({
      difficulty: 'medium',
      languageId: 'javascript',
      topic: 'arrays',
    });
    assert.equal(jsTwoSum.id, 'medium-two-sum');
    assert.match(jsTwoSum.starterCode ?? '', /require\('node:fs'\)/);
  });
});
