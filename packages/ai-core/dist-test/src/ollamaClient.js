"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = exports.DEFAULT_OLLAMA_MODEL = exports.DEFAULT_OLLAMA_BASE_URL = void 0;
exports.DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
exports.DEFAULT_OLLAMA_MODEL = 'llama3.2';
function stripDataUriPrefix(base64) {
    const idx = base64.indexOf(',');
    if (base64.startsWith('data:') && idx !== -1) {
        return base64.slice(idx + 1);
    }
    return base64;
}
function resolveFetch(custom) {
    if (custom)
        return custom;
    const globalFetch = globalThis.fetch;
    if (!globalFetch) {
        throw new Error('Global fetch is not available in this runtime.');
    }
    return globalFetch;
}
/**
 * Lightweight HTTP client for a local Ollama instance (`http://127.0.0.1:11434`).
 */
class OllamaClient {
    baseUrl;
    defaultModel;
    fetchFn;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? exports.DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
        this.defaultModel = options.defaultModel ?? exports.DEFAULT_OLLAMA_MODEL;
        this.fetchFn = resolveFetch(options.fetchFn);
    }
    async checkHealth(timeoutMs = 3000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await this.fetchFn(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal,
            });
            if (!res.ok) {
                return {
                    available: false,
                    models: [],
                    error: `Ollama HTTP ${res.status} ${res.statusText}`.trim(),
                };
            }
            const payload = (await res.json());
            const models = Array.isArray(payload.models)
                ? payload.models
                    .map((m) => m.name ?? m.model ?? '')
                    .filter((name) => name.length > 0)
                : [];
            return {
                available: true,
                models,
            };
        }
        catch (err) {
            return {
                available: false,
                models: [],
                error: err instanceof Error ? err.message : String(err),
            };
        }
        finally {
            clearTimeout(timer);
        }
    }
    async chat(request) {
        const model = request.model?.trim() || this.defaultModel;
        const messages = [];
        if (request.systemPrompt?.trim()) {
            messages.push({
                role: 'system',
                content: request.systemPrompt.trim(),
            });
        }
        messages.push({
            role: 'user',
            content: request.prompt,
            ...(request.imageBase64?.trim()
                ? { images: [stripDataUriPrefix(request.imageBase64.trim())] }
                : {}),
        });
        const controller = new AbortController();
        const timer = request.timeoutMs && request.timeoutMs > 0
            ? setTimeout(() => controller.abort(), request.timeoutMs)
            : null;
        try {
            const res = await this.fetchFn(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                }),
                signal: controller.signal,
            });
            const payload = (await res.json().catch(() => ({})));
            if (!res.ok) {
                throw new Error(payload.error || `Ollama chat failed with HTTP ${res.status} ${res.statusText}`.trim());
            }
            const content = payload.message?.content;
            if (typeof content !== 'string') {
                throw new Error('Ollama response did not include message.content');
            }
            return content;
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
}
exports.OllamaClient = OllamaClient;
//# sourceMappingURL=ollamaClient.js.map