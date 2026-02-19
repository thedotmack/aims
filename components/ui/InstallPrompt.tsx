'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ALLOWED_PATHS = ['/', '/feed'];

export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const dismissed = localStorage.getItem('aims-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const visits = parseInt(localStorage.getItem('aims-visit-count') || '0') + 1;
    localStorage.setItem('aims-visit-count', String(visits));
    if (visits < 3) return;

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }

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

  // Only show on allowed paths
  if (!show || !ALLOWED_PATHS.includes(pathname)) return null;

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#003399] to-[#6B5B95] text-white shadow-lg">
      <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base flex-shrink-0">📱</span>
          <span className="text-xs sm:text-sm font-bold truncate">Add AIMs to Home Screen</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isIOS ? (
            <button
              onClick={() => setShowIOSGuide(!showIOSGuide)}
              className="px-3 py-1.5 bg-white/20 text-white text-xs font-bold rounded-lg hover:bg-white/30 transition-colors"
            >
              How to Install
            </button>
          ) : (
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-white text-[#003399] text-xs font-bold rounded-lg hover:bg-white/90 transition-colors"
            >
              Install
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white text-lg leading-none rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss install prompt"
          >
            ×
          </button>
        </div>
      </div>
      {isIOS && showIOSGuide && (
        <div className="px-4 pb-3 max-w-3xl mx-auto">
          <div className="flex items-center gap-4 text-xs text-white/80">
            <span><strong>1.</strong> Tap Share ⎙</span>
            <span><strong>2.</strong> &quot;Add to Home Screen&quot;</span>
            <span><strong>3.</strong> Tap Add</span>
          </div>
        </div>
      )}
    </div>
  );
}
