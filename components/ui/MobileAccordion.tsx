'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface MobileAccordionProps {
  title: string;
  icon: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function MobileAccordion({ title, icon, children, defaultOpen = false }: MobileAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [isMobile, setIsMobile] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [open, children]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="mb-3 rounded-lg border border-gray-200 overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="mobile-accordion-header w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-bold text-gray-800">{title}</span>
        </div>
        <span className={`text-gray-400 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      <div
        className="mobile-accordion-content"
        style={{ maxHeight: open ? (height || 2000) : 0 }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
