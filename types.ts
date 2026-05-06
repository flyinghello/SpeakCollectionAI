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

export interface PracticeEntry {
  id: string;
  timestamp: number;
  originalText: string;
  analysis: AnalysisResult;
  reviewStats: {
    level: number; // 0 = New, 1+ = Learned
    nextReviewTime: number; // Timestamp
  };
}

export type Tab = 'input' | 'review' | 'database';

export enum ReviewAction {
  FAMILIAR = 'FAMILIAR',
  STRANGER = 'STRANGER'
}