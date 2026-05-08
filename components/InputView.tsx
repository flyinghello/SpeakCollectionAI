import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, Loader2, CheckCircle2, AlertCircle, Trash2, Edit2, X, Menu, Settings, Keyboard, Globe, Key, Bot } from "lucide-react";
import { analyzeSentence } from "../services/geminiService";
import { transcribeAudio } from "../services/asrService";
import { saveEntry, getEntries, deleteEntry, subscribeToEntries, getSettings, saveSettings } from "../services/storageService";
import { PracticeEntry, AnalysisResult } from "../types";
import { v4 as uuidv4 } from "uuid";

type RecordingState = 'idle' | 'recording' | 'canceling';
type InputMode = 'text' | 'voice';

const InputView: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  
  // Input State
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  
  // Menus
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Form
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [modelIdInput, setModelIdInput] = useState("");
  const [asrBaseUrlInput, setAsrBaseUrlInput] = useState("");
  const [asrModelInput, setAsrModelInput] = useState("");
  const [ttsBaseUrlInput, setTtsBaseUrlInput] = useState("");
  const [ttsModelInput, setTtsModelInput] = useState("");
  const [ttsAppIdInput, setTtsAppIdInput] = useState("");
  const [ttsAccessTokenInput, setTtsAccessTokenInput] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldSendAfterStopRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number>(0);
  const lastErrorAlertAt = useRef<number>(0);

  // Sync with DB
  useEffect(() => {
    setEntries(getEntries().sort((a, b) => a.timestamp - b.timestamp));
    const unsubscribe = subscribeToEntries(() => {
        setEntries(getEntries().sort((a, b) => a.timestamp - b.timestamp));
    });
    return () => { unsubscribe(); };
  }, []);

  // Initialize Settings
  useEffect(() => {
    const settings = getSettings();
    setApiKeyInput(settings.apiKey || "");
    setBaseUrlInput(settings.baseUrl || "");
    setModelIdInput(settings.modelId || "");
    setAsrBaseUrlInput(settings.asrBaseUrl || "");
    setAsrModelInput(settings.asrModel || "");
    setTtsBaseUrlInput(settings.ttsBaseUrl || "");
    setTtsModelInput(settings.ttsModel || "");
    setTtsAppIdInput(settings.ttsAppId || "");
    setTtsAccessTokenInput(settings.ttsAccessToken || "");
  }, [showSettings]);

  const handleSaveSettings = () => {
    if (!apiKeyInput.trim()) {
      alert("API Key 不能为空，请填写后再保存。");
      return;
    }

    saveSettings({
      apiKey: apiKeyInput.trim(),
      baseUrl: baseUrlInput.trim() || undefined,
      modelId: modelIdInput.trim() || undefined,
      asrBaseUrl: asrBaseUrlInput.trim() || undefined,
      asrModel: asrModelInput.trim() || undefined,
      ttsBaseUrl: ttsBaseUrlInput.trim() || undefined,
      ttsModel: ttsModelInput.trim() || undefined,
      ttsAppId: ttsAppIdInput.trim() || undefined,
      ttsAccessToken: ttsAccessTokenInput.trim() || undefined,
    });
    setShowSettings(false);
  };

  // Auto-scroll on new entry
  useEffect(() => {
    if (scrollRef.current && !loading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, loading]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current = null;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const handleVoiceStart = async (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); 
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        alert("Audio recording is not supported in this browser.");
        return;
    }

    setInputText("");
    setRecordingState('recording');
    
    const y = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
    touchStartY.current = y;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const stream = mediaStreamRef.current;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }

          if (!shouldSendAfterStopRef.current) {
            audioChunksRef.current = [];
            return;
          }

          if (!audioChunksRef.current.length) {
            alert("No audio captured. Please try again.");
            return;
          }

          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          audioChunksRef.current = [];

          setLoading(true);
          try {
            const transcript = await transcribeAudio(audioBlob);
            await handleSend(transcript);
          } catch (error) {
            console.error(error);
            const detail = error instanceof Error ? error.message : "Unknown error";
            alert(`Voice transcription failed: ${detail}`);
          } finally {
            setLoading(false);
          }
        };

        recorder.start();
    } catch (err) {
        console.error("Failed to start recording", err);
        setRecordingState('idle');
        alert("Unable to access microphone. Please allow microphone permission.");
    }
  };

  const handleVoiceMove = (e: React.TouchEvent) => {
      if (recordingState === 'idle') return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY.current - currentY; 
      
      if (deltaY > 100) {
          setRecordingState('canceling');
      } else {
          setRecordingState('recording');
      }
  };

  const handleVoiceEnd = async () => {
      if (recordingState === 'idle') return;

      shouldSendAfterStopRef.current = recordingState === 'recording';
      if (!shouldSendAfterStopRef.current) {
        setInputText("");
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      setRecordingState('idle');
  };

  const handleSend = async (textOverride?: string) => {
    const userText = (textOverride ?? inputText).trim();
    if (!userText) return;

    if (!textOverride) {
      setInputText("");
      setLoading(true);
    }

    setTimeout(() => {
       if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 10);

    try {
      const result: AnalysisResult = await analyzeSentence(userText);
      const newEntry: PracticeEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        originalText: userText,
        analysis: result,
        reviewStats: {
          level: 0,
          repetitions: 0,
          intervalDays: 1,
          easinessFactor: 2.5,
          nextReviewTime: Date.now()
        }
      };
      saveEntry(newEntry);
    } catch (error) {
      console.error(error);
      const now = Date.now();
      if (now - lastErrorAlertAt.current > 2000) {
        lastErrorAlertAt.current = now;
        const detail = error instanceof Error ? error.message : "Unknown error";
        alert(`Failed to analyze sentence: ${detail}`);
      }
    } finally {
      if (!textOverride) {
        setLoading(false);
      }
    }
  };

  const handleMessageLongPress = (id: string) => {
    longPressTimer.current = setTimeout(() => {
        setActiveMenuId(id);
    }, 600); 
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  const handleEditAndResend = (entry: PracticeEntry) => {
    setInputText(entry.originalText);
    deleteEntry(entry.id);
    setActiveMenuId(null);
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
    setActiveMenuId(null);
  };

  const renderAiResponse = (entry: PracticeEntry) => {
    const isPerfect = entry.analysis.isCorrect;

    return (
      <div className={`p-4 rounded-2xl rounded-tl-none shadow-sm border max-w-[90%] mb-4 text-sm ${isPerfect ? 'bg-green-50 border-green-100' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          {isPerfect ? (
            <span className="text-green-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={16} /> Perfect!
            </span>
          ) : (
            <span className="text-amber-600 font-bold flex items-center gap-1">
              <AlertCircle size={16} /> Improvements Suggested
            </span>
          )}
        </div>

        {!isPerfect && (
          <div className="mb-4 text-base leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: entry.analysis.displayHtml }} />
          </div>
        )}

        <div className="text-gray-600 italic mb-4 border-l-2 border-brand-200 pl-3">
            {entry.analysis.translation}
        </div>

        {entry.analysis.examples && entry.analysis.examples.length > 0 && (
          <div className="bg-gray-50 p-3 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Examples</p>
            {entry.analysis.examples.map((ex, idx) => (
              <div key={idx} className="border-b last:border-0 border-gray-200 pb-2 last:pb-0">
                <p className="text-gray-800 font-medium">{ex.en}</p>
                <p className="text-gray-500 text-xs">{ex.cn}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Top Bar with Menu (Right Side) */}
      <div className="absolute top-0 left-0 right-0 p-3 z-20 flex justify-end pointer-events-none">
          <button 
            onClick={() => setShowSettings(true)}
            className="pointer-events-auto p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm text-gray-600 hover:bg-gray-100"
          >
              <Menu size={24} />
          </button>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pt-12 pb-24 space-y-4 no-scrollbar">
        <div className="text-center text-gray-400 text-sm mt-4 mb-8">
            Start speaking or typing to practice English. <br/> Long press bubbles to edit or delete.
        </div>
        
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-2">
            {/* User Message */}
            <div 
                className="flex justify-end group select-none"
                onTouchStart={() => handleMessageLongPress(entry.id)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleMessageLongPress(entry.id)} 
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
            >
              <div className="bg-brand-500 text-white px-4 py-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] relative transition-transform active:scale-95 cursor-pointer">
                {entry.originalText}
              </div>
            </div>

            {/* AI Response */}
            <div className="flex justify-start">
              {renderAiResponse(entry)}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-end space-y-2 flex-col items-end w-full">
             <div className="bg-brand-500/50 text-white px-4 py-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%]">...</div>
             <div className="w-full flex justify-start">
                <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="animate-spin" size={16} /> Processing...
                </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Menu */}
      {activeMenuId && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setActiveMenuId(null)}>
            <div className="bg-white w-full rounded-t-3xl p-6 pb-safe animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Message Options</h3>
                    <button onClick={() => setActiveMenuId(null)} className="p-2 bg-gray-100 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={() => {
                            const entry = entries.find(e => e.id === activeMenuId);
                            if (entry) handleEditAndResend(entry);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-brand-50 text-brand-700 rounded-xl font-medium active:scale-95 transition-transform"
                    >
                        <div className="p-2 bg-brand-200 rounded-full"><Edit2 size={20} /></div>
                        Edit & Resend (Correct)
                    </button>
                    <button 
                         onClick={() => handleDelete(activeMenuId)}
                        className="w-full flex items-center gap-4 p-4 bg-red-50 text-red-600 rounded-xl font-medium active:scale-95 transition-transform"
                    >
                         <div className="p-2 bg-red-200 rounded-full"><Trash2 size={20} /></div>
                        Delete Conversation
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={18}/> Settings</h3>
                        <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                    </div>
                    <div className="p-4 space-y-5">
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Globe size={14} /> AI Base URL
                             </label>
                             <input 
                                type="text" 
                                placeholder="/api/v3" 
                                value={baseUrlInput}
                                onChange={(e) => setBaseUrlInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Default: /api/v3 (Uses local proxy)</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Bot size={14} /> AI Model ID
                             </label>
                             <input 
                                type="text" 
                                placeholder="doubao-1-5-pro-32k-250115" 
                                value={modelIdInput}
                                onChange={(e) => setModelIdInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Default: doubao-1-5-pro-32k-250115</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Globe size={14} /> ASR Base URL
                             </label>
                             <input
                                type="text"
                                placeholder="/api/v3"
                                value={asrBaseUrlInput}
                                onChange={(e) => setAsrBaseUrlInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Default: /api/v3 (Uses Ark proxy)</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Bot size={14} /> ASR Model
                             </label>
                             <input
                                type="text"
                                placeholder="doubao-seed-2-0-mini-260428"
                                value={asrModelInput}
                                onChange={(e) => setAsrModelInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Default: doubao-seed-2-0-mini-260428 (custom Ark ASR model ID supported).</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Globe size={14} /> TTS Base URL
                             </label>
                             <input
                                type="text"
                                placeholder="/api/v3"
                                value={ttsBaseUrlInput}
                                onChange={(e) => setTtsBaseUrlInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Default: /api/v3 (Ark proxy). DMX use /dmx/v1 with DMX key.</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Bot size={14} /> TTS Model
                             </label>
                             <input
                                type="text"
                                placeholder="zh_female_vv_uranus_bigtts"
                                value={ttsModelInput}
                                onChange={(e) => setTtsModelInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Default: zh_female_vv_uranus_bigtts (Vivi 2.0)</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Key size={14} /> TTS App ID
                             </label>
                             <input
                                type="text"
                                placeholder="Enter App ID"
                                value={ttsAppIdInput}
                                onChange={(e) => setTtsAppIdInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Volcengine App ID for TTS authentication.</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Key size={14} /> TTS Access Token
                             </label>
                             <input
                                type="password"
                                placeholder="your-access-token"
                                value={ttsAccessTokenInput}
                                onChange={(e) => setTtsAccessTokenInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">Volcengine Access Token for TTS authentication.</p>
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                <Key size={14} /> API Key
                             </label>
                             <input 
                                type="password" 
                                placeholder="请输入你的 API Key" 
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                             <p className="text-xs text-gray-400">API Key 仅保存在当前设备本地，下次打开会自动读取。</p>
                        </div>
                        
                        <div className="pt-2">
                            <button 
                                onClick={handleSaveSettings}
                                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold shadow-sm hover:bg-brand-700 transition-colors"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
               </div>
          </div>
      )}

      {/* Voice Recording Overlay */}
      {recordingState !== 'idle' && (
          <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
              <div className={`transition-all duration-300 ${recordingState === 'canceling' ? 'text-red-500 scale-110' : 'text-white scale-100'}`}>
                   {recordingState === 'canceling' ? <Trash2 size={48} /> : <Mic size={48} />}
              </div>
              <p className={`mt-8 font-medium text-lg ${recordingState === 'canceling' ? 'text-red-400' : 'text-white'}`}>
                  {recordingState === 'canceling' ? 'Release to Cancel' : 'Release to Send'}
              </p>
              <p className="mt-2 text-gray-400 text-sm">Swipe up to cancel</p>
          </div>
      )}

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-100 p-3 pb-safe z-10 shadow-lg">
        <div className="flex items-center gap-2 max-w-screen-md mx-auto h-[52px]">
          
          {/* Left: Mic Button to Toggle Voice Mode */}
          <button 
            onClick={() => setInputMode('voice')}
            className={`h-full aspect-square rounded-full transition-colors flex items-center justify-center flex-shrink-0 ${inputMode === 'voice' ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            <Mic size={20} />
          </button>
          
          {/* Middle: Textarea OR Voice Button */}
          <div className="flex-1 h-full">
              {inputMode === 'text' ? (
                <div className="h-full bg-gray-100 rounded-2xl px-4 flex items-center focus-within:ring-2 focus-within:ring-brand-500 focus-within:bg-white transition-all">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a sentence..."
                        className="w-full bg-transparent border-none focus:outline-none resize-none text-gray-800 placeholder:text-gray-400 py-1 leading-normal"
                        rows={1}
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        style={{ height: '24px' }}
                    />
                </div>
              ) : (
                <button
                    className="w-full h-full bg-brand-500 active:bg-brand-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm touch-none select-none transition-transform active:scale-[0.98]"
                    onTouchStart={handleVoiceStart}
                    onTouchMove={handleVoiceMove}
                    onTouchEnd={handleVoiceEnd}
                    onMouseDown={handleVoiceStart}
                    onMouseUp={handleVoiceEnd}
                    onMouseLeave={handleVoiceEnd}
                >
                    <Mic size={20} /> Hold to Speak
                </button>
              )}
          </div>

          {/* Right: Send OR Switch Back */}
          {inputMode === 'text' ? (
              <button 
                onClick={() => { void handleSend(); }}
                disabled={!inputText.trim() || loading}
                className="h-full aspect-square bg-brand-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center flex-shrink-0"
              >
                <Send size={20} />
              </button>
          ) : (
              <button 
                onClick={() => setInputMode('text')}
                className="h-full aspect-square bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors flex items-center justify-center flex-shrink-0"
              >
                <Keyboard size={20} />
              </button>
          )}

        </div>
      </div>
    </div>
  );
};

export default InputView;
