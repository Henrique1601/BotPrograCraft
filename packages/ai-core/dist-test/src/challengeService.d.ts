import { type ExerciseTestCase } from './exerciseRunner';
import type { OllamaClient } from './ollamaClient';
import { type ChallengeDifficulty, type ExerciseFeedback, type LogicChallenge } from './schemas';
export declare const DEFAULT_CHALLENGE_MODEL = "gemini-2.5-flash";
export type ChallengeSource = 'gemini' | 'ollama' | 'curated';
export type GeneratedLogicChallenge = LogicChallenge & {
    testCases?: ExerciseTestCase[];
    source?: ChallengeSource;
};
export interface GenerateChallengeParams {
    difficulty: ChallengeDifficulty;
    languageId: string;
    topic?: string;
    unfiltered?: boolean;
    index?: number;
}
export interface EvaluateSolutionParams {
    challenge: LogicChallenge;
    userCode: string;
    languageId: string;
    unfiltered?: boolean;
    testCases?: ExerciseTestCase[];
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
    ollamaClient?: OllamaClient;
    ollamaModel?: string;
}
/**
 * Generates structured coding/logic challenges and evaluates user solutions
 * against Zod schemas using Gemini, with optional Ollama and curated offline fallbacks.
 */
export declare class StructuredChallengeService {
    private readonly apiKey;
    private readonly model;
    private readonly maxAttempts;
    private readonly generateFn?;
    private readonly ollamaClient?;
    private readonly ollamaModel?;
    constructor(options?: StructuredChallengeServiceOptions);
    generateLogicChallenge(params: GenerateChallengeParams): Promise<GeneratedLogicChallenge>;
    evaluateExerciseSolution(params: EvaluateSolutionParams): Promise<ExerciseFeedback>;
    private hasGeminiProvider;
    private buildChallengePrompt;
    private buildEvaluationPrompt;
    private generateAndParse;
    private invokeGemini;
}
//# sourceMappingURL=challengeService.d.ts.map