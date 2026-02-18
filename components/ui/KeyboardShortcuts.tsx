'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUTS = [
  { keys: ['/', '⌘K'], desc: 'Focus search' },
  { keys: ['g', 'f'], desc: 'Go to Feed' },
  { keys: ['g', 'b'], desc: 'Go to Bots' },
  { keys: ['g', 'h'], desc: 'Go to Home' },
  { keys: ['g', 'd'], desc: 'Go to DMs' },
  { keys: ['g', 'a'], desc: 'Go to About' },
  { keys: ['j'], desc: 'Next feed item' },
  { keys: ['k'], desc: 'Previous feed item' },
  { keys: ['?'], desc: 'Show this help' },
  { keys: ['Esc'], desc: 'Close modal' },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{
            background: 'linear-gradient(180deg, #003399 0%, #002266 100%)',
          }}
        >
          <span className="text-white text-sm font-bold">⌨️ Keyboard Shortcuts</span>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg font-bold">✕</button>
        </div>

        <div className="p-4 space-y-1.5">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  <span key={ki}>
                    {ki > 0 && <span className="text-gray-300 text-xs mx-0.5">then</span>}
                    <kbd className="inline-block px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-700 shadow-sm">
                      {k}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 bg-gray-50 text-center text-[10px] text-gray-400 border-t">
          Press <kbd className="px-1 bg-gray-200 rounded text-[9px]">?</kbd> anytime to see this
        </div>
      </div>
    </div>
  );
}

export default function KeyboardShortcuts() {
  const [showModal, setShowModal] = useState(false);
  const [pendingG, setPendingG] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger in inputs/textareas
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    const key = e.key;

    // Escape closes modal
    if (key === 'Escape') {
      setShowModal(false);
      setPendingG(false);
      return;
    }

    // ? shows shortcuts
    if (key === '?') {
      e.preventDefault();
      setShowModal(true);
      return;
    }

    // / focuses search
    if (key === '/') {
      e.preventDefault();
      router.push('/search');
      return;
    }

    // g + second key combos
    if (pendingG) {
      setPendingG(false);
      switch (key) {
        case 'f': e.preventDefault(); router.push('/feed'); return;
        case 'b': e.preventDefault(); router.push('/bots'); return;
        case 'h': e.preventDefault(); router.push('/'); return;
        case 'd': e.preventDefault(); router.push('/dms'); return;
        case 'a': e.preventDefault(); router.push('/about'); return;
      }
      return;
    }

    if (key === 'g') {
      setPendingG(true);
      setTimeout(() => setPendingG(false), 1000);
      return;
    }

    // j/k for feed navigation
    if (key === 'j' || key === 'k') {
      const items = document.querySelectorAll('.feed-item-enter');
      if (items.length === 0) return;
      const current = document.querySelector('.feed-item-active');
      let idx = current ? Array.from(items).indexOf(current) : -1;
      if (key === 'j') idx = Math.min(idx + 1, items.length - 1);
      else idx = Math.max(idx - 1, 0);
      
      items.forEach(el => el.classList.remove('feed-item-active'));
      items[idx]?.classList.add('feed-item-active');
      items[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [pendingG, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <ShortcutsModal open={showModal} onClose={() => setShowModal(false)} />
      {pendingG && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg animate-pulse">
          g → waiting for second key...
        </div>
      )}
    </>
  );
}
