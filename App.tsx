import React, { useState } from "react";
import { MessageSquarePlus, BookOpen, Layers } from "lucide-react";
import InputView from "./components/InputView";
import DatabaseView from "./components/DatabaseView";
import ReviewView from "./components/ReviewView";
import { Tab } from "./types";

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>("input");

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        <div style={{ display: currentTab === 'input' ? 'block' : 'none', height: '100%' }}>
            <InputView />
        </div>
        <div style={{ display: currentTab === 'database' ? 'block' : 'none', height: '100%' }}>
            <DatabaseView />
        </div>
        <div style={{ display: currentTab === 'review' ? 'block' : 'none', height: '100%' }}>
            <ReviewView />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="h-[60px] bg-white border-t border-gray-200 flex justify-around items-center z-50 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setCurrentTab("input")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            currentTab === "input" ? "text-brand-600" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <MessageSquarePlus size={24} strokeWidth={currentTab === 'input' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Practice</span>
        </button>

        <button
          onClick={() => setCurrentTab("review")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            currentTab === "review" ? "text-brand-600" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Layers size={24} strokeWidth={currentTab === 'review' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Review</span>
        </button>

        <button
          onClick={() => setCurrentTab("database")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
            currentTab === "database" ? "text-brand-600" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <BookOpen size={24} strokeWidth={currentTab === 'database' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">History</span>
        </button>
      </nav>
    </div>
  );
};

export default App;