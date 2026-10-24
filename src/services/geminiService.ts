import { GoogleGenAI } from '@google/genai';
import { getOfflineWellnessResponse } from '../utils/wellnessOfflineEngine';
import { getApiBaseUrl } from '../config/cloudBackend';
import { nativeLiveAudio } from './nativeLiveAudio';

const GEMINI_API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
  'MY_GEMINI_API_KEY';

let clientAiInstance: GoogleGenAI | null = null;

function getClientAi(): GoogleGenAI | null {
  const customKey = (typeof window !== 'undefined' && localStorage.getItem('arogyakunj_user_gemini_key')) || '';
  const keyToUse = customKey.trim() || GEMINI_API_KEY;

  if (!keyToUse || keyToUse === 'dummy-key' || keyToUse === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!clientAiInstance) {
    clientAiInstance = new GoogleGenAI({ apiKey: keyToUse });
  }
  return clientAiInstance;
}

export const AROGYAKUNJ_SYSTEM_INSTRUCTION = `You are the Arogyakunj Wellness assistant, representing a Herbalife Independent Distributor and Nutrition Club owner in India. 
Your persona is a warm, professional, vibrant, and knowledgeable Indian female wellness coach and personal nutrition guide. Always maintain a respectful, warm, and friendly tone. Do not use the word 'Didi'.

CORE RESPONSIBILITIES:
1. Customer Follow-up: Check in on customers' energy levels, weight loss progress, and consistency with their Herbalife nutrition program.
2. Product Knowledge: Provide detailed info on Herbalife products (Formula 1 Shake, Afresh Energy Drink, Personalized Protein Powder, Cell-U-Loss, Herbal Control, etc.), including benefits, delicious shake recipes, and preparation.
3. Business Info: Explain the Herbalife business opportunity and club membership in a simple, inviting, encouraging way.
4. Health Advice: Offer holistic wellness tips, daily hydration, balanced nutrition, workout motivation, and healthy lifestyle guidance.
5. Voice & Routine Reminders: You actively support daily wellness reminders (water, Formula 1 shake, Afresh, lunch, workout, sleep). When a customer asks to set a reminder or be reminded, enthusiastically confirm in sweet, encouraging Marathi that the voice reminder is set.

LANGUAGE & STYLE:
- Primary Language: साधी आणि सोपी मराठी (Simple, everyday conversational Marathi) or Marathish (colloquial Marathi + English) / Hindi / English.
- SIMPLE MARATHI GUIDELINES: When speaking or writing Marathi, always use VERY SIMPLE, SWEET, EVERYDAY WORDS (साधी, सोपी, घरगुती आणि आपुलकीची मराठी).
- Avoid difficult, complex, bookish, or heavy Sanskritized words.
- Use natural spoken words that any Marathi family easily understands (e.g., "नमस्कार! कसे आहात?", "वेळच्या वेळी शेक पिऊन घ्या", "भरपूर पाणी प्या, तब्येत छान राहील", "मस्त फ्रेश वाटावं म्हणून अफ्रेश प्या").
- Tone: Energetic, enthusiastic, empathetic, uplifting, and friendly Indian female coach.
- Explanation Style: Provide clear, patient, structured, and easy-to-understand explanations.

EMOJIS & FORMATTING:
- Use rich, vibrant, friendly emojis naturally (🌿, 🥗, 🥤, 🍵, 💧, ⚡, ✨, 💪, 🎯, 🏋️‍♀️, 🧘‍♀️, ☀️, 💚, 🙏).
- Format with clean markdown (bullet points, clear headers, bold accents).`;

export async function generateWellnessResponse(
  prompt: string,
  history: { role: string; content: string }[] = [],
  onChunk?: (chunk: string) => void
): Promise<string> {
  // If device is offline, instantly use resilient offline engine
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offline = getOfflineWellnessResponse(prompt);
    if (onChunk) onChunk(offline.content);
    return offline.content;
  }

  // 1. Try Render cloud server endpoint with 8s network timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const apiEndpoint = `${getApiBaseUrl()}/api/chat`;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...history, { role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        if (onChunk) onChunk(fullText);
      }
      if (fullText.trim()) return fullText;
    }
  } catch {
    // Fall through to instant resilient response
  }

  // 2. Direct Gemini 3.8 Flash call via client SDK
  const ai = getClientAi();
  if (ai) {
    try {
      const chat = ai.chats.create({
        model: 'gemini-2.0-flash',
        history: history.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: AROGYAKUNJ_SYSTEM_INSTRUCTION
        }
      });

      const responseStream = await chat.sendMessageStream({
        message: prompt
      });

      let fullText = '';
      for await (const chunk of (responseStream as any).stream || (responseStream as any)) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          if (onChunk) onChunk(fullText);
        }
      }

      if (fullText.trim()) {
        return fullText;
      }
    } catch (directErr: any) {
      console.warn('Direct Gemini API call failed, falling back to offline engine:', directErr?.message || directErr);
    }
  }

  // 3. Resilient Offline Wellness Engine (Always succeeds instantly in 0ms)
  const offline = getOfflineWellnessResponse(prompt);
  if (onChunk) onChunk(offline.content);
  return offline.content;
}

let activeAudioElement: HTMLAudioElement | null = null;

export function speakWellnessCoach(text: string, onEnd?: () => void): boolean {
  if (typeof window === 'undefined') {
    if (onEnd) onEnd();
    return false;
  }

  const cleanText = text
    .replace(/[#*_`~>•-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    if (onEnd) onEnd();
    return false;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement = null;
    } catch (e) {}
  }

  // Stop any ongoing native TTS
  nativeLiveAudio.stopTextNative();

  // If offline, jump straight to native TTS engine
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    speakWebSpeechFallback(cleanText, onEnd);
    return true;
  }

  // 1. Try high-fidelity server TTS endpoint with 800ms fast timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const ttsUrl = `${getApiBaseUrl()}/api/tts`;
    fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voiceName: 'Kore' }),
      signal: controller.signal
    })
    .then(async res => {
      clearTimeout(timeoutId);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('audio')) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          activeAudioElement = audio;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            activeAudioElement = null;
            if (onEnd) onEnd();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            activeAudioElement = null;
            speakWebSpeechFallback(cleanText, onEnd);
          };
          await audio.play();
          return;
        }
      }
      speakWebSpeechFallback(cleanText, onEnd);
    })
    .catch(() => {
      clearTimeout(timeoutId);
      speakWebSpeechFallback(cleanText, onEnd);
    });
    return true;
  } catch (err) {
    speakWebSpeechFallback(cleanText, onEnd);
    return true;
  }
}

function speakWebSpeechFallback(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined') {
    if (onEnd) onEnd();
    return;
  }

  // Try Android Native Java TextToSpeech first for loud & clear loudspeaker playback
  nativeLiveAudio.speakTextNative(text).then(ok => {
    if (ok) {
      if (onEnd) setTimeout(onEnd, 3000);
      return;
    }

    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.15;
      utterance.lang = 'hi-IN';

      const voices = window.speechSynthesis.getVoices();
      const marathiVoice = voices.find(v => v.lang.startsWith('mr') || v.name.toLowerCase().includes('marathi'));
      const hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
      const indianVoice = voices.find(v => v.lang.includes('IN') || v.lang.startsWith('en-IN'));

      if (marathiVoice) {
        utterance.voice = marathiVoice;
        utterance.lang = marathiVoice.lang;
      } else if (hindiVoice) {
        utterance.voice = hindiVoice;
        utterance.lang = hindiVoice.lang;
      } else if (indianVoice) {
        utterance.voice = indianVoice;
        utterance.lang = indianVoice.lang;
      }

      utterance.onend = () => { if (onEnd) onEnd(); };
      utterance.onerror = () => { if (onEnd) onEnd(); };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (onEnd) onEnd();
    }
  });
}

export function stopSpeakingWellnessCoach() {
  if (typeof window !== 'undefined') {
    if (activeAudioElement) {
      try {
        activeAudioElement.pause();
        activeAudioElement = null;
      } catch (e) {}
    }
    nativeLiveAudio.stopTextNative();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
