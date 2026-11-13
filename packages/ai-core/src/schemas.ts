import { z } from 'zod';

export const ChallengeDifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type ChallengeDifficulty = z.infer<typeof ChallengeDifficultySchema>;

export const LogicChallengeSchema = z.object({
  title: z.string().trim().min(1, 'title must not be empty'),
  difficulty: ChallengeDifficultySchema,
  prompt: z.string().trim().min(1, 'prompt must not be empty'),
  hints: z.array(z.string().trim().min(1)),
  expectedConcepts: z.array(z.string().trim().min(1)),
  starterCode: z.string().optional(),
});
export type LogicChallenge = z.infer<typeof LogicChallengeSchema>;

export const BugSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type BugSeverity = z.infer<typeof BugSeveritySchema>;

export const BugAnalysisSchema = z.object({
  summary: z.string().trim().min(1, 'summary must not be empty'),
  rootCause: z.string().trim().min(1, 'rootCause must not be empty'),
  severity: BugSeveritySchema,
  suggestedFix: z.string().trim().min(1, 'suggestedFix must not be empty'),
  explanation: z.string().trim().min(1, 'explanation must not be empty'),
});
export type BugAnalysis = z.infer<typeof BugAnalysisSchema>;

export const ExerciseFeedbackSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0, 'score must be >= 0').max(100, 'score must be <= 100'),
  strengths: z.array(z.string().trim().min(1)),
  improvements: z.array(z.string().trim().min(1)),
  nextStep: z.string().trim().min(1, 'nextStep must not be empty'),
});
export type ExerciseFeedback = z.infer<typeof ExerciseFeedbackSchema>;

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export type SafeParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: SchemaValidationIssue[] };

/**
 * Extracts a JSON object/array string from raw LLM output, stripping optional
 * markdown code fences (e.g. ```json ... ```).
 */
export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const inlineFenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (inlineFenceMatch) {
    return inlineFenceMatch[1].trim();
  }

  return trimmed;
}

/**
 * Safely parses either a raw JSON string (with optional markdown fences) or an
 * already-parsed unknown value against a Zod schema without throwing.
 */
export function safeParseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): SafeParseResult<z.infer<TSchema>> {
  let candidate: unknown = input;

  if (typeof input === 'string') {
    const cleaned = extractJsonPayload(input);
    if (!cleaned) {
      return {
        ok: false,
        error: 'Empty JSON input',
      };
    }

    try {
      candidate = JSON.parse(cleaned);
    } catch (err) {
      return {
        ok: false,
        error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    const issues: SchemaValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '<root>',
      message: issue.message,
    }));
    return {
      ok: false,
      error: issues.map((i) => `${i.path}: ${i.message}`).join('; '),
      issues,
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

/**
 * Safely parses and validates a `LogicChallenge` payload.
 */
export function parseLogicChallenge(input: unknown): SafeParseResult<LogicChallenge> {
  return safeParseWithSchema(LogicChallengeSchema, input);
}

/**
 * Safely parses and validates a `BugAnalysis` payload.
 */
export function parseBugAnalysis(input: unknown): SafeParseResult<BugAnalysis> {
  return safeParseWithSchema(BugAnalysisSchema, input);
}

/**
 * Safely parses and validates an `ExerciseFeedback` payload.
 */
export function parseExerciseFeedback(input: unknown): SafeParseResult<ExerciseFeedback> {
  return safeParseWithSchema(ExerciseFeedbackSchema, input);
}
