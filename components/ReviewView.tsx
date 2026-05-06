import React, { useState, useEffect } from "react";
import { getReviewQueue, processReview } from "../services/storageService";
import { PracticeEntry, ReviewAction } from "../types";
import { RefreshCcw, ThumbsUp, HelpCircle } from "lucide-react";

interface ReviewItem {
    entryId: string;
    cn: string;
    en: string;
    // We keep reference to the original entry to update stats
    originalEntry: PracticeEntry; 
    type: 'correction' | 'example';
}

const ReviewView: React.FC = () => {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [currentItem, setCurrentItem] = useState<ReviewItem | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = (forceFallback: boolean = false) => {
    // If forceFallback is true (Check Again clicked), it will try to load today's items even if not due.
    const rawEntries = getReviewQueue(forceFallback);
    
    // Expand entries into review items (Main Correction + Examples)
    const reviewItems: ReviewItem[] = [];
    
    rawEntries.forEach(entry => {
        // 1. The main correction
        reviewItems.push({
            entryId: entry.id,
            originalEntry: entry,
            cn: entry.analysis.translation,
            en: entry.analysis.correctedSentence,
            type: 'correction'
        });

        // 2. The AI generated examples
        if (entry.analysis.examples) {
            entry.analysis.examples.forEach(ex => {
                reviewItems.push({
                    entryId: entry.id,
                    originalEntry: entry,
                    cn: ex.cn,
                    en: ex.en,
                    type: 'example'
                });
            });
        }
    });

    setQueue(reviewItems);
    
    if (reviewItems.length > 0) {
        setCurrentItem(reviewItems[0]);
        setFinished(false);
        setIsRevealed(false);
    } else {
        setFinished(true);
        setCurrentItem(null);
    }
  };

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleAction = (action: ReviewAction) => {
    if (!currentItem) return;

    // We only update the stats when we finish the *Main* correction card? 
    // OR we update for every card? 
    // Typically spaced repetition is per "fact". 
    // Here all facts belong to one entry. 
    // If we update stats multiple times for one entry in one session, it might push it too far.
    // Simplification: Only update the entry stats when reviewing the 'correction' type (the main one).
    // The examples serve as reinforcement.
    
    if (currentItem.type === 'correction') {
        processReview(currentItem.originalEntry, action);
    }

    // Remove current from queue list (local state)
    const nextQueue = queue.slice(1);
    setQueue(nextQueue);

    if (nextQueue.length > 0) {
        setCurrentItem(nextQueue[0]);
        setIsRevealed(false);
    } else {
        setCurrentItem(null);
        setFinished(true);
    }
  };

  if (finished) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50 pb-20">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <ThumbsUp className="text-green-600" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Caught Up!</h2>
            <p className="text-gray-500 mb-8">You have no cards due for review right now. Great job!</p>
            <button 
                onClick={() => loadQueue(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 shadow-sm rounded-full text-brand-600 font-semibold hover:bg-gray-50 active:scale-95 transition-all"
            >
                <RefreshCcw size={18} /> Check Again
            </button>
        </div>
    );
  }

  if (!currentItem) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
        <div className="flex-[3] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md aspect-[4/5] bg-white rounded-3xl shadow-xl border border-gray-200 flex flex-col relative overflow-hidden transition-all duration-300">
                {/* Progress */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                    <div 
                        className="h-full bg-brand-500 transition-all duration-300" 
                        style={{ width: `${Math.max(5, (1 - queue.length / (queue.length + 1)) * 100)}%` }}
                    />
                </div>
                
                {/* Type Indicator */}
                <div className="absolute top-4 right-4 px-2 py-1 rounded-full bg-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    {currentItem.type === 'correction' ? 'My Sentence' : 'AI Example'}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" onClick={!isRevealed ? handleReveal : undefined}>
                     {/* Chinese (Question) */}
                    <div className="mb-8">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Translate this</span>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
                            {currentItem.cn}
                        </h2>
                    </div>

                    {/* English (Answer) - Hidden/Revealed */}
                    <div 
                        key={currentItem.en} 
                        className={`transition-all duration-500 ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
                    >
                         <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
                         <p className="text-xl md:text-2xl font-medium text-brand-600 mb-2">
                            {currentItem.en}
                         </p>
                    </div>

                    {!isRevealed && (
                        <div className="absolute bottom-12 left-0 w-full text-center text-gray-400 animate-bounce cursor-pointer">
                            <span className="text-sm">Tap to reveal</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="flex-1 min-h-[100px] px-6 flex items-center justify-center gap-4 pb-4">
            {isRevealed ? (
                <>
                    <button 
                        onClick={() => handleAction(ReviewAction.STRANGER)}
                        className="flex-1 bg-red-50 border-2 border-red-100 text-red-600 font-bold py-4 rounded-2xl active:scale-95 transition-transform flex flex-col items-center justify-center gap-1 shadow-sm"
                    >
                        <HelpCircle size={24} />
                        <span>Forgotten</span>
                    </button>
                    <button 
                        onClick={() => handleAction(ReviewAction.FAMILIAR)}
                        className="flex-1 bg-green-50 border-2 border-green-100 text-green-600 font-bold py-4 rounded-2xl active:scale-95 transition-transform flex flex-col items-center justify-center gap-1 shadow-sm"
                    >
                        <ThumbsUp size={24} />
                        <span>Easy</span>
                    </button>
                </>
            ) : (
                <button 
                    onClick={handleReveal}
                    className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-200 active:scale-95 transition-transform"
                >
                    Show Answer
                </button>
            )}
        </div>
    </div>
  );
};

export default ReviewView;