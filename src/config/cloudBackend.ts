import { Capacitor } from '@capacitor/core';

// Render server endpoint hosting the Gemini Multimodal Live proxy & API
export const CLOUD_BACKEND_HOST = 'arogyakunj-wellness.onrender.com';

/**
 * Checks if the app is running inside a Native Android/iOS APK container
 */
export function isNativeOrLocalApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  const protocol = window.location.protocol;
  return protocol === 'capacitor:' || protocol === 'file:';
}

/**
 * Resolves the backend HTTP API URL (works in browser & native APK)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2') {
      return `${window.location.protocol}//${host}:3000`;
    }
    if (!isNativeOrLocalApp() && window.location.host) {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return `https://${CLOUD_BACKEND_HOST}`;
}

/**
 * Resolves the Gemini Live duplex WebSocket URL (works in browser & native APK)
 */
export function getLiveWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${host}:3000/live`;
    }
    if (!isNativeOrLocalApp() && window.location.host) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/live`;
    }
  }
  return `wss://${CLOUD_BACKEND_HOST}/live`;
}
