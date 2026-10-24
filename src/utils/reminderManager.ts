import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface VoiceReminder {
  id: string;
  title: string;
  time: string; // "HH:MM" 24h format or display time
  spokenMarathi: string;
  spokenEnglish: string;
  category: 'water' | 'shake' | 'afresh' | 'meal' | 'sleep' | 'workout' | 'custom';
  enabled: boolean;
  isRecurringDaily: boolean;
  exactTimestamp?: number; // Epoch timestamp in ms for one-shot relative reminders
}

export const DEFAULT_ROUTINE_REMINDERS: VoiceReminder[] = [
  {
    id: 'routine-morning-water',
    title: 'सकाळची सुरुवात - कोमट पाणी',
    time: '07:00',
    spokenMarathi: 'सुप्रभात! 🌅 दिवसाची सुरुवात १ ते २ ग्लास कोमट पाण्याने करा. यामुळे पचनक्रिया सुधारते आणि शरीर ताजेतवाने राहते. 💧🌿',
    spokenEnglish: 'Good morning! Start your day with 1-2 glasses of warm water for great digestion and vitality. 💧🌿',
    category: 'water',
    enabled: true,
    isRecurringDaily: true
  },
  {
    id: 'routine-breakfast-shake',
    title: 'नाश्ता - फॉर्म्युला १ पोषण शेक',
    time: '08:30',
    spokenMarathi: 'नमस्कार! 🥤 आता तुमचा पौष्टिक फॉर्म्युला १ शेक घेण्याची वेळ झाली आहे. शरीराला पूर्ण पोषण द्या आणि ऊर्जा मिळवा! ✨💪',
    spokenEnglish: 'Hello! Time for your delicious Formula 1 nutritional shake breakfast. Energize your morning! ✨💪',
    category: 'shake',
    enabled: true,
    isRecurringDaily: true
  },
  {
    id: 'routine-midday-hydration',
    title: 'हायड्रेशन आणि फळे',
    time: '11:30',
    spokenMarathi: 'वेळ झाली आहे हायड्रेशनची! 💧 एक मोठा ग्लास पाणी प्या आणि हवे असल्यास एक सफरचंद किंवा हलके फळ खा. 🍎✨',
    spokenEnglish: 'Hydration check! Drink a fresh glass of water and enjoy a healthy fruit or light snack. 🍎✨',
    category: 'water',
    enabled: true,
    isRecurringDaily: true
  },
  {
    id: 'routine-healthy-lunch',
    title: 'संतुलित दुपारचे जेवण',
    time: '01:30',
    spokenMarathi: 'दुपारच्या जेवणाची वेळ झाली आहे! 🥗 ताटात भरपूर सॅलड, डाळ, हिरव्या भाज्या आणि कमी तेल-तूप ठेवा. आनंदाने जेवा! 🌿',
    spokenEnglish: 'Lunchtime! Enjoy a balanced plate with colorful salad, lentils, vegetables, and good protein. 🥗🌿',
    category: 'meal',
    enabled: true,
    isRecurringDaily: true
  },
  {
    id: 'routine-evening-afresh',
    title: 'संध्याकाळचा अफ्रेश एनर्जी ड्रिंक',
    time: '05:00',
    spokenMarathi: 'थकवा दूर करण्यासाठी गरम किंवा गार अफ्रेश एनर्जी ड्रिंक पिण्याची वेळ झाली आहे! 🍵⚡ मस्त ऊर्जावान वाटा!',
    spokenEnglish: 'Time for your refreshing Afresh energy drink to power through the evening! 🍵⚡',
    category: 'afresh',
    enabled: true,
    isRecurringDaily: true
  },
  {
    id: 'routine-light-dinner',
    title: 'हलके रात्रीचे जेवण / शेक',
    time: '08:30',
    spokenMarathi: 'रात्रीचे जेवण हलके आणि पचनास सोपे ठेवा किंवा तुमचा शेक घ्या. जेवणानंतर १० मिनिटे संथ चाला! 🍲🚶‍♀️',
    spokenEnglish: 'Time for a light dinner or evening shake. Remember to take a gentle 10-minute walk after! 🍲🚶‍♀️',
    category: 'meal',
    enabled: true,
    isRecurringDaily: true
  },
  {
    id: 'routine-rest-sleep',
    title: 'शांत झोप आणि विश्रांती',
    time: '10:30',
    spokenMarathi: 'शुभ रात्री! 🌙 फोन बाजूला ठेवा आणि शांत झोपेची तयारी करा. उद्याचा दिवस निरोगी आणि उत्साही असेल! 🙏✨',
    spokenEnglish: 'Good night! Time to relax, unplug from screens, and get deep restorative sleep. 🙏✨',
    category: 'sleep',
    enabled: true,
    isRecurringDaily: true
  }
];

class ReminderManager {
  private reminders: VoiceReminder[] = [];
  private checkInterval: any = null;
  private audioCtx: AudioContext | null = null;
  private isSpeaking = false;

  constructor() {
    this.loadReminders();
    this.initNotifications();
    this.startClockEngine();
  }

  private loadReminders() {
    try {
      const saved = localStorage.getItem('arogyakunj_voice_reminders');
      if (saved) {
        this.reminders = JSON.parse(saved);
      } else {
        this.reminders = [...DEFAULT_ROUTINE_REMINDERS];
        this.saveReminders();
      }
    } catch {
      this.reminders = [...DEFAULT_ROUTINE_REMINDERS];
    }
  }

  public saveReminders() {
    try {
      localStorage.setItem('arogyakunj_voice_reminders', JSON.stringify(this.reminders));
    } catch (e) {
      console.warn('Could not save reminders to localStorage', e);
    }
  }

  public getReminders(): VoiceReminder[] {
    return [...this.reminders];
  }

  public addReminder(reminder: Omit<VoiceReminder, 'id'>): VoiceReminder {
    const newReminder: VoiceReminder = {
      ...reminder,
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
    };
    this.reminders.push(newReminder);
    this.saveReminders();
    this.scheduleNativeNotification(newReminder);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('arogyakunj-reminder-created', {
          detail: newReminder
        })
      );
    }

    return newReminder;
  }

  public toggleReminder(id: string, enabled?: boolean): boolean {
    const rem = this.reminders.find(r => r.id === id);
    if (!rem) return false;
    rem.enabled = enabled !== undefined ? enabled : !rem.enabled;
    this.saveReminders();
    if (rem.enabled) {
      this.scheduleNativeNotification(rem);
    } else {
      this.cancelNativeNotification(rem.id);
    }
    return rem.enabled;
  }

  public deleteReminder(id: string) {
    this.reminders = this.reminders.filter(r => r.id !== id);
    this.saveReminders();
    this.cancelNativeNotification(id);
  }

  private async initNotifications() {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission().catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Notification init error:', e);
    }
  }

  private async scheduleNativeNotification(rem: VoiceReminder) {
    if (!rem.enabled) return;
    try {
      // Only schedule local notifications on native mobile platforms (Android APK / iOS)
      if (Capacitor.isNativePlatform()) {
        let scheduleDate: Date;
        if (rem.exactTimestamp) {
          scheduleDate = new Date(rem.exactTimestamp);
        } else {
          const [hours, minutes] = rem.time.split(':').map(Number);
          scheduleDate = new Date();
          scheduleDate.setHours(hours, minutes, 0, 0);
          if (scheduleDate.getTime() <= Date.now()) {
            scheduleDate.setDate(scheduleDate.getDate() + 1);
          }
        }

        // Generate numeric 32-bit ID from string
        const notifId = Math.abs(rem.id.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) % 2147483647;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: '🌿 Arogyakunj Coach: ' + rem.title,
              body: rem.spokenMarathi,
              schedule: { at: scheduleDate, allowWhileIdle: true },
              sound: 'beep.wav',
              extra: { reminderId: rem.id }
            }
          ]
        });
      }
    } catch (e) {
      console.warn('Native notification scheduling skipped or unavailable:', e);
    }
  }

  private async cancelNativeNotification(id: string) {
    try {
      if (Capacitor.isNativePlatform()) {
        const notifId = Math.abs(id.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) % 2147483647;
        await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
      }
    } catch {}
  }

  private startClockEngine() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    let lastCheckedMinute = '';

    this.checkInterval = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const nowMs = now.getTime();

      // Check one-shot exactTimestamp reminders
      for (const rem of this.reminders) {
        if (!rem.enabled) continue;

        if (rem.exactTimestamp && rem.exactTimestamp <= nowMs && rem.exactTimestamp > nowMs - 60000) {
          // Trigger one-shot reminder
          rem.enabled = false; // completed
          this.saveReminders();
          this.triggerReminder(rem);
          continue;
        }

        // Check daily recurring time reminders
        if (currentTimeStr !== lastCheckedMinute && rem.time === currentTimeStr && !rem.exactTimestamp) {
          this.triggerReminder(rem);
        }
      }

      lastCheckedMinute = currentTimeStr;
    }, 2000);
  }

  // Play pleasant wellness chime
  public playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.35); // G5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(261.63, now); // C4

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.85);
      osc2.stop(now + 0.85);
    } catch (e) {
      console.warn('Chime audio error:', e);
    }
  }

  // Speak reminder aloud using natural voice
  public speakReminder(reminder: VoiceReminder) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    this.playChime();

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const textToSpeak = reminder.spokenMarathi || reminder.spokenEnglish || reminder.title;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);

        // Find best Indian/Marathi/Hindi voice if available
        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v => 
          v.lang === 'mr-IN' || 
          v.lang === 'hi-IN' || 
          v.name.includes('India') || 
          v.name.includes('Kiran') || 
          v.name.includes('Heera') ||
          v.name.includes('Swara')
        );

        if (indianVoice) {
          utterance.voice = indianVoice;
          utterance.lang = indianVoice.lang;
        } else {
          utterance.lang = 'hi-IN';
        }

        utterance.rate = 0.95; // Gentle, clear, caring pace
        utterance.pitch = 1.05; // Friendly feminine coach pitch

        utterance.onstart = () => { this.isSpeaking = true; };
        utterance.onend = () => { this.isSpeaking = false; };
        utterance.onerror = () => { this.isSpeaking = false; };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    }, 450);
  }

  // Trigger reminder event and voice speech
  public triggerReminder(rem: VoiceReminder) {
    this.speakReminder(rem);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('arogyakunj-reminder-fired', {
          detail: rem
        })
      );
    }
  }

  // Quick 10-second test
  public testVoiceReminderNow(customTitle = 'पाणी पिण्याची आठवण (Test)') {
    const testRem: VoiceReminder = {
      id: 'test_' + Date.now(),
      title: customTitle,
      time: 'आत्ताच',
      spokenMarathi: 'नमस्कार! ही तुमच्या आरोग्यकुंज AI व्हॉईस कंपॅनियनची टेस्ट आठवण आहे. तुमचे रिमाइंडर अचूक काम करत आहेत! 💧🌿',
      spokenEnglish: 'Hello! This is a test reminder from your Arogyakunj AI Voice Companion. Everything works smoothly! 💧🌿',
      category: 'water',
      enabled: true,
      isRecurringDaily: false
    };
    this.triggerReminder(testRem);
    return testRem;
  }

  // Screen Wake Lock helper for web browsers
  private wakeLockSentinel: any = null;

  public async requestScreenWakeLock(): Promise<boolean> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        return true;
      }
    } catch (e) {
      console.warn('Wake Lock error:', e);
    }
    return false;
  }

  public releaseScreenWakeLock() {
    try {
      if (this.wakeLockSentinel) {
        this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      }
    } catch {}
  }

  // Natural Language / Voice parse helper
  public parseAndCreateFromSpeech(prompt: string): { success: boolean; reminder?: VoiceReminder; message: string } {
    let text = prompt.toLowerCase();

    // 1. Normalize Devanagari numerals to ASCII (०-९ -> 0-9)
    const devanagariDigits = ['०','१','२','३','४','५','६','७','८','९'];
    devanagariDigits.forEach((digit, idx) => {
      text = text.replaceAll(digit, idx.toString());
    });

    // 2. Normalize Marathi & English word numbers
    text = text
      .replace(/\b(एक|one)\b/g, '1')
      .replace(/\b(दोन|two)\b/g, '2')
      .replace(/\b(तीन|three)\b/g, '3')
      .replace(/\b(चार|four)\b/g, '4')
      .replace(/\b(पाच|five)\b/g, '5')
      .replace(/\b(दहा|ten)\b/g, '10')
      .replace(/\b(पंधरा|fifteen)\b/g, '15')
      .replace(/\b(वीस|twenty)\b/g, '20')
      .replace(/\b(अर्धा तास|half an hour)\b/g, '30 minute');

    // 3. Check for reminder intent across Marathi, Marathish, Hindi, and English
    const isReminderIntent = 
      text.includes('reminder') || 
      text.includes('remind') || 
      text.includes('आठवण') || 
      text.includes('रिमाइंडर') ||
      text.includes('अलार्म') ||
      text.includes('सांग') ||
      text.includes('सांगा') ||
      text.includes('अलर्ट') ||
      text.includes('alarm') ||
      text.includes('aathvan') ||
      text.includes('sang') ||
      text.includes('minute') ||
      text.includes('मिनिट') ||
      text.includes('सेकंद') ||
      text.includes('second');

    if (!isReminderIntent) {
      return { success: false, message: 'No reminder intent found' };
    }

    // 4. Minutes / Seconds parsing e.g. "2 मिनिटांनी", "in 2 minutes", "10 seconds", "५ मिनिट"
    let secondsOffset = 0;
    const secMatch = text.match(/(\d+)\s*(?:second|सेकंद|सेकंड|sec)/i);
    const minMatch = text.match(/(\d+)\s*(?:minute|मिनिट|मिनियम|min|m)/i);
    const hourMatch = text.match(/(\d+)\s*(?:hour|तास|घंटा|hr|h)/i);

    if (secMatch) {
      secondsOffset = parseInt(secMatch[1], 10);
    } else if (minMatch) {
      secondsOffset = parseInt(minMatch[1], 10) * 60;
    } else if (hourMatch) {
      secondsOffset = parseInt(hourMatch[1], 10) * 3600;
    }

    // 5. Category detection
    let category: VoiceReminder['category'] = 'custom';
    let title = 'आरोग्यकुंज वेलनेस आठवण';
    let spokenMarathi = 'नमस्कार! तुमच्या वेलनेस रूटीनची वेळ झाली आहे. 🌿✨';

    if (text.includes('पाणी') || text.includes('water') || text.includes('हायड्रेशन') || text.includes('pani')) {
      category = 'water';
      title = 'पाणी पिण्याची वेळ 💧';
      spokenMarathi = 'नमस्कार! एक मोठा ग्लास ताजे पाणी पिण्याची वेळ झाली आहे. स्वतःला हायड्रेटेड आणि उत्साही ठेवा! 💧🌿';
    } else if (text.includes('शेक') || text.includes('shake') || text.includes('नाश्ता') || text.includes('formula')) {
      category = 'shake';
      title = 'फॉर्म्युला १ पोषण शेक 🥤';
      spokenMarathi = 'नमस्कार! तुमचा पौष्टिक फॉर्म्युला १ शेक घेण्याची वेळ झाली आहे. निरोगी पोषण घ्या! 🥤✨';
    } else if (text.includes('अफ्रेश') || text.includes('afresh') || text.includes('energy') || text.includes('चहा') || text.includes('tea')) {
      category = 'afresh';
      title = 'अफ्रेश एनर्जी ड्रिंक 🍵';
      spokenMarathi = 'नमस्कार! ताजेतवाने वाटण्यासाठी एक मस्त कप अफ्रेश एनर्जी ड्रिंक घ्या! 🍵⚡';
    } else if (text.includes('जेवण') || text.includes('lunch') || text.includes('dinner') || text.includes('खा') || text.includes('food')) {
      category = 'meal';
      title = 'संतुलित जेवणाची वेळ 🥗';
      spokenMarathi = 'नमस्कार! तुमचे सकस आणि संतुलित जेवण घेण्याची वेळ झाली आहे! 🥗💚';
    } else if (text.includes('व्यायाम') || text.includes('workout') || text.includes('walk') || text.includes('चाला') || text.includes('exercise')) {
      category = 'workout';
      title = 'व्यायाम आणि वॉकची वेळ 🏃‍♀️';
      spokenMarathi = 'नमस्कार! चला थोडा व्यायाम करूया किंवा चालून येऊया. आरोग्य हीच खरी संपत्ती! 💪🏃‍♀️';
    }

    if (secondsOffset > 0) {
      const targetTime = new Date(Date.now() + secondsOffset * 1000);
      const timeStr = `${String(targetTime.getHours()).padStart(2, '0')}:${String(targetTime.getMinutes()).padStart(2, '0')}`;
      
      const newRem = this.addReminder({
        title,
        time: timeStr,
        spokenMarathi,
        spokenEnglish: title + ' - Remember your wellness routine!',
        category,
        enabled: true,
        isRecurringDaily: false,
        exactTimestamp: targetTime.getTime()
      });

      const displayDuration = secondsOffset >= 60 ? `${Math.round(secondsOffset / 60)} मिनिटांनी` : `${secondsOffset} सेकंदांनी`;
      return {
        success: true,
        reminder: newRem,
        message: `हो नक्कीच! मी बरोबर ${displayDuration} (${timeStr} वाजता) तुम्हाला आवाज देऊन आठवण करून देईन. ⏰🌿`
      };
    }

    // Default 1 minute if asked to remind without specifying duration
    const targetTime = new Date(Date.now() + 60 * 1000);
    const timeStr = `${String(targetTime.getHours()).padStart(2, '0')}:${String(targetTime.getMinutes()).padStart(2, '0')}`;
    const newRem = this.addReminder({
      title,
      time: timeStr,
      spokenMarathi,
      spokenEnglish: title + ' - Remember your wellness routine!',
      category,
      enabled: true,
      isRecurringDaily: false,
      exactTimestamp: targetTime.getTime()
    });

    return {
      success: true,
      reminder: newRem,
      message: `हो नक्कीच! मी १ मिनिटात (${timeStr} वाजता) तुम्हाला आवाज देऊन आठवण करून देईन! ⏰✨`
    };
  }
}

export const reminderManager = new ReminderManager();
