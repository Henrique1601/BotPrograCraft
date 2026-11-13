import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, getSupportedTutorModes } from '../src/prompts';

describe('buildSystemPrompt', () => {
  it('supports all five tutor modes including direct', () => {
    const modes = getSupportedTutorModes();
    assert.deepEqual(modes, [
      'socratic',
      'pair-programming',
      'explain-bug',
      'logic-challenge',
      'direct',
    ]);

    for (const mode of modes) {
      const prompt = buildSystemPrompt({ mode });
      assert.ok(prompt.length > 50, `Expected non-empty prompt for mode ${mode}`);
      assert.match(prompt, /Portuguese/i);
      assert.match(prompt, /English/i);
    }
  });

  it('emphasizes not spoiling answers immediately in socratic and logic-challenge modes', () => {
    const socratic = buildSystemPrompt({ mode: 'socratic' });
    assert.match(socratic, /NEVER spoil/i);

    const logic = buildSystemPrompt({ mode: 'logic-challenge' });
    assert.match(logic, /NEVER spoil/i);
    assert.match(logic, /progressive hints/i);
  });

  it('provides direct unfiltered instructions for direct mode and unfiltered flag', () => {
    const direct = buildSystemPrompt({ mode: 'direct' });
    assert.match(direct, /Direct \(Unfiltered \/ Sem Filtro\)/);
    assert.match(direct, /complete working code immediately/i);
    assert.match(direct, /Do not withhold solutions/i);

    const pairUnfiltered = buildSystemPrompt({ mode: 'pair-programming', unfiltered: true });
    assert.match(pairUnfiltered, /Unfiltered \/ Direct Delivery/);
  });

  it('includes preferred language, student goal, and extra instructions when provided', () => {
    const prompt = buildSystemPrompt({
      mode: 'explain-bug',
      preferredLanguage: 'pt-BR',
      studentGoal: 'Entender por que o loop entra em recursão infinita',
      extraInstructions: 'Keep responses under 3 sentences.',
    });

    assert.match(prompt, /Brazilian Portuguese \(pt-BR\)/);
    assert.match(prompt, /recursão infinita/);
    assert.match(prompt, /Keep responses under 3 sentences\./);
  });

  it('throws on unsupported tutor mode', () => {
    assert.throws(
      () => buildSystemPrompt({ mode: 'invalid-mode' as never }),
      /Unsupported tutor mode/,
    );
  });
});
