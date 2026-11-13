import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export interface UseWebSpeechResult {
  isSpeaking: boolean;
  isListening: boolean;
  isTtsSupported: boolean;
  isSttSupported: boolean;
  speak: (text: string, lang?: string) => void;
  stopSpeaking: () => void;
  startListening: (
    onResult: (transcript: string, isFinal: boolean) => void,
    lang?: string,
  ) => boolean;
  stopListening: () => void;
}

export function useWebSpeech(): UseWebSpeechResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isTtsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isSttSupported =
    typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null;

  const stopSpeaking = useCallback(() => {
    if (!isTtsSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isTtsSupported]);

  const speak = useCallback(
    (text: string, lang = 'pt-BR') => {
      const trimmed = text.trim();
      if (!isTtsSupported || !trimmed) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.lang = lang;

      const voices = window.speechSynthesis.getVoices();
      const matchingVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
        voices.find((v) =>
          v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()),
        );
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isTtsSupported],
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped.
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (
      onResult: (transcript: string, isFinal: boolean) => void,
      lang = 'pt-BR',
    ): boolean => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return false;

      stopListening();
      stopSpeaking();

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let combined = '';
        let hasFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          combined += result[0]?.transcript ?? '';
          if (result.isFinal) {
            hasFinal = true;
          }
        }
        if (combined.trim()) {
          onResult(combined.trim(), hasFinal);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
      return true;
    },
    [stopListening, stopSpeaking],
  );

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  return {
    isSpeaking,
    isListening,
    isTtsSupported,
    isSttSupported,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
  };
}
