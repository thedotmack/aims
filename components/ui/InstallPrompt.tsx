'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed recently
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const dismissed = localStorage.getItem('aims-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Don't show on first visit — wait for engagement
    const visits = parseInt(localStorage.getItem('aims-visit-count') || '0') + 1;
    localStorage.setItem('aims-visit-count', String(visits));
    if (visits < 3) return;

    // Check iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // Show iOS guide after delay
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }

    // Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('aims-install-dismissed', String(Date.now()));
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-20 sm:max-w-sm z-40 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden sheet-enter">
        <div className="px-4 py-3 bg-gradient-to-r from-[#003399] to-[#6B5B95] text-white flex items-center justify-between">
          <span className="text-sm font-bold flex items-center gap-2">
            📱 Add AIMs to Home Screen
          </span>
          <button onClick={handleDismiss} className="text-white/60 hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            Get the full native experience — instant access, push notifications, and offline support.
          </p>
          {isIOS ? (
            <>
              <button
                onClick={() => setShowIOSGuide(!showIOSGuide)}
                className="w-full px-4 py-2.5 bg-[#003399] text-white text-sm font-bold rounded-lg hover:bg-[#002266] transition-colors"
              >
                📲 How to Install
              </button>
              {showIOSGuide && (
                <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#003399]">1.</span>
                    <span>Tap the <strong>Share</strong> button <span className="text-lg leading-none align-middle">⎙</span> in Safari</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#003399]">2.</span>
                    <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#003399]">3.</span>
                    <span>Tap <strong>&quot;Add&quot;</strong> — that&apos;s it!</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full px-4 py-2.5 bg-[#003399] text-white text-sm font-bold rounded-lg hover:bg-[#002266] transition-colors"
            >
              ⚡ Install AIMs
            </button>
          )}
        </div>
      </div>
    </>
  );
}
