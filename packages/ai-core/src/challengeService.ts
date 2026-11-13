import { GoogleGenAI } from '@google/genai';
import { buildPermissiveSafetySettings } from './liveSession';
import {
  parseExerciseFeedback,
  parseLogicChallenge,
  type ChallengeDifficulty,
  type ExerciseFeedback,
  type LogicChallenge,
  type SafeParseResult,
} from './schemas';

export const DEFAULT_CHALLENGE_MODEL = 'gemini-2.5-flash';

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
export class StructuredChallengeService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxAttempts: number;
  private readonly generateFn?: ChallengeGenerateFn;

  constructor(options: StructuredChallengeServiceOptions = {}) {
    this.apiKey = options.apiKey ?? '';
    this.model = options.model ?? DEFAULT_CHALLENGE_MODEL;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 2);
    this.generateFn = options.generateFn;
  }

  async generateLogicChallenge(params: GenerateChallengeParams): Promise<LogicChallenge> {
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

    return this.generateAndParse(
      prompt,
      Boolean(params.unfiltered),
      parseLogicChallenge,
      'LogicChallenge',
    );
  }

  async evaluateExerciseSolution(params: EvaluateSolutionParams): Promise<ExerciseFeedback> {
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

    return this.generateAndParse(
      prompt,
      Boolean(params.unfiltered),
      parseExerciseFeedback,
      'ExerciseFeedback',
    );
  }

  private async generateAndParse<T>(
    basePrompt: string,
    unfiltered: boolean,
    parser: (raw: unknown) => SafeParseResult<T>,
    schemaName: string,
  ): Promise<T> {
    let lastError = 'Unknown validation error';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const prompt =
        attempt === 1
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

    throw new Error(
      `Failed to parse ${schemaName} after ${this.maxAttempts} attempt(s): ${lastError}`,
    );
  }

  private async invokeModel(request: ChallengeGenerateRequest): Promise<string> {
    if (this.generateFn) {
      return this.generateFn(request);
    }

    if (!this.apiKey.trim()) {
      throw new Error('Gemini API key is required for StructuredChallengeService.');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await ai.models.generateContent({
      model: request.model,
      contents: request.prompt,
      config: {
        responseMimeType: 'application/json',
        ...(request.unfiltered ? { safetySettings: buildPermissiveSafetySettings() } : {}),
      },
    });

    return response.text ?? '';
  }
}
