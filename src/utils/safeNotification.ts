// Polyfill and safeguard for window.Notification to prevent:
// "TypeError: Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead."
// This occurs in mobile Chrome / Android WebViews where `new Notification()` is disabled by the browser engine.

if (typeof window !== 'undefined') {
  // 1. Clean up any stale web LocalNotification storage that could cause background re-triggering
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('local-notification') || key.includes('LocalNotification') || key.includes('notification_pending'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}

  // 2. Wrap window.Notification if present
  if ('Notification' in window) {
    try {
      const OriginalNotification = window.Notification;

      // Safe replacement constructor
      const SafeNotification = function (this: any, title: string, options?: NotificationOptions) {
        let instance: any = null;
        let constructedSuccessfully = false;

        try {
          // Attempt standard constructor if browser allows it (desktop Chrome, Firefox, Safari)
          instance = new (OriginalNotification as any)(title, options);
          constructedSuccessfully = true;
        } catch {
          // Fallback when browser disallows direct constructor (Android Chrome / WebView)
          try {
            if (
              'serviceWorker' in navigator &&
              navigator.serviceWorker &&
              typeof navigator.serviceWorker.getRegistration === 'function' &&
              OriginalNotification.permission === 'granted'
            ) {
              navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg && reg.showNotification) {
                  reg.showNotification(title, options).catch(() => {});
                }
              }).catch(() => {});
            }
          } catch {}
        }

        if (constructedSuccessfully && instance) {
          return instance;
        }

        // Return a mock Notification object that fulfills the Notification interface
        const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
        const mockNotification = {
          title,
          body: options?.body || '',
          tag: options?.tag || '',
          icon: options?.icon || '',
          data: options?.data || null,
          onclick: null as any,
          onshow: null as any,
          onerror: null as any,
          onclose: null as any,
          close: () => {},
          addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
            listeners[type] = listeners[type] || [];
            listeners[type].push(listener);
          },
          removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
            if (listeners[type]) {
              listeners[type] = listeners[type].filter((l) => l !== listener);
            }
          },
          dispatchEvent: () => false
        };

        return mockNotification;
      };

      // Copy static properties & prototype chain
      SafeNotification.prototype = OriginalNotification.prototype;
      Object.setPrototypeOf(SafeNotification, OriginalNotification);

      Object.defineProperty(SafeNotification, 'permission', {
        get() {
          try {
            return OriginalNotification.permission;
          } catch {
            return 'default';
          }
        },
        configurable: true
      });

      if (typeof OriginalNotification.requestPermission === 'function') {
        (SafeNotification as any).requestPermission = function (...args: any[]) {
          return OriginalNotification.requestPermission.apply(OriginalNotification, args as any);
        };
      }

      (window as any).Notification = SafeNotification;
    } catch (err) {
      console.warn('Notification polyfill setup:', err);
    }
  }

  // 3. Global safety handler to catch any stray unhandled Notification constructor errors
  window.addEventListener('error', (event) => {
    if (event && event.message && event.message.includes('Notification') && event.message.includes('Illegal constructor')) {
      event.preventDefault();
      event.stopPropagation();
      console.warn('Safely handled Notification constructor restriction.');
      return true;
    }
  }, true);
}

export {};
