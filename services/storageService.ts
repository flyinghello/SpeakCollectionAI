import { PracticeEntry, ReviewAction, ReviewStats } from "../types";

const STORAGE_KEY = "speaksmart_entries";
const SETTINGS_KEY = "speaksmart_settings";
const LISTENERS = new Set<() => void>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EF = 2.5;
const MIN_EF = 1.3;

const normalizeReviewStats = (stats?: Partial<ReviewStats>): ReviewStats => {
  const safeStats = stats ?? {};
  const repetitions =
    typeof safeStats.repetitions === "number"
      ? Math.max(0, Math.floor(safeStats.repetitions))
      : typeof safeStats.level === "number"
        ? Math.max(0, Math.floor(safeStats.level))
        : 0;

  const intervalDays =
    typeof safeStats.intervalDays === "number"
      ? Math.max(1, Math.round(safeStats.intervalDays))
      : repetitions === 0
        ? 1
        : repetitions === 1
          ? 1
          : repetitions === 2
            ? 6
            : Math.max(6, repetitions * 2);

  return {
    level: repetitions,
    repetitions,
    intervalDays,
    easinessFactor:
      typeof safeStats.easinessFactor === "number"
        ? Math.max(MIN_EF, safeStats.easinessFactor)
        : DEFAULT_EF,
    nextReviewTime:
      typeof safeStats.nextReviewTime === "number"
        ? safeStats.nextReviewTime
        : Date.now(),
  };
};

const notifyListeners = () => {
  LISTENERS.forEach(listener => listener());
};

export const subscribeToEntries = (listener: () => void) => {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
};

export const getEntries = (): PracticeEntry[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  const entries: PracticeEntry[] = data ? JSON.parse(data) : [];
  return entries.map((entry) => ({
    ...entry,
    reviewStats: normalizeReviewStats(entry.reviewStats),
  }));
};

export const saveEntry = (entry: PracticeEntry) => {
  const entries = getEntries();
  const normalizedEntry: PracticeEntry = {
    ...entry,
    reviewStats: normalizeReviewStats(entry.reviewStats),
  };
  const updatedEntries = [normalizedEntry, ...entries];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));
  notifyListeners();
};

export const updateEntry = (updatedEntry: PracticeEntry) => {
  const entries = getEntries();
  const index = entries.findIndex((e) => e.id === updatedEntry.id);
  if (index !== -1) {
    entries[index] = {
      ...updatedEntry,
      reviewStats: normalizeReviewStats(updatedEntry.reviewStats),
    };
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
            entryMap.set(e.id, {
              ...e,
              reviewStats: normalizeReviewStats(e.reviewStats),
            });
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
  ttsBaseUrl?: string;
  ttsModel?: string;
  ttsAppId?: string;
  ttsAccessToken?: string;
}

export const getSettings = (): AppSettings => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : {};
};

export const saveSettings = (settings: AppSettings) => {
  const current = getSettings();
  const definedUpdates = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined),
  ) as AppSettings;
  const merged: AppSettings = {
    ...current,
    ...definedUpdates,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
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

  // Sort: overdue first, then harder cards first (lower EF / lower repetitions).
  return queue.sort((a, b) => {
    const dueDelta = a.reviewStats.nextReviewTime - b.reviewStats.nextReviewTime;
    if (dueDelta !== 0) return dueDelta;

    const efDelta = a.reviewStats.easinessFactor - b.reviewStats.easinessFactor;
    if (efDelta !== 0) return efDelta;

    return a.reviewStats.repetitions - b.reviewStats.repetitions;
  });
};

export const processReview = (entry: PracticeEntry, action: ReviewAction): PracticeEntry => {
  const now = Date.now();
  const currentStats = normalizeReviewStats(entry.reviewStats);
  const quality = action === ReviewAction.FAMILIAR ? 4 : 2; // SM-2 quality [0..5]
  const qualityDistance = 5 - quality;

  let nextEf = currentStats.easinessFactor
    + (0.1 - qualityDistance * (0.08 + qualityDistance * 0.02));
  nextEf = Math.max(MIN_EF, nextEf);

  let nextRepetitions = currentStats.repetitions;
  let nextIntervalDays = currentStats.intervalDays;

  if (quality < 3) {
    nextRepetitions = 0;
    nextIntervalDays = 1;
  } else {
    nextRepetitions += 1;
    if (nextRepetitions === 1) {
      nextIntervalDays = 1;
    } else if (nextRepetitions === 2) {
      nextIntervalDays = 6;
    } else {
      nextIntervalDays = Math.max(
        1,
        Math.round(currentStats.intervalDays * nextEf),
      );
    }
  }

  const nextReviewTime = now + nextIntervalDays * ONE_DAY_MS;

  const updatedEntry: PracticeEntry = {
    ...entry,
    reviewStats: {
      level: nextRepetitions,
      repetitions: nextRepetitions,
      intervalDays: nextIntervalDays,
      easinessFactor: nextEf,
      nextReviewTime,
    },
  };

  updateEntry(updatedEntry);
  return updatedEntry;
};
