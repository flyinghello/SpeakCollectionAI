import { PracticeEntry, ReviewAction } from "../types";

const STORAGE_KEY = "speaksmart_entries";
const SETTINGS_KEY = "speaksmart_settings";
const LISTENERS = new Set<() => void>();

const notifyListeners = () => {
  LISTENERS.forEach(listener => listener());
};

export const subscribeToEntries = (listener: () => void) => {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
};

export const getEntries = (): PracticeEntry[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveEntry = (entry: PracticeEntry) => {
  const entries = getEntries();
  const updatedEntries = [entry, ...entries];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));
  notifyListeners();
};

export const updateEntry = (updatedEntry: PracticeEntry) => {
  const entries = getEntries();
  const index = entries.findIndex((e) => e.id === updatedEntry.id);
  if (index !== -1) {
    entries[index] = updatedEntry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    notifyListeners();
  }
};

export const deleteEntry = (id: string) => {
  const entries = getEntries();
  const filtered = entries.filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifyListeners();
};

export const importEntries = (newEntries: PracticeEntry[]): number => {
  try {
    const currentEntries = getEntries();
    // Use a Map to merge entries based on ID (New entries overwrite old ones if ID exists)
    const entryMap = new Map<string, PracticeEntry>();
    
    // Load current
    currentEntries.forEach(e => entryMap.set(e.id, e));
    
    // Merge new
    let addedCount = 0;
    newEntries.forEach(e => {
        // Basic validation
        if (e.id && e.originalText && e.analysis) {
            entryMap.set(e.id, e);
            addedCount++;
        }
    });

    const merged = Array.from(entryMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    notifyListeners();
    return addedCount;
  } catch (error) {
    console.error("Import failed", error);
    throw new Error("Failed to process import data");
  }
};

// Settings
export interface AppSettings {
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
  asrBaseUrl?: string;
  asrModel?: string;
}

export const getSettings = (): AppSettings => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : {};
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // Could notify, but usually settings update is local
};

export const getReviewQueue = (includeTodayFallback: boolean = false): PracticeEntry[] => {
  const entries = getEntries();
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);

  // 1. Get items that are actually due
  let queue = entries.filter((e) => e.reviewStats.nextReviewTime <= now);

  // 2. If requesting fallback (Check Again) and no items are due,
  //    load items created today to review them again/cram.
  if (includeTodayFallback && queue.length === 0) {
      queue = entries.filter(e => e.timestamp >= todayStart);
  }

  // Sort: Today's items first, then by nextReviewTime (overdue first)
  return queue.sort((a, b) => {
    const aIsToday = a.timestamp >= todayStart;
    const bIsToday = b.timestamp >= todayStart;

    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    
    return a.reviewStats.nextReviewTime - b.reviewStats.nextReviewTime;
  });
};

export const processReview = (entry: PracticeEntry, action: ReviewAction): PracticeEntry => {
  const now = Date.now();
  let nextLevel = entry.reviewStats.level;
  let nextReviewTime = now;

  // Simple Spaced Repetition Logic
  const intervals = [1 * 60 * 1000, 10 * 60 * 1000, 24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];

  if (action === ReviewAction.STRANGER) {
    nextLevel = 0; // Reset
    nextReviewTime = now + intervals[0];
  } else {
    nextLevel = Math.min(nextLevel + 1, intervals.length);
    const interval = intervals[Math.min(nextLevel, intervals.length - 1)];
    nextReviewTime = now + interval;
  }

  const updatedEntry: PracticeEntry = {
    ...entry,
    reviewStats: {
      level: nextLevel,
      nextReviewTime: nextReviewTime,
    },
  };

  updateEntry(updatedEntry);
  return updatedEntry;
};
