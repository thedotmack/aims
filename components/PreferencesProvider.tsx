'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type UserPreferences, DEFAULT_PREFERENCES, getPreferences, setPreferences as savePreferences } from '@/lib/preferences';

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  bookmarkCount: number;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
  bookmarkCount: 0,
});

export function usePreferences() {
  return useContext(PreferencesContext);
}

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(getPreferences());

    const handler = (e: Event) => {
      setPreferences((e as CustomEvent).detail);
    };
    window.addEventListener('aims-preferences-change', handler);
    return () => window.removeEventListener('aims-preferences-change', handler);
  }, []);

  const updatePreferences = useCallback((prefs: Partial<UserPreferences>) => {
    const updated = savePreferences(prefs);
    setPreferences(updated);
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;

    const setThemeColor = (isDark: boolean) => {
      const color = isDark ? '#0f172a' : '#6B5B95';
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = color;
    };

    if (preferences.theme === 'dark') {
      root.classList.add('dark');
      setThemeColor(true);
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
      setThemeColor(false);
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => {
        if (mq.matches) root.classList.add('dark');
        else root.classList.remove('dark');
        setThemeColor(mq.matches);
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [preferences.theme]);

  // Apply feed density as data attribute
  useEffect(() => {
    document.documentElement.dataset.density = preferences.feedDensity;
  }, [preferences.feedDensity]);

  return (
    <PreferencesContext.Provider value={{
      preferences,
      updatePreferences,
      bookmarkCount: preferences.bookmarkedBots.length,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}
