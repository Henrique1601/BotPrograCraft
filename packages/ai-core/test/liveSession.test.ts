import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HarmBlockThreshold, type LiveConnectParameters, type LiveServerMessage } from '@google/genai';
import {
  GeminiLiveSessionManager,
  buildPermissiveSafetySettings,
  parseAudioSampleRate,
  type AudioOutputEvent,
} from '../src/liveSession';

describe('liveSession helpers', () => {
  it('parses PCM sample rate from mimeType with 24kHz fallback', () => {
    assert.equal(parseAudioSampleRate('audio/pcm;rate=24000'), 24000);
    assert.equal(parseAudioSampleRate('audio/pcm;rate=16000'), 16000);
    assert.equal(parseAudioSampleRate('audio/pcm'), 24000);
  });

  it('builds permissive safetySettings using BLOCK_NONE', () => {
    const settings = buildPermissiveSafetySettings();
    assert.equal(settings.length, 4);
    for (const s of settings) {
      assert.equal(s.threshold, HarmBlockThreshold.BLOCK_NONE);
    }
  });
});

describe('GeminiLiveSessionManager', () => {
  it('configures safetySettings for direct mode and emits audio, interruption, and turnComplete events', async () => {
    let capturedParams: LiveConnectParameters | null = null;
    const audioChunks: AudioOutputEvent[] = [];
    let interruptedCount = 0;
    let turnCompleteCount = 0;

    const manager = new GeminiLiveSessionManager({
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
          connect: async (params: LiveConnectParameters) => {
            capturedParams = params;
            params.callbacks.onopen?.();
            return {
              close: () => {
                params.callbacks.onclose?.({ code: 1000, reason: 'closed' } as never);
              },
              sendRealtimeInput: () => {},
              sendClientContent: () => {},
              sendToolResponse: () => {},
              sendContextUpdate: () => {},
            } as never;
          },
        } as never,
      }),
    });

    await manager.connect();
    assert.equal(manager.getStatus(), 'connected');
    assert.ok(capturedParams);
    const params = capturedParams as LiveConnectParameters;
    assert.ok(params.config?.safetySettings && params.config.safetySettings.length === 4);

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
    } as LiveServerMessage);

    params.callbacks.onmessage?.({
      serverContent: {
        interrupted: true,
        turnComplete: true,
      },
    } as LiveServerMessage);

    assert.equal(audioChunks.length, 1);
    assert.equal(audioChunks[0].dataBase64, 'AQID');
    assert.equal(audioChunks[0].mimeType, 'audio/pcm;rate=24000');
    assert.equal(audioChunks[0].sampleRate, 24000);
    assert.equal(interruptedCount, 1);
    assert.equal(turnCompleteCount, 1);

    manager.disconnect();
    assert.equal(manager.getStatus(), 'disconnected');
  });
});
