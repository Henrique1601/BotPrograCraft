"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExerciseFeedbackSchema = exports.BugAnalysisSchema = exports.BugSeveritySchema = exports.LogicChallengeSchema = exports.ChallengeDifficultySchema = void 0;
exports.extractJsonPayload = extractJsonPayload;
exports.safeParseWithSchema = safeParseWithSchema;
exports.parseLogicChallenge = parseLogicChallenge;
exports.parseBugAnalysis = parseBugAnalysis;
exports.parseExerciseFeedback = parseExerciseFeedback;
const zod_1 = require("zod");
exports.ChallengeDifficultySchema = zod_1.z.enum(['easy', 'medium', 'hard']);
exports.LogicChallengeSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, 'title must not be empty'),
    difficulty: exports.ChallengeDifficultySchema,
    prompt: zod_1.z.string().trim().min(1, 'prompt must not be empty'),
    hints: zod_1.z.array(zod_1.z.string().trim().min(1)),
    expectedConcepts: zod_1.z.array(zod_1.z.string().trim().min(1)),
    starterCode: zod_1.z.string().optional(),
});
exports.BugSeveritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
exports.BugAnalysisSchema = zod_1.z.object({
    summary: zod_1.z.string().trim().min(1, 'summary must not be empty'),
    rootCause: zod_1.z.string().trim().min(1, 'rootCause must not be empty'),
    severity: exports.BugSeveritySchema,
    suggestedFix: zod_1.z.string().trim().min(1, 'suggestedFix must not be empty'),
    explanation: zod_1.z.string().trim().min(1, 'explanation must not be empty'),
});
exports.ExerciseFeedbackSchema = zod_1.z.object({
    passed: zod_1.z.boolean(),
    score: zod_1.z.number().min(0, 'score must be >= 0').max(100, 'score must be <= 100'),
    strengths: zod_1.z.array(zod_1.z.string().trim().min(1)),
    improvements: zod_1.z.array(zod_1.z.string().trim().min(1)),
    nextStep: zod_1.z.string().trim().min(1, 'nextStep must not be empty'),
});
/**
 * Extracts a JSON object/array string from raw LLM output, stripping optional
 * markdown code fences (e.g. ```json ... ```).
 */
function extractJsonPayload(raw) {
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
function safeParseWithSchema(schema, input) {
    let candidate = input;
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
        }
        catch (err) {
            return {
                ok: false,
                error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => ({
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
function parseLogicChallenge(input) {
    return safeParseWithSchema(exports.LogicChallengeSchema, input);
}
/**
 * Safely parses and validates a `BugAnalysis` payload.
 */
function parseBugAnalysis(input) {
    return safeParseWithSchema(exports.BugAnalysisSchema, input);
}
/**
 * Safely parses and validates an `ExerciseFeedback` payload.
 */
function parseExerciseFeedback(input) {
    return safeParseWithSchema(exports.ExerciseFeedbackSchema, input);
}
//# sourceMappingURL=schemas.js.map