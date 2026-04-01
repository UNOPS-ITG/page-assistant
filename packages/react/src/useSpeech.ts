import { useState, useEffect, useCallback, useRef } from 'react';
import type { VoicePreference, SpeechStatus, SpeechProgress } from '@unopsitg/page-assistant-core';
import { chunkText, voiceScore, resolveVoice } from '@unopsitg/page-assistant-core';

export interface UseSpeechReturn {
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  status: SpeechStatus;
  progress: SpeechProgress;
  speak: (text: string, voice?: string | VoicePreference) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  findVoiceByName: (name: string) => SpeechSynthesisVoice | undefined;
}

export function useSpeech(): UseSpeechReturn {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [progress, setProgress] = useState<SpeechProgress>({ chunk: 0, total: 0 });
  const queueRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakResolveRef = useRef<(() => void) | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const load = () => {
      const raw = speechSynthesis.getVoices();
      if (raw.length === 0) return;
      const sorted = [...raw].sort((a, b) => voiceScore(b) - voiceScore(a));
      setVoices(sorted);
      if (!selectedVoiceRef.current) {
        selectedVoiceRef.current = sorted[0];
        setSelectedVoice(sorted[0]);
      }
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', load);
    };
  }, []);

  const clearKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  };

  const speakChunk = useCallback((index: number) => {
    if (index >= queueRef.current.length) {
      setStatus('idle');
      setProgress({ chunk: 0, total: 0 });
      clearKeepAlive();
      speakResolveRef.current?.();
      speakResolveRef.current = null;
      return;
    }

    currentIndexRef.current = index;
    setProgress({ chunk: index + 1, total: queueRef.current.length });
    const voice = selectedVoiceRef.current;

    const utterance = new SpeechSynthesisUtterance(queueRef.current[index]);
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => speakChunk(index + 1);
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') speakChunk(index + 1);
      else {
        setStatus('idle');
        setProgress({ chunk: 0, total: 0 });
        clearKeepAlive();
        speakResolveRef.current?.();
        speakResolveRef.current = null;
      }
    };

    speechSynthesis.speak(utterance);

    clearKeepAlive();
    keepAliveRef.current = setInterval(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 10_000);
  }, []);

  const speak = useCallback((text: string, voice?: string | VoicePreference): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      speechSynthesis.cancel();
      clearKeepAlive();
      speakResolveRef.current?.();

      if (voice) {
        const found = resolveVoice(voice, voices);
        if (found) selectedVoiceRef.current = found;
      }

      const chunks = chunkText(text);
      queueRef.current = chunks;
      currentIndexRef.current = 0;
      speakResolveRef.current = resolve;
      setStatus('speaking');
      speakChunk(0);
    });
  }, [speakChunk, voices]);

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    speechSynthesis.resume();
    setStatus('speaking');
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    clearKeepAlive();
    queueRef.current = [];
    currentIndexRef.current = 0;
    setStatus('idle');
    setProgress({ chunk: 0, total: 0 });
    speakResolveRef.current?.();
    speakResolveRef.current = null;
  }, []);

  const findVoiceByName = useCallback(
    (name: string) => voices.find((v) => v.name === name),
    [voices],
  );

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    status,
    progress,
    speak,
    pause,
    resume,
    stop,
    findVoiceByName,
  };
}
