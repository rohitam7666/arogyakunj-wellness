import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  MessageSquare, Plus, Trash2, Send, Sparkles, User, Settings, 
  BookOpen, Volume2, VolumeX, ShieldCheck, 
  Moon, Sun, ChevronRight, Search, Menu, X, RefreshCw, CheckCircle2,
  HeartPulse, Coffee, Apple, Smile, ArrowRight, Mic, Check, Wind, Heart, Camera,
  MoreVertical, Clock, Compass, PhoneCall, PhoneOff, MicOff, Radio, Activity,
  Copy, Smartphone, Bell, Globe, Wifi, Server, CheckCircle, AlertCircle, Minus
} from 'lucide-react';
import { VoiceReminderModal } from './components/VoiceReminderModal';
import { FiredReminderAlert } from './components/FiredReminderAlert';
import { reminderManager, VoiceReminder } from './utils/reminderManager';
import { getOfflineWellnessResponse } from './utils/wellnessOfflineEngine';
import { generateWellnessResponse, speakWellnessCoach, stopSpeakingWellnessCoach } from './services/geminiService';


import { GeminiLiveWebSocketClient } from './services/geminiLiveWebSocket';
import { nativeLiveAudio } from './services/nativeLiveAudio';

const HEALTH_WELLNESS_PROMPTS = [
  '⏰ १ मिनिटात पाणी पिण्याचा रिमाइंडर लाव',
  '🥤 सकाळचा शेक कसा बनवायचा?',
  '🍵 अफ्रेश एनर्जी ड्रिंक कधी घ्यावे?',
  '🥗 दुपारच्या जेवणात काय असावे?',
  '💧 दिवसभरात किती पाणी प्यावे?',
  '⚡ ऊर्जा आणि स्टॅमिना कसा वाढवावा?',
  '💪 वजन नियंत्रणासाठी सोप्या टिप्स',
  '🔋 ऊर्जा वाढवण्यासाठी काय खावे?',
  '😴 चांगली झोप येण्यासाठी काही टिप्स?',
  '🧘 तणाव कमी करण्यासाठी सोपे व्यायाम?',
  '🚶 दिवसभरात किती पावले चालावे?',
  '🍎 रात्री फळे खाणे योग्य आहे का?',
  '🥣 नाश्त्यात काय खाणे उत्तम आहे?',
  '🥛 दूध पिण्याची योग्य वेळ कोणती?',
  '🧂 मिठाचे प्रमाण कमी कसे करावे?',
  '🍭 साखरेला पर्याय काय आहेत?',
  '🥕 डोळ्यांच्या आरोग्यासाठी काय खावे?',
  '🧠 स्मरणशक्ती वाढवण्यासाठी काही टिप्स?',
  '🦶 टाच दुखीवर काही घरगुती उपाय?',
  '🦷 दातांचे आरोग्य कसे जपावे?',
  '🧴 त्वचेसाठी कोणते व्हिटॅमिन महत्त्वाचे?',
  '🍳 प्रथिनांसाठी सर्वोत्तम शाकाहारी पदार्थ कोणते?',
  '🍵 ग्रीन टी पिण्याची योग्य पद्धत काय?',
  '🧘 सकाळी योगासने करण्याचे फायदे काय?',
  '🦵 गुडघेदुखीवर काही घरगुती उपाय?',
  '🌱 पचनक्रिया सुधारण्यासाठी सोपे घरगुती उपाय?',
  '🔥 पोटाची चरबी कमी करण्यासाठी काय करावे?',
  '🥗 संध्याकाळी भूक लागल्यास काय खावे?',
  '🥛 शेक बनवताना थंड पाणी वापरावे का कोमट?',
  '🥑 वजन वाढवण्यासाठी किंवा नियंत्रित ठेवण्यासाठी टिप्स',
  '🏃 सकाळी चालण्याचे शरीरावर काय फायदे होतात?',
  '🌿 हर्बल चहा आणि अफ्रेशमधील फरक काय आहे?',
  '⏰ दुपारच्या जेवणानंतर झोप येणे कसे टाळावे?',
  '💪 स्नायू मजबूत करण्यासाठी काय खावे?',
  '✨ निरोगी आणि उत्साही राहण्यासाठी सकाळची दिनचर्या'
];

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

// High-speed Resample Float32 Audio from native sample rate to 16kHz Int16 PCM Base64
function resampleFloat32To16kHzPCMBase64(inputData: Float32Array, inputSampleRate: number): string {
  let pcm16: Int16Array;
  
  if (inputSampleRate === 16000) {
    pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  } else {
    const ratio = inputSampleRate / 16000;
    const newLength = Math.floor(inputData.length / ratio);
    pcm16 = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originIdx = Math.floor(i * ratio);
      const s = Math.max(-1, Math.min(1, inputData[originIdx] || 0));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }

  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
  }
  return btoa(binary);
}

// 16-bit PCM Base64 to Float32 Helper for 24kHz Audio Playback
function base64ToFloat32PCM(base64: string): Float32Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const dataView = new DataView(bytes.buffer);
  const pcm16Count = Math.floor(len / 2);
  const float32 = new Float32Array(pcm16Count);
  for (let i = 0; i < pcm16Count; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    float32[i] = int16 / 32768.0;
  }
  return float32;
}

// Resample 24kHz PCM from Gemini Live to target AudioContext native sample rate
function resample24kToNative(pcm24: Float32Array, targetSampleRate: number): Float32Array {
  if (targetSampleRate === 24000) return pcm24;
  const ratio = targetSampleRate / 24000;
  const newLen = Math.floor(pcm24.length * ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIndex = i / ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, pcm24.length - 1);
    const frac = srcIndex - i0;
    out[i] = pcm24[i0] * (1 - frac) + pcm24[i1] * frac;
  }
  return out;
}



export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('arogyakunj_fresh_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: '1',
        title: 'Wellness Coaching Consultation',
        messages: [
          {
            role: 'model',
            content: 'नमस्कार! 🙏 **आरोग्यकुंज वेलनेस** मध्ये आपले स्वागत आहे! मी तुमची वेलनेस कोच आहे. सांगा, आज कशी मदत करू? 🌿✨',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        createdAt: Date.now()
      }
    ];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => sessions[0]?.id || '1');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<'chat' | 'settings'>('chat');
  
  // Custom Coach Profile Avatar State
  const [coachAvatar, setCoachAvatar] = useState<string>(() => {
    const saved = localStorage.getItem('arogyakunj_coach_avatar');
    return saved || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300';
  });

  const [userApiKey, setUserApiKey] = useState<string>(() => {
    return localStorage.getItem('arogyakunj_user_gemini_key') || '';
  });
  const [apiKeySaveToast, setApiKeySaveToast] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const handleSaveApiKey = () => {
    localStorage.setItem('arogyakunj_user_gemini_key', userApiKey.trim());
    setApiKeySaveToast(true);
    setTimeout(() => setApiKeySaveToast(false), 3000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini Multimodal Live API Duplex Voice State
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  const [isLiveVoiceMinimized, setIsLiveVoiceMinimized] = useState(false);
  const [liveVoiceStatus, setLiveVoiceStatus] = useState<'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [voiceErrorMessage, setVoiceErrorMessage] = useState<string | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveModelTranscript, setLiveModelTranscript] = useState('');
  const [modalSuggestions, setModalSuggestions] = useState<string[]>(HEALTH_WELLNESS_PROMPTS.slice(0, 5));

  const liveWsClientRef = useRef<GeminiLiveWebSocketClient | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isPlayingAudioUntilRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isCapturingAudioRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;
  const isLiveVoiceActiveRef = useRef<boolean>(false);
  const hasGreetedRef = useRef<boolean>(false);
  const connectionWatchdogRef = useRef<any>(null);
  const currentTurnUserTranscriptRef = useRef('');
  const currentTurnModelTranscriptRef = useRef('');



  // Breathing animation exercise state
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

  // AI Voice Reminder State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [firedReminder, setFiredReminder] = useState<VoiceReminder | null>(null);
  const [reminderToast, setReminderToast] = useState<{ title: string; time: string; msg: string } | null>(null);

  useEffect(() => {
    const onReminderFired = (e: any) => {
      setFiredReminder(e.detail);
    };
    const onReminderCreated = (e: any) => {
      const rem = e.detail;
      setReminderToast({
        title: rem.title,
        time: rem.time,
        msg: rem.spokenMarathi || 'रिमाइंडर शेड्यूल झाला!'
      });
      setTimeout(() => {
        setReminderToast(null);
      }, 5500);
    };

    window.addEventListener('arogyakunj-reminder-fired', onReminderFired);
    window.addEventListener('arogyakunj-reminder-created', onReminderCreated);
    return () => {
      window.removeEventListener('arogyakunj-reminder-fired', onReminderFired);
      window.removeEventListener('arogyakunj-reminder-created', onReminderCreated);
    };
  }, []);

  const recognitionRef = useRef<any>(null);

  const [isInputSpeechActive, setIsInputSpeechActive] = useState(false);
  const inputRecognitionRef = useRef<any>(null);

  const toggleInputSpeech = () => {
    if (isInputSpeechActive) {
      inputRecognitionRef.current?.stop();
      setIsInputSpeechActive(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN';

      recognition.onstart = () => setIsInputSpeechActive(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };
      recognition.onend = () => setIsInputSpeechActive(false);
      recognition.onerror = () => setIsInputSpeechActive(false);
      
      recognition.start();
      inputRecognitionRef.current = recognition;
    }
  };

  const [settings, setSettings] = useState({
    autoSpeech: false,
  });


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('arogyakunj_fresh_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Migration: Automatically update welcome messages in existing sessions to short, authentic Marathi text
  useEffect(() => {
    const shortWelcomeMsg = 'नमस्कार! 🙏 **आरोग्यकुंज वेलनेस** मध्ये आपले स्वागत आहे! मी तुमची वेलनेस कोच आहे. सांगा, आज कशी मदत करू? 🌿✨';
    
    setSessions(prev => prev.map(session => {
      if (session.messages.length > 0 && session.messages[0].role === 'model') {
        const firstMsg = session.messages[0];
        if (
          firstMsg.content.includes('Didi') ||
          firstMsg.content.includes('Welcome to Arogyakunj') ||
          firstMsg.content.includes('swagat') ||
          firstMsg.content.includes('स्वागत') ||
          firstMsg.content.includes('Namaste') ||
          firstMsg.content.includes('नमस्कार') ||
          firstMsg.content.includes('फॉर्म्युला १') ||
          firstMsg.content.length > 85
        ) {
          return {
            ...session,
            messages: [
              {
                ...firstMsg,
                content: shortWelcomeMsg
              },
              ...session.messages.slice(1)
            ]
          };
        }
      }
      return session;
    }));
  }, []);


  useEffect(() => {
    localStorage.setItem('arogyakunj_coach_avatar', coachAvatar);
  }, [coachAvatar]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBreathingActive) {
      const phases: ('Inhale' | 'Hold' | 'Exhale')[] = ['Inhale', 'Hold', 'Exhale'];
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % phases.length;
        setBreathPhase(phases[idx]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isBreathingActive]);



  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.messages, isLoading]);


  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setCoachAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Wellness Chat',
      messages: [
        {
          role: 'model',
          content: 'नमस्कार! 🙏 **आरोग्यकुंज वेलनेस** मध्ये आपले स्वागत आहे! मी तुमची वेलनेस कोच आहे. सांगा, आज कशी मदत करू? 🌿✨',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      createdAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setActiveModule('chat');
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const fresh: ChatSession = {
        id: Date.now().toString(),
        title: 'Wellness Consultation',
        messages: [{ 
          role: 'model', 
          content: 'नमस्कार! 🙏 **आरोग्यकुंज वेलनेस** मध्ये आपले स्वागत आहे! मी तुमची वेलनेस कोच आहे. सांगा, आज कशी मदत करू? 🌿✨', 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }],
        createdAt: Date.now()
      };
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
    } else {
      setSessions(updated);
      if (currentSessionId === id) {
        setCurrentSessionId(updated[0].id);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...currentSession.messages, userMsg];
    let sessionTitle = currentSession.title;
    if (currentSession.messages.length <= 1 && currentSession.title.includes('New Wellness')) {
      sessionTitle = promptText.length > 25 ? promptText.substring(0, 25) + '...' : promptText;
    }

    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, title: sessionTitle, messages: updatedMessages };
      }
      return s;
    });

    setSessions(updatedSessions);
    setInput('');
    setIsLoading(true);

    // Automatic Reminder Intent Detection & Voice Scheduling
    const reminderResult = reminderManager.parseAndCreateFromSpeech(promptText);
    if (reminderResult.success && reminderResult.reminder) {
      reminderManager.playChime();
    }

    const initialModelMsg: Message = {
      role: 'model',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, initialModelMsg] };
      }
      return s;
    }));

    try {
      const history = currentSession.messages.map(m => ({ role: m.role, content: m.content }));
      const responseText = await generateWellnessResponse(promptText, history, (streamed) => {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const lastMsgIndex = s.messages.length - 1;
            const newMsgs = [...s.messages];
            newMsgs[lastMsgIndex] = { ...newMsgs[lastMsgIndex], content: streamed };
            return { ...s, messages: newMsgs };
          }
          return s;
        }));
      });

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const lastMsgIndex = s.messages.length - 1;
          const newMsgs = [...s.messages];
          newMsgs[lastMsgIndex] = { ...newMsgs[lastMsgIndex], content: responseText };
          return { ...s, messages: newMsgs };
        }
        return s;
      }));
    } catch (err: any) {
      console.warn('AI chat error, activating resilient Marathi offline response:', err);
      const offline = getOfflineWellnessResponse(
        promptText,
        reminderResult.success && reminderResult.reminder 
          ? { title: reminderResult.reminder.title, time: reminderResult.reminder.time } 
          : undefined
      );

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const lastMsgIndex = s.messages.length - 1;
          const newMsgs = [...s.messages];
          newMsgs[lastMsgIndex] = { ...newMsgs[lastMsgIndex], content: offline.content };
          return { ...s, messages: newMsgs };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const ensureAudioUnlocked = async () => {
    try {
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state === 'suspended') {
        await outputAudioCtxRef.current.resume();
      }
      if (inputAudioCtxRef.current && inputAudioCtxRef.current.state === 'suspended') {
        await inputAudioCtxRef.current.resume();
      }
    } catch (e) {}
  };

  const stopAllAudioPlayback = () => {
    nativeLiveAudio.interruptPlayback();
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    isPlayingAudioUntilRef.current = 0;
  };

  const cleanupLiveVoiceResources = () => {
    isCapturingAudioRef.current = false;
    nativeLiveAudio.stopCapture();
    nativeLiveAudio.stopPlayback();
    stopAllAudioPlayback();

    if (connectionWatchdogRef.current) {
      clearTimeout(connectionWatchdogRef.current);
      connectionWatchdogRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    setMicVolumeLevel(0);

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) {}
      processorRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch (e) {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch (e) {}
      outputAudioCtxRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (liveWsClientRef.current) {
      liveWsClientRef.current.close();
      liveWsClientRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    try {
      stopSpeakingWellnessCoach();

      // Check if native Android audio hardware is active
      const isNative = await nativeLiveAudio.checkAvailability();
      if (isNative) {
        await nativeLiveAudio.playChunk(base64Audio);
        return;
      }

      const pcmData = base64ToFloat32PCM(base64Audio);
      if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        outputAudioCtxRef.current = new AudioCtx();
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {}
      }

      // Resample 24kHz PCM to ctx.sampleRate so createBuffer never throws on mobile
      const nativeData = resample24kToNative(pcmData, ctx.sampleRate);
      const audioBuffer = ctx.createBuffer(1, nativeData.length, ctx.sampleRate);
      audioBuffer.getChannelData(0).set(nativeData);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.35;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;
      // Smooth uninterrupted audio queueing: catch up only if playback schedule fell behind real time
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.025;
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
      isPlayingAudioUntilRef.current = Math.max(isPlayingAudioUntilRef.current, nextStartTimeRef.current);

      activeSourcesRef.current.push(source);
      
      const cleanupSource = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0 && isLiveVoiceActiveRef.current) {
          setLiveVoiceStatus('listening');
        }
      };

      source.onended = cleanupSource;
      // Safety timeout: ensure source is cleaned up even if browser misses onended
      const safetyMs = Math.ceil(audioBuffer.duration * 1000) + 350;
      setTimeout(cleanupSource, safetyMs);
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  };

  const initAudioCapture = async (stream: MediaStream, inputCtx: AudioContext) => {
    if (isCapturingAudioRef.current) {
      return;
    }
    isCapturingAudioRef.current = true;

    try {
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }

      const source = inputCtx.createMediaStreamSource(stream);

      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const vol = Math.min(100, Math.round((average / 128) * 100));
          setMicVolumeLevel(vol);
          animFrameRef.current = requestAnimationFrame(updateVolume);
        }
      };
      updateVolume();

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isMutedRef.current && isLiveVoiceActiveRef.current) {
          // If the coach is currently playing audio through the speakers, mute mic capture to avoid acoustic feedback
          if (activeSourcesRef.current.length > 0) {
            return;
          }

          const inputData = e.inputBuffer.getChannelData(0);
          const base64PCM = resampleFloat32To16kHzPCMBase64(inputData, inputCtx.sampleRate);
          if (liveWsClientRef.current && liveWsClientRef.current.isReady()) {
            liveWsClientRef.current.sendAudioChunk(base64PCM);
          }
        }
      };

      const muteGain = inputCtx.createGain();
      muteGain.gain.value = 0;
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(inputCtx.destination);
    } catch (err) {
      console.error('Failed to init audio capture:', err);
      isCapturingAudioRef.current = false;
    }
  };

  const shuffleNewSuggestions = () => {
    const shuffled = [...HEALTH_WELLNESS_PROMPTS].sort(() => 0.5 - Math.random());
    setModalSuggestions(shuffled.slice(0, 5));
  };

  // Automatically cycle through new health & wellness questions every 20 seconds while panel is active
  useEffect(() => {
    if (!isLiveVoiceOpen || isLiveVoiceMinimized) return;
    const interval = setInterval(() => {
      shuffleNewSuggestions();
    }, 20000);
    return () => clearInterval(interval);
  }, [isLiveVoiceOpen, isLiveVoiceMinimized]);

  const startLocalVoiceRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          handleSendLiveVoicePrompt(transcript);
        }
      };

      recognition.onend = () => {
        if (isLiveVoiceActiveRef.current) {
          setTimeout(() => {
            if (isLiveVoiceActiveRef.current && (!liveWsClientRef.current || !liveWsClientRef.current.isReady())) {
              try { recognition.start(); } catch (e) {}
            }
          }, 600);
        }
      };

      recognition.onerror = () => {};

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}
  };

  const startLiveVoiceCall = async () => {
    cleanupLiveVoiceResources();

    // Shuffle and pick 5 fresh random suggestions every time panel opens
    shuffleNewSuggestions();

    setIsLiveVoiceOpen(true);
    setIsLiveVoiceMinimized(false);
    isLiveVoiceActiveRef.current = true;
    setLiveVoiceStatus('connecting');
    setVoiceErrorMessage(null);
    setMicPermissionState('prompt');

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
          outputAudioCtxRef.current = new AudioCtx();
        }
        if (outputAudioCtxRef.current.state === 'suspended') {
          outputAudioCtxRef.current.resume();
        }
        if (!inputAudioCtxRef.current || inputAudioCtxRef.current.state === 'closed') {
          inputAudioCtxRef.current = new AudioCtx();
        }
        if (inputAudioCtxRef.current.state === 'suspended') {
          inputAudioCtxRef.current.resume();
        }
      }
    } catch (e) {}

    const liveClient = new GeminiLiveWebSocketClient({
      onConnected: () => {
        console.log('Gemini Live WebSocket successfully connected!');
        if (connectionWatchdogRef.current) {
          clearTimeout(connectionWatchdogRef.current);
          connectionWatchdogRef.current = null;
        }
        setLiveVoiceStatus('listening');
        setVoiceErrorMessage(null);

        // Send conversation history if available for natural ongoing conversation
        if (currentSession.messages.length > 0) {
          const historyTurns = currentSession.messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }));
          liveClient.sendHistory(historyTurns);
        }

        if (inputAudioCtxRef.current && mediaStreamRef.current) {
          initAudioCapture(mediaStreamRef.current, inputAudioCtxRef.current);
        }
      },
      onAudioChunk: async (base64Audio) => {
        setLiveVoiceStatus('speaking');
        await playAudioChunk(base64Audio);
      },
      onModelTranscript: (text) => {
        setLiveModelTranscript(prev => prev + text);
        currentTurnModelTranscriptRef.current += text;
      },
      onUserTranscript: (text) => {
        setLiveUserTranscript(text);
        currentTurnUserTranscriptRef.current = text;
      },
      onInterrupted: () => {
        stopAllAudioPlayback();
        setLiveVoiceStatus('listening');
      },
      onTurnComplete: () => {
        if (currentTurnUserTranscriptRef.current || currentTurnModelTranscriptRef.current) {
          const userContent = currentTurnUserTranscriptRef.current;
          const modelContent = currentTurnModelTranscriptRef.current;

          if (userContent) {
            reminderManager.parseAndCreateFromSpeech(userContent);
          }

          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const newMessages = [...s.messages];
              if (userContent) newMessages.push({ role: 'user', content: userContent, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
              if (modelContent) newMessages.push({ role: 'model', content: modelContent, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
              return { ...s, messages: newMessages };
            }
            return s;
          }));

          currentTurnUserTranscriptRef.current = '';
          currentTurnModelTranscriptRef.current = '';
          // Automatically suggest fresh health questions for the next turn
          shuffleNewSuggestions();
        }
      },
      onError: (err) => {
        console.warn('Gemini Live WebSocket error, activating resilient voice mode:', err);
        if (isLiveVoiceActiveRef.current) {
          setLiveVoiceStatus('listening');
          setVoiceErrorMessage(null);
          startLocalVoiceRecognition();
        }
      },
      onClose: () => {
        if (!isLiveVoiceActiveRef.current) {
          cleanupLiveVoiceResources();
          setLiveVoiceStatus('idle');
        }
      }
    });

    liveWsClientRef.current = liveClient;
    liveClient.connect();

    connectionWatchdogRef.current = setTimeout(() => {
      if (isLiveVoiceActiveRef.current && (!liveWsClientRef.current || !liveWsClientRef.current.isReady())) {
        console.log('Activating resilient voice mode on connection watchdog');
        setLiveVoiceStatus('listening');
        setVoiceErrorMessage(null);
        startLocalVoiceRecognition();
      }
    }, 3000);
    }, 4500);

    // Path A+: Check for Native Android Hardware Audio first
    const isNative = await nativeLiveAudio.checkAvailability();
    if (isNative) {
      console.log('Using Native Android Hardware Audio (16kHz AudioRecord + DSP AEC + 24kHz AudioTrack)');
      const ok = await nativeLiveAudio.startCapture((base64PCM, vol) => {
        if (!isMutedRef.current && isLiveVoiceActiveRef.current) {
          setMicVolumeLevel(vol);
          if (liveWsClientRef.current && liveWsClientRef.current.isReady()) {
            liveWsClientRef.current.sendAudioChunk(base64PCM);
          }
        }
      });
      if (ok) {
        setMicPermissionState('granted');
        isCapturingAudioRef.current = true;
      }
    } else if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }))
      .then(micStream => {
        setMicPermissionState('granted');
        if (!isLiveVoiceActiveRef.current) {
          micStream.getTracks().forEach(t => t.stop());
          return;
        }
        mediaStreamRef.current = micStream;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const inputCtx = inputAudioCtxRef.current || new AudioCtx();
        inputAudioCtxRef.current = inputCtx;
        if (inputCtx.state === 'suspended') inputCtx.resume();

        if (liveWsClientRef.current) {
          initAudioCapture(micStream, inputCtx);
        }
      })
      .catch(micErr => {
        console.warn('Microphone permission deferred or denied:', micErr);
        setMicPermissionState('denied');
      });
    }
  };

  const handleSendLiveVoicePrompt = async (promptText: string) => {
    ensureAudioUnlocked();
    if (!promptText.trim()) return;
    const query = promptText.trim();
    
    // Automatically shuffle new suggestions for next turn
    shuffleNewSuggestions();

    setLiveUserTranscript(query);
    currentTurnUserTranscriptRef.current = query;
    setLiveModelTranscript('');
    currentTurnModelTranscriptRef.current = '';
    setLiveVoiceStatus('speaking');

    reminderManager.parseAndCreateFromSpeech(query);

    if (liveWsClientRef.current && liveWsClientRef.current.isReady()) {
      const sent = liveWsClientRef.current.sendText(query);
      if (sent) return;
    }

    try {
      const reply = await generateWellnessResponse(
        query,
        currentSession.messages.map(m => ({ role: m.role, content: m.content }))
      );

      setLiveModelTranscript(reply);
      currentTurnModelTranscriptRef.current = reply;

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [
              ...s.messages,
              { role: 'user', content: query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              { role: 'model', content: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            ]
          };
        }
        return s;
      }));

      speakWellnessCoach(reply, () => {
        if (isLiveVoiceActiveRef.current) {
          setLiveVoiceStatus('listening');
        }
      });
    } catch (e) {
      if (isLiveVoiceActiveRef.current) {
        setLiveVoiceStatus('listening');
      }
    }
  };

  const endLiveVoiceCall = () => {
    isLiveVoiceActiveRef.current = false;

    if (currentTurnUserTranscriptRef.current || currentTurnModelTranscriptRef.current) {
      const userContent = currentTurnUserTranscriptRef.current;
      const modelContent = currentTurnModelTranscriptRef.current;
      
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const newMessages = [...s.messages];
          if (userContent) {
            newMessages.push({
              role: 'user',
              content: userContent,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
          if (modelContent) {
            newMessages.push({
              role: 'model',
              content: modelContent,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
          return { ...s, messages: newMessages };
        }
        return s;
      }));
    }

    stopSpeakingWellnessCoach();
    cleanupLiveVoiceResources();
    setLiveUserTranscript('');
    setLiveModelTranscript('');
    currentTurnUserTranscriptRef.current = '';
    currentTurnModelTranscriptRef.current = '';
    setIsLiveVoiceOpen(false);
    setIsLiveVoiceMinimized(false);
    setLiveVoiceStatus('idle');
    setVoiceErrorMessage(null);
  };



  const filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#e6f7ed] text-slate-800 font-sans">
      
      {/* Hidden File Input for Avatar Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* FRESH & CLEAR GREEN SIDEBAR / CHAT HISTORY PANEL */}
      <aside 
        onClick={(e) => e.stopPropagation()}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-72 md:w-80 bg-[#f0faf3] border-r border-[#bceacb] shadow-2xl transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        
        {/* Top Brand Bar with Artistic Wellness Background */}
        <div className="relative overflow-hidden flex items-center justify-between px-4 py-3.5 bg-gradient-to-br from-[#dcf5e7] via-[#ebfaf1] to-[#d5f3e1] border-b border-[#bceacb] shadow-[0_2px_10px_rgba(2,90,58,0.05)]">
          {/* Artistic Botanical & Zen Wellness Watermark Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            {/* Ambient Wellness Aura Glows */}
            <div className="absolute -left-4 -top-8 w-32 h-32 rounded-full bg-[#00b074]/15 blur-xl" />
            <div className="absolute right-6 -bottom-6 w-24 h-24 rounded-full bg-[#34d399]/20 blur-lg" />

            {/* Artistic Botanical Leaves & Zen Arcs Watermark */}
            <svg 
              className="absolute right-0 top-0 h-full w-44 text-[#025a3a]/15 pointer-events-none transform translate-x-2" 
              viewBox="0 0 170 70" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Zen Rings */}
              <circle cx="130" cy="35" r="28" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.45" />
              <circle cx="130" cy="35" r="40" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />

              {/* Ayurvedic Herbal Leaf 1 */}
              <path 
                d="M130 65 C115 42, 120 18, 146 8 C146 30, 138 50, 130 65 Z" 
                fill="#00b074" 
                fillOpacity="0.12" 
                stroke="currentColor" 
                strokeWidth="1.2"
              />
              <path d="M130 65 Q133 38 144 12" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
              <path d="M131 48 Q137 44 140 45" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
              <path d="M130 36 Q135 32 139 34" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />

              {/* Ayurvedic Herbal Leaf 2 */}
              <path 
                d="M95 68 C100 45, 90 22, 68 15 C75 35, 85 55, 95 68 Z" 
                fill="#025a3a" 
                fillOpacity="0.10" 
                stroke="currentColor" 
                strokeWidth="1.2"
              />
              <path d="M95 68 Q90 44 72 19" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
              <path d="M92 52 Q85 47 82 50" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
              <path d="M89 39 Q83 34 78 38" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />

              {/* Delicate Botanical Fronds */}
              <path d="M52 58 Q62 45 70 43 C68 38 62 38 57 42" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
              <path d="M110 60 Q116 51 123 51 C121 47 117 47 114 52" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
            </svg>

            {/* Left Corner Subtle Botanical Sprout */}
            <svg 
              className="absolute -left-1 bottom-0 h-10 w-14 text-[#00b074]/20 pointer-events-none" 
              viewBox="0 0 50 35" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 35 C12 28 22 18 24 4 C16 9 8 20 0 35 Z" fill="currentColor" fillOpacity="0.15" />
              <path d="M0 35 Q15 20 22 6" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
            </svg>
          </div>

          {/* Arogyakunj Wellness Brand with Organic Styling */}
          <div className="relative z-10 flex items-center gap-2">
            <span className="font-extrabold text-[#025a3a] text-lg md:text-xl tracking-tight leading-snug drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              Arogyakunj Wellness
            </span>
          </div>

          {/* 2-line Hide Button with Frosted Backdrop */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="relative z-10 p-2 text-[#025a3a] bg-white/70 hover:bg-white border border-[#bceacb] shadow-2xs hover:shadow-xs rounded-lg transition-all shrink-0 flex flex-col justify-center items-center gap-1.5 w-8 h-8 group backdrop-blur-xs"
            title="Hide chat history"
            aria-label="Hide chat history"
          >
            <span className="w-4 h-0.5 bg-[#025a3a] rounded-full transition-colors group-hover:bg-[#00b074]" />
            <span className="w-4 h-0.5 bg-[#025a3a] rounded-full transition-colors group-hover:bg-[#00b074]" />
          </button>
        </div>

        {/* Vibrant & Premium "+ New Chat" Button */}
        <div className="px-3 py-3">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-auto py-2 px-4 bg-gradient-to-r from-[#00b074] via-[#00a66d] to-[#028a59] hover:from-[#00c582] hover:to-[#009b64] text-white font-bold rounded-full shadow-[0_3px_12px_rgba(0,176,116,0.3)] hover:shadow-[0_4px_16px_rgba(0,176,116,0.45)] transition-all duration-200 active:scale-[0.98] border border-white/20"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span className="text-sm">New chat</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 py-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/70" />
            <input
              type="text"
              placeholder="Search recent chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-xs text-black placeholder-black/50 pl-8 pr-3 py-1.5 rounded-full border border-[#bceacb] focus:outline-none focus:border-[#00b074] shadow-2xs transition-colors"
            />
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
          <div className="px-3 py-1 text-[11px] font-bold text-black/80 uppercase tracking-wider">Recent</div>
          <div className="space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => { setCurrentSessionId(session.id); setActiveModule('chat'); setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between px-3.5 py-2 rounded-full text-xs cursor-pointer transition-all ${currentSessionId === session.id && activeModule === 'chat' ? 'bg-[#00b074] text-white font-semibold shadow-xs' : 'text-[#025a3a] hover:bg-[#bceacb]/60'}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Profile Footer */}
        <div className="p-3 border-t border-[#bceacb] bg-[#e3f6ea]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#00b074] shadow-xs">
                <img src={coachAvatar} alt="AI Coach" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-black truncate">Arogyakunj Coach</div>
                <div className="text-[10px] text-[#00b074] font-bold truncate">Wellness Guide</div>
              </div>
            </div>
            <button 
              onClick={() => setActiveModule('settings')}
              className={`p-1.5 rounded-full transition-colors ${activeModule === 'settings' ? 'bg-[#00b074] text-white' : 'text-black/70 hover:bg-[#bceacb]/60'}`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>


      </aside>

      {/* Backdrop overlay to hide chat history panel when tapping outside */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity cursor-pointer"
          aria-label="Close chat history"
        />
      )}

      {/* MAIN CONTENT AREA */}
      <main 
        onClick={() => {
          if (isSidebarOpen) {
            setIsSidebarOpen(false);
          }
        }}
        className="flex-1 flex flex-col h-full bg-[#e6f7ed] relative overflow-hidden"
      >
        
        {/* Fresh Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-[#f0faf3] border-b border-[#bceacb] shadow-2xs z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarOpen(!isSidebarOpen);
              }}
              className="p-2 text-[#025a3a] hover:bg-[#bceacb]/50 rounded-full transition-colors"
              title="Toggle chat history"
              aria-label="Toggle chat history"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col">
              <h2 className="font-bold text-black text-sm md:text-base leading-tight">
                Arogyakunj Wellness
              </h2>
              <span className="text-[10px] md:text-[11px] font-bold text-[#00b074] tracking-wider uppercase">
                AI COMPANION
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00b074] hover:bg-[#009260] text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Configure Google Gemini API Key"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>🔑 API Key</span>
            </button>

            <button
              onClick={() => setIsReminderModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#e6f7ed] border border-[#bceacb] text-xs font-bold text-[#025a3a] shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="AI व्हॉईस रिमाइंडर्स (AI Voice Routine & Reminders)"
            >
              <Bell className="w-3.5 h-3.5 text-[#00b074]" />
              <span>रिमाइंडर्स</span>
            </button>
          </div>
        </header>



        {/* MAIN AI COACH PAGE */}
        {activeModule !== 'settings' && (
          <div className="flex-1 flex flex-col overflow-hidden relative bg-[#e6f7ed]">
            
            {/* WhatsApp Inspired Subtle Botanical & Wellness Doodle Background */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.07] z-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140' fill='none' stroke='%23025a3a' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 20c8 0 14 6 14 14-8 0-14-6-14-14zM20 34l14-14'/%3E%3Cpath d='M85 22h16v10a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8V22zM101 26h4a3 3 0 0 1 0 6h-4M87 18c1-1 1-3 0-4M93 18c1-1 1-3 0-4'/%3E%3Cpath d='M30 85c0 4.4 3.6 8 8 8s8-3.6 8-8c0-5-8-12-8-12s-8 7-8 12z'/%3E%3Cpath d='M88 88c-2.5-2.5-6.5-2.5-9 0s-2.5 6.5 0 9l9 9 9-9c2.5-2.5 2.5-6.5 0-9s-6.5-2.5-9 0z'/%3E%3Cpath d='M110 50v6M107 53h6M15 110l4-4M19 110l-4-4'/%3E%3Cpath d='M65 55a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'/%3E%3Cpath d='M15 60h12v8H15z'/%3E%3Cpath d='M60 20l5 10h10l-8 6 3 10-8-6-8 6 3-10-8-6h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
                backgroundSize: '150px 150px'
              }}
            />

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-12 space-y-4 relative z-10">
              
              {/* Messages List with Profile Photo Outside of Chat Panel */}
              {currentSession.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 max-w-2xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-[#00b074] shrink-0 self-start mt-1 shadow-xs bg-[#025a3a]">
                      <img src={coachAvatar} alt="Coach" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[78%]`}>
                      
                      <div className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm relative font-health ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-br from-[#00c985] to-[#009260] text-white rounded-tr-none font-semibold shadow-[0_4px_14px_rgba(0,176,116,0.25)] border border-emerald-400/30' 
                          : 'bg-white text-[#025a3a] border border-emerald-100 rounded-tl-none font-medium shadow-xs'
                      }`}>
                        {msg.role === 'user' ? (
                          <div className="text-white text-sm leading-relaxed font-semibold">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="wellness-chat-prose max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}

                        <div className={`flex items-center justify-end gap-1 text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-emerald-100 font-bold' : 'text-slate-400'}`}>
                          <span>{msg.timestamp}</span>
                          {msg.role === 'user' && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>

                    </div>

                  </div>
                ))}

              {isLoading && (
                <div className="flex gap-3 max-w-2xl mx-auto justify-start">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-[#00b074] shrink-0 self-start mt-1 shadow-xs bg-[#025a3a]">
                    <img src={coachAvatar} alt="Coach" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white border border-emerald-100 rounded-tl-none flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-[#00b074] animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#00b074] animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#00b074] animate-bounce"></span>
                  </div>
                </div>
              )}

              {/* REAL-TIME SPEECH-TO-TEXT TRANSCRIPTION INTEGRATED INTO CHAT LOG */}
              {(liveUserTranscript || liveModelTranscript) && (
                <div className="space-y-4 pt-2 pb-4">
                  {liveUserTranscript && (
                    <div className="flex gap-3 max-w-2xl mx-auto justify-end animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex flex-col items-end max-w-[85%] md:max-w-[75%]">
                        <div className="p-3.5 rounded-2xl text-sm leading-relaxed shadow-xs bg-[#00b074] text-white rounded-tr-none border border-emerald-400/30">
                          <div className="flex items-center gap-2 mb-1 opacity-70">
                            <Mic className="w-3 h-3 animate-pulse text-emerald-50" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-50">Listening...</span>
                          </div>
                          <p className="italic">{liveUserTranscript}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {liveModelTranscript && (
                    <div className="flex gap-3 max-w-2xl mx-auto justify-start animate-in fade-in slide-in-from-left-4 duration-300">
                      <div className="flex flex-col items-start max-w-[85%] md:max-w-[75%]">
                        <div className="p-3.5 rounded-2xl text-sm leading-relaxed shadow-xs bg-white text-[#025a3a] border border-emerald-100 rounded-tl-none font-health">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00b074] animate-pulse"></span>
                            <span className="text-[10px] font-bold text-[#00b074] uppercase tracking-widest">Coach Typing...</span>
                          </div>
                          <div className="wellness-chat-prose max-w-none">
                            <ReactMarkdown>{liveModelTranscript}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Vibrant Fresh Input Bar */}
            <div className="p-3 md:p-4 relative z-10">
              <div className="max-w-2xl mx-auto relative">
                


                {/* Simple Marathi Quick Suggestions */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[11px] mb-1">
                  <span className="text-[10px] font-bold text-[#025a3a]/80 shrink-0">साधी मराठी:</span>
                  {[
                    '⏰ १ मिनिटात पाणी पिण्याचा रिमाइंडर लाव',
                    '🥤 सकाळचा शेक कसा बनवायचा?',
                    '🍵 अफ्रेश एनर्जी ड्रिंक कधी घ्यावे?',
                    '🥗 दुपारच्या जेवणात काय असावे?',
                    '💧 दिवसभरात किती पाणी प्यावे?',
                    '⚡ ऊर्जा आणि स्टॅमिना कसा वाढवावा?',
                    '💪 वजन नियंत्रणासाठी सोप्या टिप्स'
                  ].map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(suggestion)}
                      className="px-2.5 py-1 bg-white/90 hover:bg-white text-[#025a3a] font-bold rounded-full border border-[#86d9a8] shadow-2xs whitespace-nowrap transition-all active:scale-95 cursor-pointer hover:border-[#00b074] shrink-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex items-center gap-2 bg-white border-2 border-[#86d9a8] rounded-full px-4 py-2.5 shadow-[0_4px_16px_rgba(0,176,116,0.12)] focus-within:border-[#00b074] focus-within:ring-4 focus-within:ring-[#00b074]/20 transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="p-2 text-[#00b074] hover:text-white hover:bg-gradient-to-r hover:from-[#00b074] hover:to-[#028a59] bg-[#e6f7ed] rounded-full transition-all duration-200 shadow-2xs hover:scale-105 active:scale-95"
                    title="New Chat Session"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <input
                    type="text"
                    placeholder="साध्या मराठीत विचारा: उदा. शेक कसा बनवायचा, पाणी किती प्यायचे..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-transparent text-[#025a3a] placeholder-[#025a3a]/60 text-sm focus:outline-none py-1.5 font-semibold font-health tracking-wide"
                  />

                  <button
                    type="button"
                    onClick={toggleInputSpeech}
                    className={`p-2 rounded-full transition-all ${isInputSpeechActive ? 'bg-red-500 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'text-[#025a3a]/70 hover:text-[#00b074] hover:bg-emerald-50'}`}
                    title="Realtime Speech to Text"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 rounded-full bg-gradient-to-r from-[#00b074] to-[#009260] hover:from-[#009260] hover:to-[#02794e] disabled:opacity-40 text-white transition-all shadow-[0_4px_12px_rgba(0,176,116,0.35)] active:scale-95 cursor-pointer"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}



        {/* MODULE: SETTINGS */}
        {activeModule === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#e6f7ed]">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-[#025a3a]">Settings</h3>
                <p className="text-sm text-slate-500 mt-1">Manage your Arogyakunj Wellness preferences.</p>
              </div>
              <div className="bg-white border border-[#bceacb] rounded-2xl p-6 space-y-6 shadow-2xs">
                


                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">Coach Profile Photo</div>
                    <div className="text-xs text-slate-500">Upload or select your preferred coach picture</div>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#00b074] hover:bg-[#009260] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Upload Photo
                  </button>
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#00b074]" />
                      <span>AI व्हॉईस रिमाइंडर्स आणि दिनचर्या</span>
                    </div>
                    <div className="text-xs text-slate-500">पाणी, शेक, अफ्रेश आणि जेवणाचे व्हॉईस अलार्म व्यवस्थापित करा</div>
                  </div>
                  <button
                    onClick={() => setIsReminderModalOpen(true)}
                    className="px-4 py-2 bg-[#00b074] hover:bg-[#009260] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
                  >
                    रिमाइंडर्स उघडा
                  </button>
                </div>

                <div className="pb-4 border-b border-slate-100 space-y-2">
                  <div>
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#00b074]" />
                      <span>Google Gemini API Key (AI Studio)</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Enter your Google Gemini API key (from https://aistudio.google.com/app/apikey) for direct AI connection
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste your AIzaSy... Gemini API key here"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00b074]"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      className="px-4 py-2 bg-[#00b074] hover:bg-[#009260] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
                    >
                      Save Key
                    </button>
                  </div>
                  {apiKeySaveToast && (
                    <div className="text-xs font-bold text-[#00b074] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Gemini API Key saved successfully!</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-800 text-sm">AI Voice & Live Processing</div>
                  <div className="text-xs text-slate-600 bg-[#f0faf3] p-3 rounded-xl border border-[#bceacb] font-medium flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#025a3a]">High-Fidelity Duplex Voice</div>
                      <div className="text-[11px] text-slate-500">Ultra-Low Latency Audio Stream via Secure WebSockets</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#00b074] text-white text-[10px] font-bold uppercase">Optimized</span>
                  </div>
                </div>


              </div>
            </div>
          </div>
        )}

      </main>



      {/* Floating Circular AI Voice Companion Popup Circle (Trigger & Mini Companion) */}
      {(!isLiveVoiceOpen || isLiveVoiceMinimized) && (
        <div className="fixed bottom-32 right-3 sm:bottom-36 sm:right-6 md:bottom-36 md:right-8 z-40 flex items-center gap-2 pointer-events-auto transition-all duration-300">
          {/* Marathi Tooltip / Label */}
          <button
            type="button"
            onClick={() => {
              if (isLiveVoiceMinimized) {
                setIsLiveVoiceMinimized(false);
              } else {
                startLiveVoiceCall();
              }
            }}
            className="group hidden sm:flex items-center gap-2 pl-3.5 pr-3 py-1.5 bg-white/95 hover:bg-white text-[#025a3a] rounded-full shadow-[0_4px_16px_rgba(0,176,116,0.22)] border border-[#86d9a8] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="AI व्हॉईस कंपॅनियन थेट बोला"
          >
            <span className={`w-2 h-2 rounded-full ${isLiveVoiceActiveRef.current ? 'bg-emerald-500 animate-ping' : 'bg-[#00b074] animate-pulse'}`} />
            <div className="text-left leading-tight">
              <div className="text-[11.5px] font-bold flex items-center gap-1 text-[#025a3a]">
                <span>{isLiveVoiceActiveRef.current ? 'कॉल सुरू आहे' : 'AI थेट बोला'}</span>
                <span className="px-1.5 py-0.2 bg-[#00b074]/15 text-[#00b074] rounded text-[9px] font-bold font-mono">LIVE</span>
              </div>
              <div className="text-[9.5px] text-[#025a3a]/70 font-medium">
                {isLiveVoiceActiveRef.current ? 'टॅप करा (उघडा)' : 'व्हॉईस कंपॅनियन'}
              </div>
            </div>
          </button>

          {/* The Circular Popup Action Button */}
          <button
            type="button"
            onClick={() => {
              if (isLiveVoiceMinimized) {
                setIsLiveVoiceMinimized(false);
              } else {
                startLiveVoiceCall();
              }
            }}
            className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center p-0.5 bg-gradient-to-tr from-[#00b074] via-[#009e66] to-[#025a3a] text-white shadow-[0_6px_25px_rgba(0,176,116,0.45)] hover:shadow-[0_8px_32px_rgba(0,176,116,0.65)] transition-all duration-300 transform hover:scale-108 active:scale-95 border-2 border-white cursor-pointer"
            title="AI व्हॉईस कंपॅनियन (Live Voice Companion)"
            aria-label="Open AI Voice Companion"
          >
            {/* Concentric Glowing Aura Rings */}
            <span className="absolute -inset-2 rounded-full bg-emerald-400/40 animate-ping opacity-60 pointer-events-none" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#00b074] to-[#34d399] opacity-75 blur-xs animate-pulse pointer-events-none" />

            {/* Coach Portrait Inside Circle */}
            <div className="relative w-full h-full rounded-full overflow-hidden border border-white/60 bg-[#025a3a] flex items-center justify-center">
              <img
                src={coachAvatar}
                alt="AI Coach"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />

              {/* Animated Speaking Waves Overlay if active */}
              {isLiveVoiceActiveRef.current && (
                <div className="absolute inset-0 bg-[#025a3a]/40 backdrop-blur-[0.5px] flex items-center justify-center gap-0.5">
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
                </div>
              )}
            </div>

            {/* Little LIVE Badge Pinned to the Side of the Circle */}
            <span className="absolute -bottom-0.5 -right-1.5 z-20 px-1.5 py-0.5 bg-[#00b074] text-white text-[7.5px] font-black font-mono rounded-full border border-white shadow-xs tracking-wider flex items-center gap-0.5 leading-none">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              <span>LIVE</span>
            </span>
          </button>
        </div>
      )}

      {/* AI Live Voice Companion Modal (Ultra-Low Latency Duplex Voice via WebSockets) */}
      {isLiveVoiceOpen && !isLiveVoiceMinimized && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-300"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#eaf8f0] via-[#f4fbf7] to-[#e4f6ec] border-2 border-[#86d9a8] rounded-3xl shadow-[0_20px_60px_rgba(2,90,58,0.25)] p-5 sm:p-7 flex flex-col items-center text-center overflow-hidden">
            
            {/* Ambient Watermark / Aura Glow in Modal Background */}
            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[radial-gradient(circle,_rgba(0,176,116,0.18)_0%,_transparent_70%)] pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-[radial-gradient(circle,_rgba(52,211,153,0.2)_0%,_transparent_70%)] pointer-events-none" />

            {/* Top Bar: Live Badge & Close Button */}
            <div className="w-full flex items-center justify-between z-10 mb-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-[#bceacb] shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#00b074] animate-pulse" />
                <span className="text-[11px] font-bold text-[#025a3a] tracking-wide">
                  Arogyakunj Live
                </span>

              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsLiveVoiceMinimized(true)}
                  className="p-2 text-[#025a3a]/70 hover:text-[#00b074] hover:bg-[#e6f7ed] rounded-full transition-all cursor-pointer"
                  title="कमी करा (Minimize)"
                  aria-label="Minimize to circle"
                >
                  <Minus className="w-4 h-4" />
                </button>



                <button
                  type="button"
                  onClick={endLiveVoiceCall}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                  title="कॉल बंद करा (Close)"
                  aria-label="Close live call"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Central Animated Coach Avatar with Layered Aura Waves */}
            <div className="relative my-4 flex items-center justify-center w-40 h-40 z-10 rounded-full">
              {/* Dynamic Aura Waves (Serene & Calming Organic Breath Waves) */}
              <div className="absolute inset-0 rounded-full transition-all duration-700 ease-in-out pointer-events-none">
                {liveVoiceStatus === 'speaking' ? (
                  <>
                    <div className="absolute inset-0 rounded-full border border-[#00b074]/60 animate-active-aura-speaking pointer-events-none" />
                    <div className="absolute inset-0 rounded-full border border-[#00b074]/40 animate-active-aura-speaking-delayed pointer-events-none" />
                    <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle,_rgba(0,176,116,0.28)_0%,_rgba(0,176,116,0.08)_50%,_transparent_70%)] animate-active-glow pointer-events-none" />
                  </>
                ) : liveVoiceStatus === 'listening' ? (
                  <>
                    <div className="absolute inset-0 rounded-full border border-[#00b074]/45 animate-active-aura pointer-events-none" />
                    <div className="absolute inset-0 rounded-full border border-[#00b074]/30 animate-active-aura-delayed pointer-events-none" />
                    <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle,_rgba(0,176,116,0.18)_0%,_rgba(0,176,116,0.05)_50%,_transparent_70%)] animate-active-glow pointer-events-none" />
                  </>
                ) : (
                  <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle,_rgba(0,176,116,0.12)_0%,_transparent_70%)] pointer-events-none" />
                )}
              </div>

              {/* Coach Portrait Image */}
              <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-[#025a3a] z-10">
                <img
                  src={coachAvatar}
                  alt="AI Coach"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Status Indicator Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 border border-[#bceacb] shadow-2xs mb-2.5 z-10">
              <span className={`w-2 h-2 rounded-full ${
                liveVoiceStatus === 'speaking' ? 'bg-[#00b074] animate-ping' :
                liveVoiceStatus === 'listening' ? 'bg-[#00b074] animate-pulse' :
                liveVoiceStatus === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
              }`} />
              <span className="text-xs font-bold text-[#025a3a]">
                {liveVoiceStatus === 'connecting' && 'सर्व्हरशी जोडत आहे... (Connecting Live...)'}
                {liveVoiceStatus === 'listening' && 'ऐकत आहे... मोकळेपणाने बोला!'}
                {liveVoiceStatus === 'speaking' && 'कोच बोलत आहे...'}
                {liveVoiceStatus === 'error' && (voiceErrorMessage || 'काहीतरी अडचण आली')}
              </span>
            </div>

            {/* Active Sound Equalizer Bars */}
            <div className="flex items-center justify-center gap-1.5 h-6 mb-3 z-10">
              {[0.4, 0.8, 1, 0.7, 0.9, 0.5, 0.75, 1, 0.6].map((scale, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full bg-[#00b074] transition-all duration-150 ${
                    liveVoiceStatus === 'speaking' 
                      ? 'animate-pulse' 
                      : liveVoiceStatus === 'listening' 
                        ? (micVolumeLevel > 15 ? 'opacity-90' : 'opacity-40')
                        : 'opacity-25'
                  }`}
                  style={{
                    height: liveVoiceStatus === 'speaking' 
                      ? `${Math.max(6, Math.min(24, 18 * scale))}px` 
                      : liveVoiceStatus === 'listening'
                        ? `${Math.max(4, Math.min(24, (micVolumeLevel / 100) * 26 * scale))}px`
                        : '5px'
                  }}
                />
              ))}
            </div>

            {/* Live Speech Feedback (Compact, clean speech preview) */}
            {(liveUserTranscript || liveModelTranscript) && (
              <div className="w-full max-h-24 overflow-y-auto px-3.5 py-2.5 rounded-2xl bg-white/90 border border-[#bceacb] shadow-2xs text-left text-xs mb-3 space-y-1 z-10">
                {liveUserTranscript && (
                  <p className="text-emerald-800 font-semibold truncate">
                    <span className="font-bold text-[#025a3a]">तुम्ही:</span> {liveUserTranscript}
                  </p>
                )}
                {liveModelTranscript && (
                  <p className="text-[#025a3a] font-medium line-clamp-2">
                    <span className="font-bold text-[#00b074]">कोच:</span> {liveModelTranscript}
                  </p>
                )}
              </div>
            )}

            {/* Quick Suggestion Chips (Dynamic Health & Wellness Suggestions) */}
            <div className="w-full mb-4 z-10">
              <div className="text-[10px] font-bold text-[#025a3a]/80 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#00b074]" />
                <span>आरोग्य प्रश्न (टॅप करा):</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-h-24 overflow-y-auto scrollbar-none">
                {modalSuggestions.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendLiveVoicePrompt(promptText)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-[#025a3a] bg-white hover:bg-[#e6f7ed] hover:border-[#00b074] border border-[#bceacb] rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls Bar: Mute/Unmute & End Call */}
            <div className="flex items-center justify-center gap-8 pt-3 w-full border-t border-[#bceacb]/70 z-10">
              {/* Mute/Unmute Microphone Button */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3.5 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
                    isMuted 
                      ? 'bg-red-100 border-2 border-red-400 text-red-600 hover:bg-red-200' 
                      : 'bg-white border-2 border-[#bceacb] text-[#025a3a] hover:bg-[#e6f7ed]'
                  }`}
                  title={isMuted ? 'माईक चालू करा' : 'माईक बंद करा'}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-red-600" /> : <Mic className="w-5 h-5 text-[#00b074]" />}
                </button>
                <span className="text-[10px] font-bold text-[#025a3a]">
                  {isMuted ? 'माईक बंद' : 'माईक चालू'}
                </span>
              </div>

              {/* End Call Button */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={endLiveVoiceCall}
                  className="p-4 rounded-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 cursor-pointer border border-white/30"
                  title="कॉल संपवा"
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
                <span className="text-[10px] font-bold text-red-600">
                  कॉल संपवा
                </span>
              </div>
            </div>



          </div>
        </div>
      )}

      {/* AI Voice Routine & Reminders Modal */}
      <VoiceReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        coachAvatar={coachAvatar}
      />

      {/* Real-time Fired Reminder Alert Banner */}
      <FiredReminderAlert
        reminder={firedReminder}
        onDismiss={() => setFiredReminder(null)}
        coachAvatar={coachAvatar}
      />

      {/* Instant Reminder Scheduled Toast Confirmation */}
      {reminderToast && (
        <div 
          onClick={() => setReminderToast(null)}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-gradient-to-r from-[#025a3a] to-[#00b074] text-white p-3.5 rounded-2xl shadow-xl border border-white/20 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-emerald-200 animate-bounce" />
            </div>
            <div>
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>⏰ रिमाइंडर सेट झाला!</span>
                <span className="px-1.5 py-0.2 bg-white/25 rounded text-[10px] font-mono">{reminderToast.time}</span>
              </div>
              <p className="text-[11px] text-emerald-100 line-clamp-1">{reminderToast.title}</p>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setReminderToast(null); }}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Gemini API Key Modal */}
      {isApiKeyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsApiKeyModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border-2 border-[#bceacb] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-[#00b074]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#025a3a] text-base">Gemini API Key</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Google AI Studio API Key Configuration</p>
                </div>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Enter your Google Gemini API key to enable direct, high-speed AI responses in Marathi:
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#025a3a] uppercase tracking-wider block">
                  API Key String (starts with AIzaSy...)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#00b074] shadow-xs"
                />
              </div>

              {apiKeySaveToast && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#00b074] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Key saved! Direct Gemini AI connection activated.</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-[#00b074] hover:underline flex items-center gap-1"
                >
                  <span>Get Free Key at Google AI Studio</span>
                  <ArrowRight className="w-3 h-3" />
                </a>

                <button
                  onClick={handleSaveApiKey}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#00b074] to-[#028a59] hover:from-[#009260] hover:to-[#027048] text-white text-xs font-extrabold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Save API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
