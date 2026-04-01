import type { VoicePreference } from './types';

export function chunkText(text: string, maxLen = 200): string[] {
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

export function voiceScore(voice: SpeechSynthesisVoice): number {
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

export function inferGender(voice: SpeechSynthesisVoice): 'male' | 'female' | null {
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
