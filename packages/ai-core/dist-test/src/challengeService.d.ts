import { type ChallengeDifficulty, type ExerciseFeedback, type LogicChallenge } from './schemas';
export declare const DEFAULT_CHALLENGE_MODEL = "gemini-2.5-flash";
export interface GenerateChallengeParams {
    difficulty: ChallengeDifficulty;
    languageId: string;
    topic?: string;
    unfiltered?: boolean;
}
export interface EvaluateSolutionParams {
    challenge: LogicChallenge;
    userCode: string;
    languageId: string;
    unfiltered?: boolean;
}
export interface ChallengeGenerateRequest {
    prompt: string;
    model: string;
    unfiltered: boolean;
}
export type ChallengeGenerateFn = (request: ChallengeGenerateRequest) => Promise<string>;
export interface StructuredChallengeServiceOptions {
    apiKey?: string;
    model?: string;
    maxAttempts?: number;
    generateFn?: ChallengeGenerateFn;
}
/**
 * Generates structured coding/logic challenges and evaluates user solutions
 * against Zod schemas using Gemini (`ai.models.generateContent`).
 */
export declare class StructuredChallengeService {
    private readonly apiKey;
    private readonly model;
    private readonly maxAttempts;
    private readonly generateFn?;
    constructor(options?: StructuredChallengeServiceOptions);
    generateLogicChallenge(params: GenerateChallengeParams): Promise<LogicChallenge>;
    evaluateExerciseSolution(params: EvaluateSolutionParams): Promise<ExerciseFeedback>;
    private generateAndParse;
    private invokeModel;
}
//# sourceMappingURL=challengeService.d.ts.map