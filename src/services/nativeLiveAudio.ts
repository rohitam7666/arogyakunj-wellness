import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeLiveAudioPluginInterface {
  isAvailable(): Promise<{ available: boolean; hardwareAecSupported: boolean }>;
  startCapture(): Promise<void>;
  stopCapture(): Promise<void>;
  playAudioChunk(options: { data: string }): Promise<void>;
  speakTextNative(options: { text: string }): Promise<void>;
  stopTextNative(): Promise<void>;
  interruptPlayback(): Promise<void>;
  stopPlayback(): Promise<void>;
  addListener(
    eventName: 'nativeAudioChunk',
    listenerFunc: (info: { data: string; volume: number }) => void
  ): Promise<any>;
  removeAllListeners(): Promise<void>;
}

// Register the custom Capacitor native plugin
const NativeLiveAudio = registerPlugin<NativeLiveAudioPluginInterface>('NativeLiveAudio');

class NativeLiveAudioBridge {
  private isAvailableOnDevice: boolean | null = null;
  private chunkListenerHandle: any = null;

  /**
   * Check if running on Android Native and NativeLiveAudio is accessible
   */
  async checkAvailability(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      this.isAvailableOnDevice = false;
      return false;
    }

    if (this.isAvailableOnDevice !== null) {
      return this.isAvailableOnDevice;
    }

    try {
      const res = await NativeLiveAudio.isAvailable();
      this.isAvailableOnDevice = !!res?.available;
      return this.isAvailableOnDevice;
    } catch (err) {
      console.warn('NativeLiveAudio not available on this platform:', err);
      this.isAvailableOnDevice = false;
      return false;
    }
  }

  /**
   * Speak text out loud using Android Native Java TextToSpeech
   */
  async speakTextNative(text: string): Promise<boolean> {
    const available = await this.checkAvailability();
    if (!available) return false;
    try {
      await NativeLiveAudio.speakTextNative({ text });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Stop native Java TextToSpeech
   */
  async stopTextNative(): Promise<void> {
    if (this.isAvailableOnDevice) {
      try {
        await NativeLiveAudio.stopTextNative();
      } catch (e) {}
    }
  }

  /**
   * Start 16kHz hardware capture on Android
   */
  async startCapture(onChunk: (base64Audio: string, volume: number) => void): Promise<boolean> {
    const available = await this.checkAvailability();
    if (!available) return false;

    try {
      if (this.chunkListenerHandle) {
        await this.chunkListenerHandle.remove();
        this.chunkListenerHandle = null;
      }

      this.chunkListenerHandle = await NativeLiveAudio.addListener('nativeAudioChunk', (event) => {
        if (event && event.data) {
          onChunk(event.data, event.volume ?? 0);
        }
      });

      await NativeLiveAudio.startCapture();
      return true;
    } catch (err) {
      console.error('Failed to start native audio capture:', err);
      return false;
    }
  }

  /**
   * Stop 16kHz hardware capture
   */
  async stopCapture(): Promise<void> {
    if (this.chunkListenerHandle) {
      try {
        await this.chunkListenerHandle.remove();
      } catch (e) {}
      this.chunkListenerHandle = null;
    }

    if (this.isAvailableOnDevice) {
      try {
        await NativeLiveAudio.stopCapture();
      } catch (e) {}
    }
  }

  /**
   * Stream 24kHz raw PCM chunk into hardware AudioTrack
   */
  async playChunk(base64Data: string): Promise<boolean> {
    if (!this.isAvailableOnDevice) return false;
    try {
      await NativeLiveAudio.playAudioChunk({ data: base64Data });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Instant hardware barge-in interruption (flushes ring buffer)
   */
  async interruptPlayback(): Promise<void> {
    if (!this.isAvailableOnDevice) return;
    try {
      await NativeLiveAudio.interruptPlayback();
    } catch (e) {}
  }

  /**
   * Stop playback completely
   */
  async stopPlayback(): Promise<void> {
    if (!this.isAvailableOnDevice) return;
    try {
      await NativeLiveAudio.stopPlayback();
    } catch (e) {}
  }
}

export const nativeLiveAudio = new NativeLiveAudioBridge();
