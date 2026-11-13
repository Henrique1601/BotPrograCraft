import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioCaptureOptions {
  sampleRate?: number;
  onAudioChunk?: (base64Pcm16: string, sampleRate: number) => void;
}

export interface UseAudioCaptureResult {
  isCapturing: boolean;
  micLevel: number;
  error: string | null;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  toggleCapture: () => Promise<void>;
}

function floatTo16BitPcmBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function useAudioCapture(
  options: UseAudioCaptureOptions = {},
): UseAudioCaptureResult {
  const targetSampleRate = options.sampleRate ?? 16000;
  const onAudioChunkRef = useRef(options.onAudioChunk);
  onAudioChunkRef.current = options.onAudioChunk;

  const [isCapturing, setIsCapturing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setIsCapturing(false);
    setMicLevel(0);
  }, []);

  const startCapture = useCallback(async () => {
    if (isCapturing) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: targetSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const audioCtx = new AudioContext({ sampleRate: targetSampleRate });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const channelData = event.inputBuffer.getChannelData(0);
        let sumSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i] ?? 0;
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / channelData.length);
        setMicLevel(Math.min(100, Math.round(rms * 280)));

        if (onAudioChunkRef.current) {
          const base64Pcm16 = floatTo16BitPcmBase64(channelData);
          onAudioChunkRef.current(base64Pcm16, audioCtx.sampleRate);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      streamRef.current = stream;
      audioCtxRef.current = audioCtx;
      sourceRef.current = source;
      processorRef.current = processor;
      setIsCapturing(true);
    } catch (err) {
      stopCapture();
      setError(err instanceof Error ? err.message : 'Microphone access failed');
    }
  }, [isCapturing, stopCapture, targetSampleRate]);

  const toggleCapture = useCallback(async () => {
    if (isCapturing) {
      stopCapture();
    } else {
      await startCapture();
    }
  }, [isCapturing, startCapture, stopCapture]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    isCapturing,
    micLevel,
    error,
    startCapture,
    stopCapture,
    toggleCapture,
  };
}
