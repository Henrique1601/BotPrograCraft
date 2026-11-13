import { type TutorMode } from '@botprogracraft/shared';
export interface PromptBuilderOptions {
    mode: TutorMode;
    unfiltered?: boolean;
    preferredLanguage?: 'auto' | 'pt-BR' | 'en';
    studentGoal?: string;
    extraInstructions?: string;
}
/**
 * Builds the system instruction for Gemini Live / text sessions based on the selected TutorMode.
 */
export declare function buildSystemPrompt(options: PromptBuilderOptions): string;
export declare function getSupportedTutorModes(): TutorMode[];
//# sourceMappingURL=prompts.d.ts.map