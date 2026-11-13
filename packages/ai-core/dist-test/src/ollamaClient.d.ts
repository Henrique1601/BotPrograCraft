export declare const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export declare const DEFAULT_OLLAMA_MODEL = "llama3.2";
export interface OllamaFetchResponse {
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<unknown>;
}
export type OllamaFetchFn = (url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
}) => Promise<OllamaFetchResponse>;
export interface OllamaClientOptions {
    baseUrl?: string;
    defaultModel?: string;
    fetchFn?: OllamaFetchFn;
}
export interface OllamaChatRequest {
    model?: string;
    systemPrompt?: string;
    prompt: string;
    imageBase64?: string;
    timeoutMs?: number;
}
export interface OllamaHealthResult {
    available: boolean;
    models: string[];
    error?: string;
}
/**
 * Lightweight HTTP client for a local Ollama instance (`http://127.0.0.1:11434`).
 */
export declare class OllamaClient {
    private readonly baseUrl;
    private readonly defaultModel;
    private readonly fetchFn;
    constructor(options?: OllamaClientOptions);
    checkHealth(timeoutMs?: number): Promise<OllamaHealthResult>;
    chat(request: OllamaChatRequest): Promise<string>;
}
//# sourceMappingURL=ollamaClient.d.ts.map