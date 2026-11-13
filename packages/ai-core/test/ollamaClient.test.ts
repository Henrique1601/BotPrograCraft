import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OllamaClient } from '../src/ollamaClient';

describe('OllamaClient', () => {
  it('checkHealth returns available models when /api/tags succeeds', async () => {
    const client = new OllamaClient({
      baseUrl: 'http://127.0.0.1:11434/',
      fetchFn: async (url, init) => {
        assert.equal(url, 'http://127.0.0.1:11434/api/tags');
        assert.equal(init?.method, 'GET');
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
    assert.deepEqual(health, {
      available: true,
      models: ['llama3.2:latest', 'qwen2.5-coder:7b'],
    });
  });

  it('checkHealth returns available: false on network or HTTP errors', async () => {
    const client = new OllamaClient({
      fetchFn: async () => {
        throw new Error('ECONNREFUSED');
      },
    });

    const health = await client.checkHealth();
    assert.equal(health.available, false);
    assert.deepEqual(health.models, []);
    assert.match(health.error ?? '', /ECONNREFUSED/);
  });

  it('chat sends systemPrompt, prompt, and stripped base64 image to /api/chat', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const client = new OllamaClient({
      defaultModel: 'llava',
      fetchFn: async (url, init) => {
        assert.equal(url, 'http://127.0.0.1:11434/api/chat');
        assert.equal(init?.method, 'POST');
        capturedBody = JSON.parse(init?.body ?? '{}') as Record<string, unknown>;
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

    assert.equal(reply, 'Olhando sua tela, falta um return.');
    assert.ok(capturedBody);
    assert.equal((capturedBody as Record<string, unknown>).model, 'llava');
    assert.equal((capturedBody as Record<string, unknown>).stream, false);
    const messages = (capturedBody as { messages: Array<{ role: string; content: string; images?: string[] }> }).messages;
    assert.equal(messages.length, 2);
    assert.deepEqual(messages[0], { role: 'system', content: 'Seja direto.' });
    assert.deepEqual(messages[1], {
      role: 'user',
      content: 'O que há de errado?',
      images: ['AAAA'],
    });
  });
});
