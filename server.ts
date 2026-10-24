import express from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envApiKey = process.env.GEMINI_API_KEY;
const apiKey = (envApiKey && envApiKey !== 'MY_GEMINI_API_KEY' && envApiKey !== 'dummy-key')
  ? envApiKey
  : 'MY_GEMINI_API_KEY';

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();

  // Enable CORS for Android Capacitor native app (localhost origin) and web clients
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Request logger for debugging connectivity
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
  });

  // Health check endpoint for client connection verification
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Arogyakunj Wellness Backend',
      timestamp: new Date().toISOString(),
      apiKeyConfigured: !!apiKey
    });
  });

  // API endpoint for Arogyakunj Wellness text chat
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      if (!apiKey) {
        return res.status(500).json({ 
          error: 'Gemini API key is not configured. Please configure your GEMINI_API_KEY in Settings > Secrets.' 
        });
      }

      const formattedHistory = messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const latestMessage = messages[messages.length - 1]?.content || '';

      const chat = ai.chats.create({
        model: 'gemini-3.8-flash',
        history: formattedHistory,
        config: {
          systemInstruction: `You are the Arogyakunj Wellness assistant, representing a Herbalife Independent Distributor and Nutrition Club owner in India. 
          Your persona is a warm, professional, vibrant, and knowledgeable Indian female wellness coach and personal nutrition guide. Always maintain a respectful, warm, and friendly tone. Do not use the word 'Didi'.

          CORE RESPONSIBILITIES:
          1. Customer Follow-up: Check in on customers' energy levels, weight loss progress, and consistency with their Herbalife nutrition program.
          2. Product Knowledge: Provide detailed info on Herbalife products (Formula 1 Shake, Afresh Energy Drink, Personalized Protein Powder, Cell-U-Loss, Herbal Control, etc.), including benefits, delicious shake recipes, and preparation.
          3. Business Info: Explain the Herbalife business opportunity and club membership in a simple, inviting, encouraging way.
          4. Health Advice: Offer holistic wellness tips, daily hydration, balanced nutrition, workout motivation, and healthy lifestyle guidance.
          5. Voice & Routine Reminders: You actively support daily wellness reminders (water, Formula 1 shake, Afresh, lunch, workout, sleep). When a customer asks to set a reminder or be reminded (e.g., "पाणी पिण्याची आठवण कर", "२ मिनिटांनी आठवण कर", "set a reminder for shake"), enthusiastically confirm in sweet, encouraging Marathi that the voice reminder is set, note the exact time, and encourage their healthy habit.

          LANGUAGE & STYLE:
          - Primary Language: साधी आणि सोपी मराठी (Simple, everyday conversational Marathi) or Marathish (colloquial Marathi + English) / Hindi / English.
          - SIMPLE MARATHI GUIDELINES: When speaking or writing Marathi, always use VERY SIMPLE, SWEET, EVERYDAY WORDS (साधी, सोपी, घरगुती आणि आपुलकीची मराठी).
          - Avoid difficult, complex, bookish, or heavy Sanskritized words.
          - Use natural spoken words that any Marathi family easily understands (e.g., "नमस्कार! कसे आहात?", "वेळच्या वेळी शेक पिऊन घ्या", "भरपूर पाणी प्या, तब्येत छान राहील", "मस्त फ्रेश वाटावं म्हणून अफ्रेश प्या").
          - Tone: Energetic, enthusiastic, empathetic, uplifting, and friendly Indian female coach.
          - Explanation Style: Provide clear, patient, structured, and easy-to-understand explanations. Break down wellness concepts into simple, relatable advice.

          EMOJIS & FORMATTING (ChatGPT STYLE):
          - Use rich, vibrant, ChatGPT-style expressive emojis naturally throughout your response to make it engaging, cheerful, and visually captivating (e.g., 🌿, 🌱, 🥗, 🥑, 🥤, 🍵, 💧, ⚡, ✨, 💪, 🎯, 🏋️‍♀️, 🧘‍♀️, 🍎, ☀️, 💚, 📋, 💡, 🔥, 🙏).
          - Use emojis at the start of bullet points, key headings, encouragement notes, and product highlights.
          - Format with clean markdown (bullet points, clear headers, bold accents, concise sections) for optimal readability.`
        }
      });

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      const result = await chat.sendMessageStream({
        message: latestMessage
      });

      for await (const chunk of (result as any).stream || (result as any)) {
        const chunkText = chunk.text;
        if (chunkText) {
          res.write(chunkText);
        }
      }

      res.end();
    } catch (error: any) {
      console.error('Gemini Chat Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Failed to generate response from wellness companion.' });
      } else {
        res.end();
      }
    }
  });

  // Helper to convert 24kHz 16-bit mono PCM into standard WAV
  function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(buffer, 44);

    return buffer;
  }

  // In-memory cache for generated TTS audio to prevent redundant Gemini API calls
  const ttsAudioCache = new Map<string, Buffer>();
  let ttsCooldownUntil = 0;

  // Text-To-Speech endpoint with Indian Female Voice for Reminders
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Kore' } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text string is required' });
      }

      const normalizedText = text.trim();
      const selectedVoice = voiceName === 'Aoede' ? 'Kore' : (voiceName || 'Kore');
      const cacheKey = `${selectedVoice}:${normalizedText}`;

      if (ttsAudioCache.has(cacheKey)) {
        const cachedWav = ttsAudioCache.get(cacheKey)!;
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', cachedWav.length);
        return res.send(cachedWav);
      }

      if (!apiKey) {
        return res.status(200).json({ fallback: true, reason: 'api_key_not_configured' });
      }

      if (Date.now() < ttsCooldownUntil) {
        return res.status(200).json({ fallback: true, reason: 'rate_limit_cooldown' });
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ 
                text: `Speak warmly and naturally as an Indian female wellness coach in Marathi: ${normalizedText}` 
              }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioBase64) {
          let wavBuffer: any = Buffer.from(audioBase64, 'base64');
          if (wavBuffer.toString('utf8', 0, 4) !== 'RIFF') {
            wavBuffer = pcmToWav(wavBuffer as any, 24000, 1, 16);
          }
          ttsAudioCache.set(cacheKey, wavBuffer);
          if (ttsAudioCache.size > 100) {
            const oldestKey = ttsAudioCache.keys().next().value;
            if (oldestKey) ttsAudioCache.delete(oldestKey);
          }
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('Content-Length', wavBuffer.length);
          return res.send(wavBuffer);
        }
      } catch (liteErr: any) {
        ttsCooldownUntil = Date.now() + 6 * 60 * 60 * 1000;
        return res.status(200).json({ fallback: true, reason: 'rate_limit_cooldown' });
      }

      return res.status(200).json({ fallback: true, reason: 'fallback' });
    } catch (error: any) {
      return res.status(200).json({ fallback: true, reason: 'fallback' });
    }
  });

  // Serve static dist in production, or mount Vite middleware in development
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      console.log('Serving production static build from dist folder');
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path === '/live') {
          return next();
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    console.log('Mounting Vite dev middleware in development mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);

  // Setup WebSocket Server for Gemini Multimodal Live API (/live)
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('Client connected to /live WebSocket');

    if (!apiKey) {
      clientWs.send(JSON.stringify({ 
        error: 'Gemini API key is required for Live Voice. Please configure GEMINI_API_KEY in Settings > Secrets.' 
      }));
      clientWs.close();
      return;
    }

    let session: any = null;

    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are the Arogyakunj Wellness voice assistant, a very ENERGETIC, CARING and YOUTHFUL Indian female wellness coach and personal nutrition guide for a Herbalife Nutrition Club in Maharashtra, India. Do not refer to yourself or address anyone as 'Didi'.

          CONVERSATIONAL STYLE:
          - DEFAULT LANGUAGE: साधी आणि सोपी मराठी (Simple, sweet, everyday conversational Marathi) and natural Marathish.
          - SIMPLE MARATHI: Use very simple, polite, day-to-day Marathi words (e.g. "नमस्कार!", "कसे आहात?", "चला, शेक पिऊन घ्या", "भरपूर पाणी प्या", "तब्येत छान राहील", "मस्त ताजेतवाने राहा").
          - Avoid difficult, archaic, bookish, or complex Sanskritized words.
          - Speak in a HIGH-ENERGY, YOUTHFUL, and very warm, sweet Indian female voice.
          - Sound lively, caring, and full of positive energy.
          - Provide clear, brief, easy-to-understand explanations with an encouraging tone.
          
          You also easily support: English, Hindi, and Marathish if the user prefers.
          
          Your goal is to:
          - Conduct caring and energetic customer follow-ups on their health and daily routine.
          - Guide them on formula 1 shake, Afresh, balanced diet, and daily hydration in warm, simple Marathi.
          - Set & acknowledge voice reminders: If the user asks for reminders (e.g. for water, shake, afresh, lunch, workout, or a specific time like 2 minutes or 9 AM), warmly and enthusiastically confirm in simple Marathi that you have set it and will remind them!
          - Warmly encourage their healthy lifestyle.`,
        } as any,
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Forward model audio chunk
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              parts.forEach(part => {
                if (part.inlineData?.data && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
              });
            }

            // Model speech transcript
            const modelText = 
              (message.serverContent as any)?.outputTranscription?.text ||
              (message.serverContent as any)?.outputAudioTranscription?.text;
            if (modelText && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ modelTranscript: modelText }));
            }

            // User speech transcript
            const userText = 
              (message.serverContent as any)?.inputTranscription?.text ||
              (message.serverContent as any)?.inputAudioTranscription?.text;
            if (userText && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ userTranscript: userText }));
            }

            // Barge-in interruption
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            // Turn completion
            if (message.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err: any) => {
            console.error('Gemini Live session error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Gemini Live session error' }));
            }
          },
          onclose: () => {
            console.log('Gemini Live session closed');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          }
        }
      });

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ connected: true }));
      }
    } catch (err: any) {
      console.error('Failed to initialize Gemini Live session:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Failed to connect to Gemini Live service' }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (data: any) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          try {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } catch (audioErr) {
            console.error('Error forwarding realtime audio chunk:', audioErr);
          }
        } else if (parsed.text && session) {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: parsed.text }] }],
            turnComplete: true
          });
        } else if (parsed.history && session) {
          session.sendClientContent({
            turns: parsed.history,
            turnComplete: false
          });
        }
      } catch (e) {
        console.error('Error handling WebSocket client message:', e);
      }
    });

    clientWs.on('close', () => {
      console.log('Client WebSocket closed');
      if (session) {
        try {
          session.close?.();
        } catch (e) {}
      }
    });
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Arogyakunj Wellness server running on http://localhost:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
