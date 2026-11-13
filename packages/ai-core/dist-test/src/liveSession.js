"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiLiveSessionManager = exports.DEFAULT_OUTPUT_SAMPLE_RATE = exports.DEFAULT_GEMINI_LIVE_MODEL = void 0;
exports.parseAudioSampleRate = parseAudioSampleRate;
exports.buildPermissiveSafetySettings = buildPermissiveSafetySettings;
const genai_1 = require("@google/genai");
const contextAggregator_1 = require("./contextAggregator");
const prompts_1 = require("./prompts");
exports.DEFAULT_GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
exports.DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
const DEFAULT_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';
const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 1000;
/**
 * Extracts the PCM sample rate from a mimeType such as `audio/pcm;rate=24000`.
 */
function parseAudioSampleRate(mimeType, fallback = exports.DEFAULT_OUTPUT_SAMPLE_RATE) {
    const match = /rate=(\d+)/i.exec(mimeType);
    if (!match)
        return fallback;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
/**
 * Builds permissive SafetySetting entries supported by Gemini LiveConnectConfig.
 */
function buildPermissiveSafetySettings() {
    return [
        {
            category: genai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: genai_1.HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: genai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: genai_1.HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: genai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: genai_1.HarmBlockThreshold.BLOCK_NONE,
        },
        {
            category: genai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: genai_1.HarmBlockThreshold.BLOCK_NONE,
        },
    ];
}
/**
 * Manages a Gemini Live API multimodal session (audio chunks, JPEG/PNG screen frames,
 * text turns, IDE context injection, and reconnect/error states).
 */
class GeminiLiveSessionManager {
    config;
    contextAggregator;
    events;
    createClient;
    session = null;
    status = 'disconnected';
    manualDisconnect = false;
    reconnectTimer = null;
    reconnectAttempt = 0;
    constructor(options) {
        this.config = { ...options.config };
        this.contextAggregator = options.contextAggregator ?? new contextAggregator_1.ContextAggregator();
        this.events = options.events ?? {};
        this.createClient =
            options.createClient ?? ((apiKey) => new genai_1.GoogleGenAI({ apiKey }));
    }
    getStatus() {
        return this.status;
    }
    getConfig() {
        return this.config;
    }
    getContextAggregator() {
        return this.contextAggregator;
    }
    updateIdeContext(payload) {
        this.contextAggregator.updateIdeContext(payload);
    }
    updateTutorMode(mode, unfiltered) {
        this.config = {
            ...this.config,
            tutorMode: mode,
            ...(unfiltered !== undefined ? { unfiltered } : {}),
        };
        if (this.session && this.status === 'connected') {
            const systemInstruction = this.resolveSystemInstruction();
            this.session.sendContextUpdate({ systemInstruction });
        }
    }
    async connect() {
        if (this.status === 'connected' || this.status === 'connecting') {
            return;
        }
        if (!this.config.apiKey.trim()) {
            const err = new Error('Gemini API key is required to start a Live session.');
            this.setStatus('error', err.message);
            this.events.onError?.(err);
            throw err;
        }
        this.manualDisconnect = false;
        this.clearReconnectTimer();
        this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
        try {
            const client = this.createClient(this.config.apiKey);
            const systemInstruction = this.resolveSystemInstruction();
            const model = this.config.model ?? exports.DEFAULT_GEMINI_LIVE_MODEL;
            const isUnfiltered = Boolean(this.config.unfiltered || this.config.tutorMode === 'direct');
            this.session = await client.live.connect({
                model,
                config: {
                    responseModalities: [genai_1.Modality.AUDIO, genai_1.Modality.TEXT],
                    systemInstruction,
                    ...(isUnfiltered ? { safetySettings: buildPermissiveSafetySettings() } : {}),
                    ...(this.config.voiceName
                        ? {
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: this.config.voiceName },
                                },
                            },
                        }
                        : {}),
                },
                callbacks: {
                    onopen: () => {
                        this.reconnectAttempt = 0;
                        this.setStatus('connected');
                    },
                    onmessage: (message) => {
                        this.handleServerMessage(message);
                    },
                    onerror: (event) => {
                        const error = event.error instanceof Error
                            ? event.error
                            : new Error(event.message || 'Gemini Live WebSocket error');
                        this.events.onError?.(error);
                        if (!this.manualDisconnect) {
                            this.scheduleReconnect(error.message);
                        }
                    },
                    onclose: (event) => {
                        this.session = null;
                        if (this.manualDisconnect) {
                            this.setStatus('disconnected');
                            return;
                        }
                        const reason = event.reason || `Connection closed (code ${event.code})`;
                        this.scheduleReconnect(reason);
                    },
                },
            });
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.session = null;
            this.events.onError?.(error);
            this.scheduleReconnect(error.message);
            throw error;
        }
    }
    disconnect() {
        this.manualDisconnect = true;
        this.clearReconnectTimer();
        this.reconnectAttempt = 0;
        if (this.session) {
            try {
                this.session.close();
            }
            finally {
                this.session = null;
            }
        }
        this.setStatus('disconnected');
    }
    sendAudioChunk(dataBase64, mimeType = DEFAULT_AUDIO_MIME_TYPE) {
        const session = this.requireConnectedSession();
        session.sendRealtimeInput({
            audio: {
                data: dataBase64,
                mimeType,
            },
        });
    }
    endAudioStream() {
        const session = this.requireConnectedSession();
        session.sendRealtimeInput({ audioStreamEnd: true });
    }
    sendScreenFrame(frame) {
        this.contextAggregator.updateScreenFrame(frame);
        if (this.config.includeScreenFrames === false) {
            return;
        }
        const session = this.requireConnectedSession();
        session.sendRealtimeInput({
            video: {
                data: frame.dataBase64,
                mimeType: frame.mimeType,
            },
        });
    }
    sendTextTurn(text, includeContext = true) {
        const session = this.requireConnectedSession();
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }
        const fullText = includeContext
            ? `${this.contextAggregator.formatContext()}\n\n### Student Message\n${trimmed}`
            : trimmed;
        session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: fullText }] }],
            turnComplete: true,
        });
    }
    resolveSystemInstruction() {
        if (this.config.systemInstruction?.trim()) {
            return this.config.systemInstruction;
        }
        return (0, prompts_1.buildSystemPrompt)({
            mode: this.config.tutorMode,
            unfiltered: Boolean(this.config.unfiltered || this.config.tutorMode === 'direct'),
            preferredLanguage: this.config.language === 'pt-BR' || this.config.language === 'en'
                ? this.config.language
                : 'auto',
        });
    }
    requireConnectedSession() {
        if (!this.session || this.status !== 'connected') {
            throw new Error(`Cannot send input while session status is "${this.status}".`);
        }
        return this.session;
    }
    setStatus(status, detail) {
        if (this.status === status && !detail) {
            return;
        }
        this.status = status;
        this.events.onStatusChange?.(status, detail);
    }
    scheduleReconnect(reason) {
        const maxAttempts = this.config.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS;
        if (this.reconnectAttempt >= maxAttempts) {
            this.setStatus('error', reason);
            return;
        }
        this.reconnectAttempt += 1;
        const baseDelay = this.config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
        const delayMs = baseDelay * Math.pow(2, this.reconnectAttempt - 1);
        this.setStatus('reconnecting', `Attempt ${this.reconnectAttempt}/${maxAttempts} after: ${reason}`);
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            void this.connect().catch(() => {
                // Error and next reconnect step are handled inside connect().
            });
        }, delayMs);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    handleServerMessage(message) {
        const now = Date.now();
        const content = message.serverContent;
        if (!content) {
            return;
        }
        if (content.interrupted) {
            this.events.onInterrupted?.();
        }
        if (content.inputTranscription?.text) {
            this.events.onTranscript?.({
                role: 'user',
                text: content.inputTranscription.text,
                isFinal: Boolean(content.inputTranscription.finished),
                timestamp: now,
            });
        }
        if (content.outputTranscription?.text) {
            this.events.onTranscript?.({
                role: 'assistant',
                text: content.outputTranscription.text,
                isFinal: Boolean(content.outputTranscription.finished),
                timestamp: now,
            });
        }
        const parts = content.modelTurn?.parts ?? [];
        for (const part of parts) {
            if (part.text) {
                this.events.onTranscript?.({
                    role: 'assistant',
                    text: part.text,
                    isFinal: Boolean(content.turnComplete),
                    timestamp: now,
                });
            }
            if (part.inlineData?.data && part.inlineData.mimeType) {
                this.events.onAudioOutput?.({
                    dataBase64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                    sampleRate: parseAudioSampleRate(part.inlineData.mimeType),
                    timestamp: now,
                });
            }
        }
        if (content.turnComplete) {
            this.events.onTurnComplete?.();
        }
    }
}
exports.GeminiLiveSessionManager = GeminiLiveSessionManager;
//# sourceMappingURL=liveSession.js.map