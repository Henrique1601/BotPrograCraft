"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const prompts_1 = require("../src/prompts");
(0, node_test_1.describe)('buildSystemPrompt', () => {
    (0, node_test_1.it)('supports all five tutor modes including direct', () => {
        const modes = (0, prompts_1.getSupportedTutorModes)();
        strict_1.default.deepEqual(modes, [
            'socratic',
            'pair-programming',
            'explain-bug',
            'logic-challenge',
            'direct',
        ]);
        for (const mode of modes) {
            const prompt = (0, prompts_1.buildSystemPrompt)({ mode });
            strict_1.default.ok(prompt.length > 50, `Expected non-empty prompt for mode ${mode}`);
            strict_1.default.match(prompt, /Portuguese/i);
            strict_1.default.match(prompt, /English/i);
        }
    });
    (0, node_test_1.it)('emphasizes not spoiling answers immediately in socratic and logic-challenge modes', () => {
        const socratic = (0, prompts_1.buildSystemPrompt)({ mode: 'socratic' });
        strict_1.default.match(socratic, /NEVER spoil/i);
        const logic = (0, prompts_1.buildSystemPrompt)({ mode: 'logic-challenge' });
        strict_1.default.match(logic, /NEVER spoil/i);
        strict_1.default.match(logic, /progressive hints/i);
    });
    (0, node_test_1.it)('provides direct unfiltered instructions for direct mode and unfiltered flag', () => {
        const direct = (0, prompts_1.buildSystemPrompt)({ mode: 'direct' });
        strict_1.default.match(direct, /Direct \(Unfiltered \/ Sem Filtro\)/);
        strict_1.default.match(direct, /complete working code immediately/i);
        strict_1.default.match(direct, /Do not withhold solutions/i);
        const pairUnfiltered = (0, prompts_1.buildSystemPrompt)({ mode: 'pair-programming', unfiltered: true });
        strict_1.default.match(pairUnfiltered, /Unfiltered \/ Direct Delivery/);
    });
    (0, node_test_1.it)('includes preferred language, student goal, and extra instructions when provided', () => {
        const prompt = (0, prompts_1.buildSystemPrompt)({
            mode: 'explain-bug',
            preferredLanguage: 'pt-BR',
            studentGoal: 'Entender por que o loop entra em recursão infinita',
            extraInstructions: 'Keep responses under 3 sentences.',
        });
        strict_1.default.match(prompt, /Brazilian Portuguese \(pt-BR\)/);
        strict_1.default.match(prompt, /recursão infinita/);
        strict_1.default.match(prompt, /Keep responses under 3 sentences\./);
    });
    (0, node_test_1.it)('throws on unsupported tutor mode', () => {
        strict_1.default.throws(() => (0, prompts_1.buildSystemPrompt)({ mode: 'invalid-mode' }), /Unsupported tutor mode/);
    });
});
//# sourceMappingURL=prompts.test.js.map