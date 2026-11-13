import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioPlaybackResult {
  isMuted: boolean;
  isPlaying: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  enqueueAudio: (base64Pcm16: string, mimeType?: string) => void;
  stop: () => void;
}

function parseSampleRate(mimeType?: string): number {
  if (!mimeType) return 24000;
  const match = /rate=(\d+)/i.exec(mimeType);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 24000;
}

function decodePcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(byteLength / 2);
  const floats = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    floats[i] = view.getInt16(i * 2, true) / 32768;
  }
  return floats;
}

export function useAudioPlayback(): UseAudioPlaybackResult {
  const [isMuted, setIsMutedState] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const isMutedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stop = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Ignore sources that already finished.
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  const setMuted = useCallback(
    (muted: boolean) => {
      isMutedRef.current = muted;
      setIsMutedState(muted);
      if (muted) {
        stop();
      }
    },
    [stop],
  );

  const toggleMute = useCallback(() => {
    setMuted(!isMutedRef.current);
  }, [setMuted]);

  const enqueueAudio = useCallback(
    (base64Pcm16: string, mimeType?: string) => {
      if (isMutedRef.current || !base64Pcm16) {
        return;
      }

      const sampleRate = parseSampleRate(mimeType);
      const floatSamples = decodePcm16Base64ToFloat32(base64Pcm16);
      if (floatSamples.length === 0) {
        return;
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext({ sampleRate });
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const buffer = ctx.createBuffer(1, floatSamples.length, sampleRate);
      buffer.getChannelData(0).set(floatSamples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now + 0.015, nextStartTimeRef.current);
      nextStartTimeRef.current = startTime + buffer.duration;

      activeSourcesRef.current.add(source);
      setIsPlaying(true);

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        source.disconnect();
        if (activeSourcesRef.current.size === 0) {
          nextStartTimeRef.current = 0;
          setIsPlaying(false);
        }
      };

      source.start(startTime);
    },
    [],
  );

  useEffect(() => {
    return () => {
      stop();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stop]);

  return {
    isMuted,
    isPlaying,
    setMuted,
    toggleMute,
    enqueueAudio,
    stop,
  };
}
