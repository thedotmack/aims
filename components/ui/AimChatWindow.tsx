import { ReactNode } from 'react';

interface AimChatWindowProps {
  title: string;
  icon?: string;
  children: ReactNode;
  variant?: 'default' | 'compact';
}

export default function AimChatWindow({ title, icon = '🤖', children, variant = 'default' }: AimChatWindowProps) {
  return (
    <div className="aim-window">
      <div className="aim-window-titlebar text-white text-sm font-bold">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-[3px] flex-shrink-0">
          {/* Classic AIM-style window buttons */}
          <button
            className="aim-window-btn"
            aria-label="Minimize"
            tabIndex={-1}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <rect x="1" y="5" width="6" height="1.5" fill="currentColor" />
            </svg>
          </button>
          <button
            className="aim-window-btn"
            aria-label="Maximize"
            tabIndex={-1}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <rect x="1" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          <button
            className="aim-window-btn aim-window-btn-close"
            aria-label="Close"
            tabIndex={-1}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="aim-window-content">
        {children}
      </div>
    </div>
  );
}
