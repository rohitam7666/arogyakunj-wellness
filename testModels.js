import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || 'dummy-key';
const ai = new GoogleGenAI({ apiKey });

async function check() {
  try {
    const chat = ai.chats.create({
      model: 'gemini-1.5-flash',
      config: { systemInstruction: 'Say hi' }
    });
    const res = await chat.sendMessage({ message: 'Hi' });
    console.log('gemini-1.5-flash success:', res.text);
  } catch (e) {
    console.error('gemini-1.5-flash error:', e?.message || e);
  }

  try {
    const chat2 = ai.chats.create({
      model: 'gemini-2.0-flash-exp',
      config: { systemInstruction: 'Say hi' }
    });
    const res2 = await chat2.sendMessage({ message: 'Hi' });
    console.log('gemini-2.0-flash-exp success:', res2.text);
  } catch (e) {
    console.error('gemini-2.0-flash-exp error:', e?.message || e);
  }
}

check();
