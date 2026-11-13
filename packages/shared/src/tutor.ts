/**
 * Supported tutoring modes for BotPrograCraft.
 */
export type TutorMode =
  | 'socratic'
  | 'pair-programming'
  | 'explain-bug'
  | 'logic-challenge'
  | 'direct';

/**
 * Ordered list of all valid TutorMode values.
 */
export const TUTOR_MODES: readonly TutorMode[] = [
  'socratic',
  'pair-programming',
  'explain-bug',
  'logic-challenge',
  'direct',
] as const;

/**
 * Human-readable metadata for each tutor mode.
 */
export interface TutorModeInfo {
  id: TutorMode;
  label: string;
  description: string;
}

export const TUTOR_MODE_INFO: Record<TutorMode, TutorModeInfo> = {
  socratic: {
    id: 'socratic',
    label: 'Socratic',
    description: 'Guides with targeted questions without spoiling the answer.',
  },
  'pair-programming': {
    id: 'pair-programming',
    label: 'Pair Programming',
    description: 'Collaborates directly on architecture, refactors, and implementation.',
  },
  'explain-bug': {
    id: 'explain-bug',
    label: 'Explain Bug',
    description: 'Diagnoses errors and explains root causes step by step.',
  },
  'logic-challenge': {
    id: 'logic-challenge',
    label: 'Logic Challenge',
    description: 'Coaches algorithmic and logic exercises using progressive hints.',
  },
  direct: {
    id: 'direct',
    label: 'Direto (Sem Filtro)',
    description:
      'Direct, unfiltered responses with complete code and immediate answers without pedagogical withholding.',
  },
};

/**
 * Runtime type guard for TutorMode.
 */
export function isTutorMode(value: unknown): value is TutorMode {
  return typeof value === 'string' && (TUTOR_MODES as readonly string[]).includes(value);
}
