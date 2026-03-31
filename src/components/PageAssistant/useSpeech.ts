import { useState, useEffect, useCallback, useRef } from 'react';
import type { VoicePreference } from './types';

function chunkText(text: string, maxLen = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (/premium|enhanced|neural|natural/i.test(name)) return 100;
  if (/online/i.test(name)) return 80;
  if (/google/i.test(name)) return 60;
  if (/samantha|karen|daniel|moira|tessa|alex/i.test(name)) return 70;
  if (voice.localService === false) return 50;
  return 20;
}

export function voiceTag(voice: SpeechSynthesisVoice): string {
  const name = voice.name.toLowerCase();
  if (/premium|enhanced|neural|natural/i.test(name)) return 'Neural';
  if (/online/i.test(name)) return 'Online';
  if (voice.localService === false) return 'Network';
  return 'Standard';
}

function inferGender(voice: SpeechSynthesisVoice): 'male' | 'female' | null {
  const n = voice.name.toLowerCase();
  const femaleNames = /\b(samantha|karen|moira|tessa|victoria|fiona|kate|zira|susan|hazel|jenny|aria|sara)\b/;
  const maleNames = /\b(daniel|alex|thomas|david|mark|james|fred|rishi|george|guy|ryan)\b/;
  if (femaleNames.test(n) || /\bfemale\b/.test(n)) return 'female';
  if (maleNames.test(n) || /\bmale\b/.test(n)) return 'male';
  return null;
}

function meetsQuality(voice: SpeechSynthesisVoice, quality: VoicePreference['quality']): boolean {
  if (!quality || quality === 'any') return true;
  const tag = voiceTag(voice);
  if (quality === 'neural') return tag === 'Neural';
  if (quality === 'online') return tag === 'Neural' || tag === 'Online' || tag === 'Network';
  return true;
}

export function resolveVoice(
  pref: string | VoicePreference | undefined,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!pref || voices.length === 0) return undefined;

  if (typeof pref === 'string') {
    return voices.find((v) => v.name === pref);
  }

  if (pref.name) {
    const exact = voices.find((v) => v.name === pref.name);
    if (exact) return exact;
  }

  const langMatch = (v: SpeechSynthesisVoice) => {
    if (!pref.lang) return true;
    const prefLang = pref.lang.toLowerCase();
    const vLang = v.lang.toLowerCase();
    return vLang === prefLang
      || vLang.startsWith(prefLang + '-')
      || prefLang.startsWith(vLang + '-')
      || vLang.split('-')[0] === prefLang.split('-')[0];
  };

  const genderMatch = (v: SpeechSynthesisVoice) => {
    if (!pref.gender) return true;
    const g = inferGender(v);
    return !g || g === pref.gender;
  };

  const rank = (list: SpeechSynthesisVoice[]) =>
    list.sort((a, b) => {
      let sa = voiceScore(a);
      let sb = voiceScore(b);
      if (pref.lang) {
        const pl = pref.lang.toLowerCase();
        if (a.lang.toLowerCase() === pl) sa += 10;
        if (b.lang.toLowerCase() === pl) sb += 10;
      }
      return sb - sa;
    })[0];

  const strict = voices.filter((v) => langMatch(v) && genderMatch(v) && meetsQuality(v, pref.quality));
  if (strict.length > 0) return rank(strict);

  const noQuality = voices.filter((v) => langMatch(v) && genderMatch(v));
  if (noQuality.length > 0) return rank(noQuality);

  const langOnly = voices.filter(langMatch);
  if (langOnly.length > 0) return rank(langOnly);

  return rank([...voices]);
}

export type SpeechStatus = 'idle' | 'speaking' | 'paused';

export interface SpeechProgress {
  chunk: number;
  total: number;
}

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
