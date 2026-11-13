export type ExerciseLanguage = 'javascript' | 'typescript' | 'python';
export interface ExerciseTestCase {
    input: string;
    expectedOutput: string;
}
export interface ExerciseTestCaseResult {
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error?: string;
}
export interface ExerciseCheckParams {
    language: ExerciseLanguage;
    code: string;
    testCases: ExerciseTestCase[];
    timeoutMs?: number;
}
export interface ExerciseCheckResult {
    passed: boolean;
    passedCount: number;
    totalCount: number;
    results: ExerciseTestCaseResult[];
}
/**
 * Executes user code against test cases in isolated child processes with a strict timeout.
 */
export declare function runExerciseCheck(params: ExerciseCheckParams): Promise<ExerciseCheckResult>;
//# sourceMappingURL=exerciseRunner.d.ts.map