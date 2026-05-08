export interface ExampleSentence {
  en: string;
  cn: string;
}

export interface AnalysisResult {
  isCorrect: boolean;
  correctedSentence: string;
  displayHtml: string; // HTML string with red/green spans
  translation: string;
  examples: ExampleSentence[];
}

export interface ReviewStats {
  // Legacy field kept for backward compatibility.
  level?: number;
  nextReviewTime: number; // Timestamp
  easinessFactor: number; // SM-2 EF, min 1.3
  repetitions: number; // Successful review streak
  intervalDays: number; // Days until next review
}

export interface PracticeEntry {
  id: string;
  timestamp: number;
  originalText: string;
  analysis: AnalysisResult;
  reviewStats: ReviewStats;
}

export type Tab = 'input' | 'review' | 'database';

export enum ReviewAction {
  FAMILIAR = 'FAMILIAR',
  STRANGER = 'STRANGER'
}
