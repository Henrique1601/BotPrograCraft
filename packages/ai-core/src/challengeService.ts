import { GoogleGenAI } from '@google/genai';
import { getCuratedChallenge } from './challengeBank';
import {
  runExerciseCheck,
  type ExerciseLanguage,
  type ExerciseTestCase,
} from './exerciseRunner';
import { buildPermissiveSafetySettings } from './liveSession';
import type { OllamaClient } from './ollamaClient';
import {
  parseExerciseFeedback,
  parseLogicChallenge,
  type ChallengeDifficulty,
  type ExerciseFeedback,
  type LogicChallenge,
  type SafeParseResult,
} from './schemas';

export const DEFAULT_CHALLENGE_MODEL = 'gemini-2.5-flash';

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

function normalizeExerciseLanguage(languageId: string): ExerciseLanguage {
  const normalized = languageId.trim().toLowerCase();
  if (normalized === 'python' || normalized === 'py') return 'python';
  if (normalized === 'javascript' || normalized === 'js') return 'javascript';
  return 'typescript';
}

/**
 * Generates structured coding/logic challenges and evaluates user solutions
 * against Zod schemas using Gemini, with optional Ollama and curated offline fallbacks.
 */
export class StructuredChallengeService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxAttempts: number;
  private readonly generateFn?: ChallengeGenerateFn;
  private readonly ollamaClient?: OllamaClient;
  private readonly ollamaModel?: string;

  constructor(options: StructuredChallengeServiceOptions = {}) {
    this.apiKey = options.apiKey ?? '';
    this.model = options.model ?? DEFAULT_CHALLENGE_MODEL;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 2);
    this.generateFn = options.generateFn;
    this.ollamaClient = options.ollamaClient;
    this.ollamaModel = options.ollamaModel;
  }

  async generateLogicChallenge(
    params: GenerateChallengeParams,
  ): Promise<GeneratedLogicChallenge> {
    const prompt = this.buildChallengePrompt(params);
    const unfiltered = Boolean(params.unfiltered);

    if (this.hasGeminiProvider()) {
      try {
        const challenge = await this.generateAndParse(
          (p) => this.invokeGemini({ prompt: p, model: this.model, unfiltered }),
          prompt,
          parseLogicChallenge,
          'LogicChallenge',
        );
        return { ...challenge, source: 'gemini' };
      } catch {
        // Fall through to Ollama or curated offline bank.
      }
    }

    if (this.ollamaClient) {
      try {
        const health = await this.ollamaClient.checkHealth();
        if (health.available) {
          const model = this.ollamaModel?.trim() || health.models[0];
          const ollamaClient = this.ollamaClient;
          const challenge = await this.generateAndParse(
            (p) => ollamaClient.chat({ model, prompt: p }),
            prompt,
            parseLogicChallenge,
            'LogicChallenge',
          );
          return { ...challenge, source: 'ollama' };
        }
      } catch {
        // Fall through to curated offline bank.
      }
    }

    const curated = getCuratedChallenge({
      difficulty: params.difficulty,
      languageId: params.languageId,
      topic: params.topic,
      index: params.index,
    });
    return {
      title: curated.title,
      difficulty: curated.difficulty,
      prompt: curated.prompt,
      hints: curated.hints,
      expectedConcepts: curated.expectedConcepts,
      starterCode: curated.starterCode,
      testCases: curated.testCases,
      source: 'curated',
    };
  }

  async evaluateExerciseSolution(params: EvaluateSolutionParams): Promise<ExerciseFeedback> {
    if (!params.userCode.trim()) {
      throw new Error('User code must not be empty when evaluating a solution.');
    }

    const prompt = this.buildEvaluationPrompt(params);
    const unfiltered = Boolean(params.unfiltered);

    if (this.hasGeminiProvider()) {
      try {
        return await this.generateAndParse(
          (p) => this.invokeGemini({ prompt: p, model: this.model, unfiltered }),
          prompt,
          parseExerciseFeedback,
          'ExerciseFeedback',
        );
      } catch (err) {
        if (!this.ollamaClient && (!params.testCases || params.testCases.length === 0)) {
          throw err;
        }
      }
    }

    if (this.ollamaClient) {
      try {
        const health = await this.ollamaClient.checkHealth();
        if (health.available) {
          const model = this.ollamaModel?.trim() || health.models[0];
          const ollamaClient = this.ollamaClient;
          return await this.generateAndParse(
            (p) => ollamaClient.chat({ model, prompt: p }),
            prompt,
            parseExerciseFeedback,
            'ExerciseFeedback',
          );
        }
      } catch (err) {
        if (!params.testCases || params.testCases.length === 0) {
          throw err;
        }
      }
    }

    if (params.testCases && params.testCases.length > 0) {
      const check = await runExerciseCheck({
        language: normalizeExerciseLanguage(params.languageId),
        code: params.userCode,
        testCases: params.testCases,
      });
      const score =
        check.totalCount > 0 ? Math.round((check.passedCount / check.totalCount) * 100) : 0;
      const failedCases = check.results.filter((r) => !r.passed);

      return {
        passed: check.passed,
        score,
        strengths:
          check.passedCount > 0
            ? [`Passou em ${check.passedCount} de ${check.totalCount} caso(s) de teste.`]
            : ['Código executado localmente sem depender de API externa.'],
        improvements:
          failedCases.length > 0
            ? failedCases.slice(0, 3).map((fc, idx) =>
                fc.error
                  ? `Caso ${idx + 1}: erro de execução (${fc.error}).`
                  : `Caso ${idx + 1}: esperado "${fc.expectedOutput}", obtido "${fc.actualOutput}".`,
              )
            : ['Nenhum erro encontrado nos casos de teste locais.'],
        nextStep: check.passed
          ? 'Excelente! Tente otimizar a complexidade ou gerar um desafio mais difícil.'
          : 'Revise os casos de teste que falharam e tente novamente.',
      };
    }

    throw new Error('Gemini API key is required for StructuredChallengeService.');
  }

  private hasGeminiProvider(): boolean {
    return Boolean(this.generateFn || this.apiKey.trim());
  }

  private buildChallengePrompt(params: GenerateChallengeParams): string {
    const topicLine = params.topic?.trim()
      ? `Topic focus: ${params.topic.trim()}`
      : 'Topic focus: algorithms, data structures, or problem-solving logic';

    const deliveryNote = params.unfiltered
      ? 'Be direct, candid, and technically precise without unnecessary disclaimers.'
      : 'Do not include the full solution in the prompt or starterCode.';

    return `Generate a programming logic challenge as a single valid JSON object (no markdown commentary).
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
  }

  private buildEvaluationPrompt(params: EvaluateSolutionParams): string {
    const deliveryNote = params.unfiltered
      ? 'Be direct, objective, and candid—skip lecturing or filler, and give concrete code-level guidance.'
      : 'Be constructive, encouraging, and specific about correctness, edge cases, and complexity.';

    return `Evaluate the student's code solution for the following logic challenge and return ONLY a single valid JSON object.

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
  }

  private async generateAndParse<T>(
    invoke: (prompt: string) => Promise<string>,
    basePrompt: string,
    parser: (raw: unknown) => SafeParseResult<T>,
    schemaName: string,
  ): Promise<T> {
    let lastError = 'Unknown validation error';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const prompt =
        attempt === 1
          ? basePrompt
          : `${basePrompt}\n\nPrevious response failed ${schemaName} validation (${lastError}). Return ONLY valid JSON matching the exact schema.`;

      const raw = await invoke(prompt);
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

  private async invokeGemini(request: ChallengeGenerateRequest): Promise<string> {
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
