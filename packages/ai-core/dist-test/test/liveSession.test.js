"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const genai_1 = require("@google/genai");
const liveSession_1 = require("../src/liveSession");
(0, node_test_1.describe)('liveSession helpers', () => {
    (0, node_test_1.it)('parses PCM sample rate from mimeType with 24kHz fallback', () => {
        strict_1.default.equal((0, liveSession_1.parseAudioSampleRate)('audio/pcm;rate=24000'), 24000);
        strict_1.default.equal((0, liveSession_1.parseAudioSampleRate)('audio/pcm;rate=16000'), 16000);
        strict_1.default.equal((0, liveSession_1.parseAudioSampleRate)('audio/pcm'), 24000);
    });
    (0, node_test_1.it)('builds permissive safetySettings using BLOCK_NONE', () => {
        const settings = (0, liveSession_1.buildPermissiveSafetySettings)();
        strict_1.default.equal(settings.length, 4);
        for (const s of settings) {
            strict_1.default.equal(s.threshold, genai_1.HarmBlockThreshold.BLOCK_NONE);
        }
    });
});
(0, node_test_1.describe)('GeminiLiveSessionManager', () => {
    (0, node_test_1.it)('configures safetySettings for direct mode and emits audio, interruption, and turnComplete events', async () => {
        let capturedParams = null;
        const audioChunks = [];
        let interruptedCount = 0;
        let turnCompleteCount = 0;
        const manager = new liveSession_1.GeminiLiveSessionManager({
            config: {
                apiKey: 'test-key',
                tutorMode: 'direct',
            },
            events: {
                onAudioOutput: (evt) => audioChunks.push(evt),
                onInterrupted: () => {
                    interruptedCount += 1;
                },
                onTurnComplete: () => {
                    turnCompleteCount += 1;
                },
            },
            createClient: () => ({
                live: {
                    connect: async (params) => {
                        capturedParams = params;
                        params.callbacks.onopen?.();
                        return {
                            close: () => {
                                params.callbacks.onclose?.({ code: 1000, reason: 'closed' });
                            },
                            sendRealtimeInput: () => { },
                            sendClientContent: () => { },
                            sendToolResponse: () => { },
                            sendContextUpdate: () => { },
                        };
                    },
                },
            }),
        });
        await manager.connect();
        strict_1.default.equal(manager.getStatus(), 'connected');
        strict_1.default.ok(capturedParams);
        const params = capturedParams;
        strict_1.default.ok(params.config?.safetySettings && params.config.safetySettings.length === 4);
        params.callbacks.onmessage?.({
            serverContent: {
                modelTurn: {
                    parts: [
                        {
                            inlineData: {
                                data: 'AQID',
                                mimeType: 'audio/pcm;rate=24000',
                            },
                        },
                    ],
                },
            },
        });
        params.callbacks.onmessage?.({
            serverContent: {
                interrupted: true,
                turnComplete: true,
            },
        });
        strict_1.default.equal(audioChunks.length, 1);
        strict_1.default.equal(audioChunks[0].dataBase64, 'AQID');
        strict_1.default.equal(audioChunks[0].mimeType, 'audio/pcm;rate=24000');
        strict_1.default.equal(audioChunks[0].sampleRate, 24000);
        strict_1.default.equal(interruptedCount, 1);
        strict_1.default.equal(turnCompleteCount, 1);
        manager.disconnect();
        strict_1.default.equal(manager.getStatus(), 'disconnected');
    });
});
//# sourceMappingURL=liveSession.test.js.map