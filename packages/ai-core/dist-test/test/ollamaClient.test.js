"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const ollamaClient_1 = require("../src/ollamaClient");
(0, node_test_1.describe)('OllamaClient', () => {
    (0, node_test_1.it)('checkHealth returns available models when /api/tags succeeds', async () => {
        const client = new ollamaClient_1.OllamaClient({
            baseUrl: 'http://127.0.0.1:11434/',
            fetchFn: async (url, init) => {
                strict_1.default.equal(url, 'http://127.0.0.1:11434/api/tags');
                strict_1.default.equal(init?.method, 'GET');
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: async () => ({
                        models: [{ name: 'llama3.2:latest' }, { model: 'qwen2.5-coder:7b' }],
                    }),
                };
            },
        });
        const health = await client.checkHealth();
        strict_1.default.deepEqual(health, {
            available: true,
            models: ['llama3.2:latest', 'qwen2.5-coder:7b'],
        });
    });
    (0, node_test_1.it)('checkHealth returns available: false on network or HTTP errors', async () => {
        const client = new ollamaClient_1.OllamaClient({
            fetchFn: async () => {
                throw new Error('ECONNREFUSED');
            },
        });
        const health = await client.checkHealth();
        strict_1.default.equal(health.available, false);
        strict_1.default.deepEqual(health.models, []);
        strict_1.default.match(health.error ?? '', /ECONNREFUSED/);
    });
    (0, node_test_1.it)('chat sends systemPrompt, prompt, and stripped base64 image to /api/chat', async () => {
        let capturedBody = null;
        const client = new ollamaClient_1.OllamaClient({
            defaultModel: 'llava',
            fetchFn: async (url, init) => {
                strict_1.default.equal(url, 'http://127.0.0.1:11434/api/chat');
                strict_1.default.equal(init?.method, 'POST');
                capturedBody = JSON.parse(init?.body ?? '{}');
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    json: async () => ({
                        message: { content: 'Olhando sua tela, falta um return.' },
                    }),
                };
            },
        });
        const reply = await client.chat({
            systemPrompt: 'Seja direto.',
            prompt: 'O que há de errado?',
            imageBase64: 'data:image/jpeg;base64,AAAA',
        });
        strict_1.default.equal(reply, 'Olhando sua tela, falta um return.');
        strict_1.default.ok(capturedBody);
        strict_1.default.equal(capturedBody.model, 'llava');
        strict_1.default.equal(capturedBody.stream, false);
        const messages = capturedBody.messages;
        strict_1.default.equal(messages.length, 2);
        strict_1.default.deepEqual(messages[0], { role: 'system', content: 'Seja direto.' });
        strict_1.default.deepEqual(messages[1], {
            role: 'user',
            content: 'O que há de errado?',
            images: ['AAAA'],
        });
    });
});
//# sourceMappingURL=ollamaClient.test.js.map