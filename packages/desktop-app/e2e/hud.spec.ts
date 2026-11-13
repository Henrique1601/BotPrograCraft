import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const noop = () => () => {};
    (window as unknown as { botprogracraft: Record<string, unknown> }).botprogracraft = {
      getInitialState: async () => ({
        ideConnected: true,
        ideContext: {
          activeFile: 'src/index.ts',
          languageId: 'typescript',
          selection: null,
          visibleRangeText: 'const x = 1;',
          diagnostics: [],
          workspaceName: 'BotPrograCraft',
          timestamp: Date.now(),
        },
        liveStatus: 'disconnected',
        tutorMode: 'socratic',
        screenShareEnabled: false,
        latestFrame: null,
        apiKeyConfigured: false,
        selectedCaptureSourceId: null,
        aiProvider: 'gemini-live',
        ollamaModel: 'llama3.2',
      }),
      captureScreenFrame: async () => null,
      listCaptureSources: async () => [],
      setCaptureSource: async () => {},
      setScreenShareEnabled: async () => {},
      setTutorMode: async () => {},
      setAiProvider: async () => {},
      checkOllamaHealth: async () => ({ available: false, models: [] }),
      startLiveSession: async () => {},
      stopLiveSession: async () => {},
      sendTextTurn: async () => {},
      sendAudioChunk: () => {},
      requestIdeContext: async () => {},
      toggleMinimize: async () => {},
      getProgressStats: async () => ({
        totalAttempts: 3,
        passedAttempts: 2,
        totalMessages: 12,
        recurringErrorCount: 1,
      }),
      listRecentAttempts: async () => [],
      listRecurringErrors: async () => [],
      generateLogicChallenge: async () => ({
        title: 'Soma de Array',
        difficulty: 'easy',
        prompt: 'Calcule a soma dos elementos.',
        hints: ['Use um loop'],
        expectedConcepts: ['arrays'],
        testCases: [{ input: '', expectedOutput: '6' }],
      }),
      evaluateSolution: async () => ({
        passed: true,
        score: 100,
        strengths: ['Correto'],
        improvements: [],
        nextStep: 'Próximo desafio',
      }),
      runExerciseCheck: async () => ({
        passed: true,
        passedCount: 1,
        totalCount: 1,
        results: [{ input: '', expectedOutput: '6', actualOutput: '6', passed: true }],
      }),
      installAntigravityMcp: async () => ({
        configPath: 'C:/mock/.gemini/antigravity/mcp_config.json',
        backupPath: null,
        serverEntryPath: 'C:/mock/packages/mcp-server/dist/index.js',
      }),
      exportStudyReport: async () => ({
        markdown: '# Study Report',
        savedPath: 'C:/mock/.botprogracraft/reports/report.md',
      }),
      onIdeConnection: noop,
      onIdeContext: noop,
      onLiveStatus: noop,
      onTranscript: noop,
      onSpeakText: noop,
      onAudioOutput: noop,
      onInterrupted: noop,
      onTurnComplete: noop,
      onScreenFrame: noop,
      onScreenFramePreview: noop,
      onPushToTalkShortcut: noop,
      onPushToTalkToggle: noop,
    };
  });
});

test('renders all 5 tutor modes including Direto (Sem Filtro) and switches mode', async ({
  page,
}) => {
  await page.goto('/');

  const modesGroup = page.getByLabel('Tutor Mode');
  await expect(modesGroup.getByRole('button', { name: 'Socratic' })).toBeVisible();
  await expect(modesGroup.getByRole('button', { name: 'Pair Programming' })).toBeVisible();
  await expect(modesGroup.getByRole('button', { name: 'Explain Bug' })).toBeVisible();
  await expect(modesGroup.getByRole('button', { name: 'Logic Challenge' })).toBeVisible();

  const directBtn = modesGroup.getByRole('button', { name: 'Direto (Sem Filtro)' });
  await expect(directBtn).toBeVisible();
  await directBtn.click();
  await expect(directBtn).toHaveAttribute('aria-pressed', 'true');
});

test('toggles between expanded HUD and compact pill mode', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Switch to compact pill' }).click();
  await expect(page.getByRole('region', { name: 'BotPrograCraft Compact HUD' })).toBeVisible();

  await page.getByRole('button', { name: 'Expand HUD' }).click();
  await expect(page.getByLabel('Tutor Mode')).toBeVisible();
});

test('switches between Chat, Desafio, and Progresso tabs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('tabpanel', { name: 'Chat Transcript' })).toBeVisible();

  await page.getByRole('tab', { name: 'Desafio' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Desafio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gerar Desafio' })).toBeVisible();

  await page.getByRole('tab', { name: 'Progresso' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Progresso' })).toBeVisible();
  await expect(page.getByText('Progresso do Aluno')).toBeVisible();
});
