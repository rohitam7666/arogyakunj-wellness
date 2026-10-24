export interface LiveWebSocketCallbacks {
  onConnected: () => void;
  onAudioChunk: (base64Audio: string) => void;
  onModelTranscript: (text: string) => void;
  onUserTranscript: (text: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onError: (error: any) => void;
  onClose: (event: CloseEvent) => void;
}

import { getLiveWebSocketUrl } from '../config/cloudBackend';

export class GeminiLiveWebSocketClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private callbacks: LiveWebSocketCallbacks;

  constructor(callbacks: LiveWebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(): boolean {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return true;
    }

    const url = getLiveWebSocketUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Connected to server proxy
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.connected) {
            this.isConnected = true;
            this.callbacks.onConnected();
            return;
          }

          if (msg.audio) {
            this.callbacks.onAudioChunk(msg.audio);
          }
          if (msg.modelTranscript) {
            this.callbacks.onModelTranscript(msg.modelTranscript);
          }
          if (msg.userTranscript) {
            this.callbacks.onUserTranscript(msg.userTranscript);
          }
          if (msg.interrupted) {
            this.callbacks.onInterrupted();
          }
          if (msg.turnComplete) {
            this.callbacks.onTurnComplete();
          }
          if (msg.error) {
            this.callbacks.onError(new Error(msg.error));
          }
        } catch (err) {
          console.warn('Error parsing Live WebSocket frame:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Live WebSocket error:', err);
        this.callbacks.onError(err);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.isConnected = false;
        this.callbacks.onClose(event);
      };

      return true;
    } catch (err) {
      this.callbacks.onError(err);
      return false;
    }
  }

  public sendAudioChunk(base64PCM: string): boolean {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ audio: base64PCM }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public sendText(prompt: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ text: prompt }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public sendHistory(history: { role: string; parts: { text: string }[] }[]): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ history }));
      return true;
    } catch (e) {
      return false;
    }
  }

  public close(): void {
    this.isConnected = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }

  public isReady(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
