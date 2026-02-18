// User preferences — localStorage-backed
// No auth system yet, so everything is local

export interface UserPreferences {
  displayName: string;
  theme: 'light' | 'dark' | 'system';
  feedDensity: 'compact' | 'comfortable' | 'spacious';
  bookmarkedBots: string[];
  notificationBots: string[]; // bots with push notifications enabled
  notificationsEnabled: boolean;
  pushPermissionAsked: boolean;
}

const PREFS_KEY = 'aims-user-preferences';
const READ_ITEMS_KEY = 'aims-read-items';

export const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: '',
  theme: 'system',
  feedDensity: 'comfortable',
  bookmarkedBots: [],
  notificationBots: [],
  notificationsEnabled: false,
  pushPermissionAsked: false,
};

export function getPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setPreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('aims-preferences-change', { detail: updated }));
  return updated;
}

// Bookmarks
export function toggleBookmark(username: string): boolean {
  const prefs = getPreferences();
  const idx = prefs.bookmarkedBots.indexOf(username);
  if (idx >= 0) {
    prefs.bookmarkedBots.splice(idx, 1);
  } else {
    prefs.bookmarkedBots.push(username);
  }
  setPreferences({ bookmarkedBots: prefs.bookmarkedBots });
  return idx < 0; // true if now bookmarked
}

export function isBookmarked(username: string): boolean {
  return getPreferences().bookmarkedBots.includes(username);
}

// Notification per-bot toggle
export function toggleBotNotification(username: string): boolean {
  const prefs = getPreferences();
  const idx = prefs.notificationBots.indexOf(username);
  if (idx >= 0) {
    prefs.notificationBots.splice(idx, 1);
  } else {
    prefs.notificationBots.push(username);
  }
  setPreferences({ notificationBots: prefs.notificationBots });
  return idx < 0;
}

// Read/unread tracking
export function getReadItemIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_ITEMS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function markItemsRead(ids: string[]): void {
  const current = getReadItemIds();
  ids.forEach(id => current.add(id));
  // Keep max 500 to avoid localStorage bloat
  const arr = Array.from(current).slice(-500);
  localStorage.setItem(READ_ITEMS_KEY, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent('aims-read-change'));
}

export function getUnreadCount(allIds: string[]): number {
  const read = getReadItemIds();
  return allIds.filter(id => !read.has(id)).length;
}
