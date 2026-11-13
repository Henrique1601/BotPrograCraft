import { z } from 'zod';
export declare const ChallengeDifficultySchema: z.ZodEnum<{
    easy: "easy";
    medium: "medium";
    hard: "hard";
}>;
export type ChallengeDifficulty = z.infer<typeof ChallengeDifficultySchema>;
export declare const LogicChallengeSchema: z.ZodObject<{
    title: z.ZodString;
    difficulty: z.ZodEnum<{
        easy: "easy";
        medium: "medium";
        hard: "hard";
    }>;
    prompt: z.ZodString;
    hints: z.ZodArray<z.ZodString>;
    expectedConcepts: z.ZodArray<z.ZodString>;
    starterCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LogicChallenge = z.infer<typeof LogicChallengeSchema>;
export declare const BugSeveritySchema: z.ZodEnum<{
    medium: "medium";
    low: "low";
    high: "high";
    critical: "critical";
}>;
export type BugSeverity = z.infer<typeof BugSeveritySchema>;
export declare const BugAnalysisSchema: z.ZodObject<{
    summary: z.ZodString;
    rootCause: z.ZodString;
    severity: z.ZodEnum<{
        medium: "medium";
        low: "low";
        high: "high";
        critical: "critical";
    }>;
    suggestedFix: z.ZodString;
    explanation: z.ZodString;
}, z.core.$strip>;
export type BugAnalysis = z.infer<typeof BugAnalysisSchema>;
export declare const ExerciseFeedbackSchema: z.ZodObject<{
    passed: z.ZodBoolean;
    score: z.ZodNumber;
    strengths: z.ZodArray<z.ZodString>;
    improvements: z.ZodArray<z.ZodString>;
    nextStep: z.ZodString;
}, z.core.$strip>;
export type ExerciseFeedback = z.infer<typeof ExerciseFeedbackSchema>;
export interface SchemaValidationIssue {
    path: string;
    message: string;
}
export type SafeParseResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    issues?: SchemaValidationIssue[];
};
/**
 * Extracts a JSON object/array string from raw LLM output, stripping optional
 * markdown code fences (e.g. ```json ... ```).
 */
export declare function extractJsonPayload(raw: string): string;
/**
 * Safely parses either a raw JSON string (with optional markdown fences) or an
 * already-parsed unknown value against a Zod schema without throwing.
 */
export declare function safeParseWithSchema<TSchema extends z.ZodType>(schema: TSchema, input: unknown): SafeParseResult<z.infer<TSchema>>;
/**
 * Safely parses and validates a `LogicChallenge` payload.
 */
export declare function parseLogicChallenge(input: unknown): SafeParseResult<LogicChallenge>;
/**
 * Safely parses and validates a `BugAnalysis` payload.
 */
export declare function parseBugAnalysis(input: unknown): SafeParseResult<BugAnalysis>;
/**
 * Safely parses and validates an `ExerciseFeedback` payload.
 */
export declare function parseExerciseFeedback(input: unknown): SafeParseResult<ExerciseFeedback>;
//# sourceMappingURL=schemas.d.ts.map