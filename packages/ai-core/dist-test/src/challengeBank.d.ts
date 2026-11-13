import type { ExerciseTestCase } from './exerciseRunner';
import type { ChallengeDifficulty, LogicChallenge } from './schemas';
export interface CuratedChallenge extends LogicChallenge {
    id: string;
    topic: string;
    testCases: ExerciseTestCase[];
    starterByLanguage: Record<'javascript' | 'typescript' | 'python', string>;
}
export interface GetCuratedChallengeParams {
    difficulty: ChallengeDifficulty;
    languageId?: string;
    topic?: string;
    index?: number;
}
export declare const CURATED_CHALLENGES: readonly CuratedChallenge[];
export declare function listCuratedChallenges(difficulty?: ChallengeDifficulty): readonly CuratedChallenge[];
/**
 * Returns a curated offline logic challenge matching difficulty and optional topic/index.
 */
export declare function getCuratedChallenge(params: GetCuratedChallengeParams): LogicChallenge & {
    id: string;
    topic: string;
    testCases: ExerciseTestCase[];
};
//# sourceMappingURL=challengeBank.d.ts.map