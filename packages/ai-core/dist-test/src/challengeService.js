"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredChallengeService = exports.DEFAULT_CHALLENGE_MODEL = void 0;
const genai_1 = require("@google/genai");
const liveSession_1 = require("./liveSession");
const schemas_1 = require("./schemas");
exports.DEFAULT_CHALLENGE_MODEL = 'gemini-2.5-flash';
/**
 * Generates structured coding/logic challenges and evaluates user solutions
 * against Zod schemas using Gemini (`ai.models.generateContent`).
 */
class StructuredChallengeService {
    apiKey;
    model;
    maxAttempts;
    generateFn;
    constructor(options = {}) {
        this.apiKey = options.apiKey ?? '';
        this.model = options.model ?? exports.DEFAULT_CHALLENGE_MODEL;
        this.maxAttempts = Math.max(1, options.maxAttempts ?? 2);
        this.generateFn = options.generateFn;
    }
    async generateLogicChallenge(params) {
        const topicLine = params.topic?.trim()
            ? `Topic focus: ${params.topic.trim()}`
            : 'Topic focus: algorithms, data structures, or problem-solving logic';
        const deliveryNote = params.unfiltered
            ? 'Be direct, candid, and technically precise without unnecessary disclaimers.'
            : 'Do not include the full solution in the prompt or starterCode.';
        const prompt = `Generate a programming logic challenge as a single valid JSON object (no markdown commentary).
Requirements:
- Difficulty: "${params.difficulty}" (must match exactly: "easy" | "medium" | "hard")
- Programming language: ${params.languageId || 'typescript'}
- ${topicLine}
- Write the problem statement and hints in clear Brazilian Portuguese (pt-BR) with standard technical terms.
- ${deliveryNote}

Exact JSON schema:
{
  "title": "string (non-empty)",
  "difficulty": "${params.difficulty}",
  "prompt": "string (non-empty problem statement with examples/constraints)",
  "hints": ["string", "..."],
  "expectedConcepts": ["string", "..."],
  "starterCode": "string (optional function signature or skeleton)"
}`;
        return this.generateAndParse(prompt, Boolean(params.unfiltered), schemas_1.parseLogicChallenge, 'LogicChallenge');
    }
    async evaluateExerciseSolution(params) {
        if (!params.userCode.trim()) {
            throw new Error('User code must not be empty when evaluating a solution.');
        }
        const deliveryNote = params.unfiltered
            ? 'Be direct, objective, and candid—skip lecturing or filler, and give concrete code-level guidance.'
            : 'Be constructive, encouraging, and specific about correctness, edge cases, and complexity.';
        const prompt = `Evaluate the student's code solution for the following logic challenge and return ONLY a single valid JSON object.

Challenge:
- Title: ${params.challenge.title}
- Difficulty: ${params.challenge.difficulty}
- Prompt: ${params.challenge.prompt}
- Expected concepts: ${params.challenge.expectedConcepts.join(', ') || 'general problem solving'}

Student Solution (${params.languageId || 'plaintext'}):
\`\`\`${params.languageId || ''}
${params.userCode}
\`\`\`

Guidance:
- ${deliveryNote}
- Write feedback in clear Brazilian Portuguese (pt-BR) with standard technical terms.

Exact JSON schema:
{
  "passed": boolean,
  "score": number (0 to 100),
  "strengths": ["string", "..."],
  "improvements": ["string", "..."],
  "nextStep": "string (non-empty concrete next action)"
}`;
        return this.generateAndParse(prompt, Boolean(params.unfiltered), schemas_1.parseExerciseFeedback, 'ExerciseFeedback');
    }
    async generateAndParse(basePrompt, unfiltered, parser, schemaName) {
        let lastError = 'Unknown validation error';
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            const prompt = attempt === 1
                ? basePrompt
                : `${basePrompt}\n\nPrevious response failed ${schemaName} validation (${lastError}). Return ONLY valid JSON matching the exact schema.`;
            const raw = await this.invokeModel({
                prompt,
                model: this.model,
                unfiltered,
            });
            const parsed = parser(raw);
            if (parsed.ok) {
                return parsed.data;
            }
            lastError = parsed.error;
        }
        throw new Error(`Failed to parse ${schemaName} after ${this.maxAttempts} attempt(s): ${lastError}`);
    }
    async invokeModel(request) {
        if (this.generateFn) {
            return this.generateFn(request);
        }
        if (!this.apiKey.trim()) {
            throw new Error('Gemini API key is required for StructuredChallengeService.');
        }
        const ai = new genai_1.GoogleGenAI({ apiKey: this.apiKey });
        const response = await ai.models.generateContent({
            model: request.model,
            contents: request.prompt,
            config: {
                responseMimeType: 'application/json',
                ...(request.unfiltered ? { safetySettings: (0, liveSession_1.buildPermissiveSafetySettings)() } : {}),
            },
        });
        return response.text ?? '';
    }
}
exports.StructuredChallengeService = StructuredChallengeService;
//# sourceMappingURL=challengeService.js.map