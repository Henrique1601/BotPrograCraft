import type { ExerciseTestCase } from './exerciseRunner';
import type { ChallengeDifficulty, LogicChallenge } from './schemas';

export interface CuratedChallenge extends LogicChallenge {
  id: string;
  topic: string;
  testCases: ExerciseTestCase[];
  starterByLanguage: Record<'javascript' | 'typescript' | 'python', string>;
}

export interface GetCuratedChallengeParams {
  difficulty: ChallengeDifficulty;
  languageId?: string;
  topic?: string;
  index?: number;
}

export const CURATED_CHALLENGES: readonly CuratedChallenge[] = [
  {
    id: 'easy-sum-evens',
    topic: 'loops',
    title: 'Soma dos Pares (Loops)',
    difficulty: 'easy',
    prompt:
      'Leia uma linha de inteiros separados por espaço da entrada padrão (stdin) e imprima a soma apenas dos números pares.\n\nExemplo:\nEntrada: 1 2 3 4 5 6\nSaída: 12',
    hints: [
      'Use split(/\\s+/) para separar os números e converta cada item para inteiro.',
      'Um número n é par quando n % 2 === 0.',
    ],
    expectedConcepts: ['loops', 'modulo operator', 'stdin parsing'],
    starterByLanguage: {
      javascript: `const fs = require('node:fs');\nconst nums = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).filter(Boolean).map(Number);\n// Imprima a soma dos números pares\n`,
      typescript: `import fs from 'node:fs';\nconst nums: number[] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).filter(Boolean).map(Number);\n// Imprima a soma dos números pares\n`,
      python: `import sys\nnums = [int(x) for x in sys.stdin.read().split()]\n# Imprima a soma dos números pares\n`,
    },
    testCases: [
      { input: '1 2 3 4 5 6', expectedOutput: '12' },
      { input: '1 3 5', expectedOutput: '0' },
      { input: '-2 4 7', expectedOutput: '2' },
    ],
  },
  {
    id: 'easy-palindrome',
    topic: 'strings',
    title: 'Verificador de Palíndromo (Strings)',
    difficulty: 'easy',
    prompt:
      'Leia uma string da entrada padrão (stdin), ignore maiúsculas/minúsculas e espaços, e imprima "true" se for um palíndromo ou "false" caso contrário.\n\nExemplo:\nEntrada: A man a plan a canal Panama\nSaída: true',
    hints: [
      'Normalize a string removendo espaços e convertendo para minúsculas.',
      'Compare os caracteres das extremidades usando dois ponteiros (início e fim).',
    ],
    expectedConcepts: ['strings', 'two pointers', 'normalization'],
    starterByLanguage: {
      javascript: `const fs = require('node:fs');\nconst raw = fs.readFileSync(0, 'utf8').trim();\n// Imprima "true" ou "false"\n`,
      typescript: `import fs from 'node:fs';\nconst raw: string = fs.readFileSync(0, 'utf8').trim();\n// Imprima "true" ou "false"\n`,
      python: `import sys\nraw = sys.stdin.read().strip()\n# Imprima "true" ou "false"\n`,
    },
    testCases: [
      { input: 'arara', expectedOutput: 'true' },
      { input: 'A man a plan a canal Panama', expectedOutput: 'true' },
      { input: 'botprogracraft', expectedOutput: 'false' },
    ],
  },
  {
    id: 'medium-two-sum',
    topic: 'arrays',
    title: 'Two Sum Ordenado por Índice (Arrays & Hash Map)',
    difficulty: 'medium',
    prompt:
      'A primeira linha da entrada contém o alvo (target). A segunda linha contém inteiros separados por espaço. Imprima os dois índices (base 0, separados por espaço) cuja soma é igual ao alvo.\n\nExemplo:\nEntrada:\n9\n2 7 11 15\nSaída:\n0 1',
    hints: [
      'Armazene cada número já visto em um Map/dicionário mapeando valor -> índice.',
      'Para cada elemento x, verifique se (target - x) já está no Map.',
    ],
    expectedConcepts: ['arrays', 'hash map', 'O(n) time complexity'],
    starterByLanguage: {
      javascript: `const fs = require('node:fs');\nconst [line1, line2] = fs.readFileSync(0, 'utf8').trim().split(/\\r?\\n/);\nconst target = Number(line1);\nconst nums = line2.trim().split(/\\s+/).map(Number);\n// Imprima "i j"\n`,
      typescript: `import fs from 'node:fs';\nconst [line1, line2] = fs.readFileSync(0, 'utf8').trim().split(/\\r?\\n/);\nconst target: number = Number(line1);\nconst nums: number[] = line2.trim().split(/\\s+/).map(Number);\n// Imprima "i j"\n`,
      python: `import sys\nlines = sys.stdin.read().strip().splitlines()\ntarget = int(lines[0])\nnums = [int(x) for x in lines[1].split()]\n# Imprima "i j"\n`,
    },
    testCases: [
      { input: '9\n2 7 11 15', expectedOutput: '0 1' },
      { input: '6\n3 2 4', expectedOutput: '1 2' },
      { input: '6\n3 3', expectedOutput: '0 1' },
    ],
  },
  {
    id: 'medium-valid-parens',
    topic: 'data structures',
    title: 'Parênteses Balanceados (Pilha)',
    difficulty: 'medium',
    prompt:
      'Dada uma string contendo apenas (), [], {}, imprima "true" se os delimitadores estiverem corretamente balanceados e aninhados, ou "false" caso contrário.\n\nExemplo:\nEntrada: ({[]})\nSaída: true',
    hints: [
      'Use uma pilha (stack) para empilhar os caracteres de abertura.',
      'Ao encontrar um caractere de fechamento, confira se o topo da pilha corresponde ao par esperado.',
    ],
    expectedConcepts: ['stack', 'data structures', 'matching pairs'],
    starterByLanguage: {
      javascript: `const fs = require('node:fs');\nconst s = fs.readFileSync(0, 'utf8').trim();\n// Imprima "true" ou "false"\n`,
      typescript: `import fs from 'node:fs';\nconst s: string = fs.readFileSync(0, 'utf8').trim();\n// Imprima "true" ou "false"\n`,
      python: `import sys\ns = sys.stdin.read().strip()\n# Imprima "true" ou "false"\n`,
    },
    testCases: [
      { input: '({[]})', expectedOutput: 'true' },
      { input: '([)]', expectedOutput: 'false' },
      { input: '((()))', expectedOutput: 'true' },
    ],
  },
  {
    id: 'hard-subsets-sum',
    topic: 'recursion',
    title: 'Soma de Subconjuntos (Recursão / Backtracking)',
    difficulty: 'hard',
    prompt:
      'A primeira linha contém um inteiro alvo S. A segunda linha contém inteiros positivos separados por espaço. Imprima "true" se existir algum subconjunto cuja soma seja exatamente S, ou "false" caso contrário.\n\nExemplo:\nEntrada:\n9\n3 34 4 12 5 2\nSaída: true',
    hints: [
      'Em cada índice i, você tem duas escolhas recursivas: incluir nums[i] ou pular nums[i].',
      'Casos base: se somaRestante === 0 retorne true; se somaRestante < 0 ou i >= n retorne false.',
    ],
    expectedConcepts: ['recursion', 'backtracking', 'memoization'],
    starterByLanguage: {
      javascript: `const fs = require('node:fs');\nconst [line1, line2] = fs.readFileSync(0, 'utf8').trim().split(/\\r?\\n/);\nconst target = Number(line1);\nconst nums = line2.trim().split(/\\s+/).map(Number);\n// Imprima "true" ou "false"\n`,
      typescript: `import fs from 'node:fs';\nconst [line1, line2] = fs.readFileSync(0, 'utf8').trim().split(/\\r?\\n/);\nconst target: number = Number(line1);\nconst nums: number[] = line2.trim().split(/\\s+/).map(Number);\n// Imprima "true" ou "false"\n`,
      python: `import sys\nlines = sys.stdin.read().strip().splitlines()\ntarget = int(lines[0])\nnums = [int(x) for x in lines[1].split()]\n# Imprima "true" ou "false"\n`,
    },
    testCases: [
      { input: '9\n3 34 4 12 5 2', expectedOutput: 'true' },
      { input: '30\n3 34 4 12 5 2', expectedOutput: 'false' },
      { input: '7\n2 3 7 8 10', expectedOutput: 'true' },
    ],
  },
  {
    id: 'hard-lis-length',
    topic: 'data structures',
    title: 'Maior Subsequência Crescente (LIS)',
    difficulty: 'hard',
    prompt:
      'Leia uma lista de inteiros separados por espaço e imprima o comprimento da maior subsequência estritamente crescente.\n\nExemplo:\nEntrada: 10 9 2 5 3 7 101 18\nSaída: 4',
    hints: [
      'Programação dinâmica O(n²): dp[i] é o tamanho da LIS terminando no índice i.',
      'Para otimizar para O(n log n), mantenha um array de menores caudas e use busca binária.',
    ],
    expectedConcepts: ['dynamic programming', 'binary search', 'arrays'],
    starterByLanguage: {
      javascript: `const fs = require('node:fs');\nconst nums = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).filter(Boolean).map(Number);\n// Imprima o tamanho da LIS\n`,
      typescript: `import fs from 'node:fs';\nconst nums: number[] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).filter(Boolean).map(Number);\n// Imprima o tamanho da LIS\n`,
      python: `import sys\nnums = [int(x) for x in sys.stdin.read().split()]\n# Imprima o tamanho da LIS\n`,
    },
    testCases: [
      { input: '10 9 2 5 3 7 101 18', expectedOutput: '4' },
      { input: '0 1 0 3 2 3', expectedOutput: '4' },
      { input: '7 7 7 7', expectedOutput: '1' },
    ],
  },
];

function resolveStarterLanguage(languageId?: string): 'javascript' | 'typescript' | 'python' {
  const normalized = (languageId ?? '').toLowerCase();
  if (normalized === 'python' || normalized === 'py') return 'python';
  if (normalized === 'javascript' || normalized === 'js') return 'javascript';
  return 'typescript';
}

export function listCuratedChallenges(
  difficulty?: ChallengeDifficulty,
): readonly CuratedChallenge[] {
  if (!difficulty) return CURATED_CHALLENGES;
  return CURATED_CHALLENGES.filter((c) => c.difficulty === difficulty);
}

/**
 * Returns a curated offline logic challenge matching difficulty and optional topic/index.
 */
export function getCuratedChallenge(
  params: GetCuratedChallengeParams,
): LogicChallenge & { id: string; topic: string; testCases: ExerciseTestCase[] } {
  const byDifficulty = listCuratedChallenges(params.difficulty);
  const pool = byDifficulty.length > 0 ? byDifficulty : CURATED_CHALLENGES;

  let filtered = pool;
  if (params.topic?.trim()) {
    const needle = params.topic.trim().toLowerCase();
    const topicMatches = pool.filter(
      (c) =>
        c.topic.toLowerCase().includes(needle) ||
        c.title.toLowerCase().includes(needle) ||
        c.expectedConcepts.some((concept) => concept.toLowerCase().includes(needle)),
    );
    if (topicMatches.length > 0) {
      filtered = topicMatches;
    }
  }

  const index = Math.abs(params.index ?? 0) % filtered.length;
  const chosen = filtered[index];
  const lang = resolveStarterLanguage(params.languageId);

  return {
    id: chosen.id,
    topic: chosen.topic,
    title: chosen.title,
    difficulty: chosen.difficulty,
    prompt: chosen.prompt,
    hints: [...chosen.hints],
    expectedConcepts: [...chosen.expectedConcepts],
    starterCode: chosen.starterByLanguage[lang],
    testCases: chosen.testCases.map((tc) => ({ ...tc })),
  };
}
