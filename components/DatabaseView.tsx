import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, ChevronUp, Calendar, Trash2, Edit2, X, Save, MoreVertical, Download, Upload } from "lucide-react";
import { getEntries, deleteEntry, updateEntry, subscribeToEntries, importEntries } from "../services/storageService";
import { PracticeEntry } from "../types";

const DatabaseView: React.FC = () => {
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Menu State
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editModalEntry, setEditModalEntry] = useState<PracticeEntry | null>(null);
  
  // Edit Form State
  const [editOriginal, setEditOriginal] = useState("");
  const [editTranslation, setEditTranslation] = useState("");

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntries(getEntries());
    const unsubscribe = subscribeToEntries(() => {
        setEntries(getEntries());
    });
    return () => { unsubscribe(); };
  }, []);

  const handleTouchStart = (id: string) => {
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

  const openEditModal = (entry: PracticeEntry) => {
    setEditModalEntry(entry);
    setEditOriginal(entry.originalText);
    setEditTranslation(entry.analysis.translation);
    setActiveMenuId(null);
  };

  const saveEdit = () => {
    if (!editModalEntry) return;
    const updated = {
        ...editModalEntry,
        originalText: editOriginal,
        analysis: {
            ...editModalEntry.analysis,
            translation: editTranslation
        }
    };
    updateEntry(updated);
    setEditModalEntry(null);
  };

  const handleDelete = (id: string) => {
      // Direct delete without confirm for better mobile responsiveness
      deleteEntry(id);
      setActiveMenuId(null);
  };

  // --- Export / Import Logic ---
  const handleExport = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `speaksmart_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowGlobalMenu(false);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
    setShowGlobalMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            const data = JSON.parse(json);
            if (Array.isArray(data)) {
                importEntries(data as PracticeEntry[]);
                alert("Import successful!");
            } else {
                alert("Invalid file format: Not an array.");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to parse JSON file.");
        }
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // --- Filtering ---

  const filteredEntries = entries.filter(e => 
    e.originalText.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.analysis.translation.includes(searchTerm) ||
    e.analysis.correctedSentence.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grouped = filteredEntries.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, PracticeEntry[]>);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="application/json" 
        style={{ display: 'none' }} 
      />

      {/* Header & Search */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 pt- safe-top">
        <div className="flex justify-between items-center mb-4 relative">
            <h1 className="text-xl font-bold text-gray-900">My Database</h1>
            
            <button 
                onClick={() => setShowGlobalMenu(!showGlobalMenu)}
                className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
                <MoreVertical size={24} />
            </button>

            {/* Global Menu Dropdown */}
            {showGlobalMenu && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowGlobalMenu(false)}></div>
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <button 
                            onClick={handleExport}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Download size={16} /> Export Backup
                        </button>
                        <button 
                            onClick={handleImportClick}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50"
                        >
                            <Upload size={16} /> Import Data
                        </button>
                    </div>
                </>
            )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p>No records found.</p>
          </div>
        ) : (
            Object.entries(grouped).map(([date, items]: [string, PracticeEntry[]]) => (
                <div key={date}>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
                        <Calendar size={12} /> {date}
                    </div>
                    <div className="space-y-3">
                        {items.map(item => (
                            <div 
                                key={item.id} 
                                className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all ${activeMenuId === item.id ? 'ring-2 ring-brand-500' : ''}`}
                                onTouchStart={() => handleTouchStart(item.id)}
                                onTouchEnd={handleTouchEnd}
                                onMouseDown={() => handleTouchStart(item.id)}
                                onMouseUp={handleTouchEnd}
                                onMouseLeave={handleTouchEnd}
                                onContextMenu={(e) => e.preventDefault()} // Prevent native menu
                            >
                                {/* Summary Row */}
                                <div 
                                    onClick={() => toggleExpand(item.id)}
                                    className="p-4 active:bg-gray-50 transition-colors cursor-pointer select-none"
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-gray-900 font-medium truncate">{item.originalText}</p>
                                            <p className="text-gray-500 text-sm truncate">{item.analysis.translation}</p>
                                        </div>
                                        <button className="text-gray-400">
                                            {expandedId === item.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedId === item.id && (
                                    <div className="px-4 pb-4 pt-0 bg-gray-50/50 border-t border-gray-100">
                                        <div className="mt-3 space-y-2">
                                            <div className="text-sm">
                                                <span className="text-xs font-bold text-gray-400 uppercase">Correction</span>
                                                <div className="mt-1" dangerouslySetInnerHTML={{ __html: item.analysis.displayHtml }} />
                                            </div>
                                            
                                            {item.analysis.examples.length > 0 && (
                                                <div className="pt-2">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Similar Sentences</span>
                                                    <ul className="mt-1 space-y-2">
                                                        {item.analysis.examples.map((ex, i) => (
                                                            <li key={i} className="text-sm">
                                                                <p className="text-gray-800">{ex.en}</p>
                                                                <p className="text-gray-500 text-xs">{ex.cn}</p>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

       {/* Action Menu (Bottom Sheet) */}
       {activeMenuId && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setActiveMenuId(null)}>
            <div className="bg-white w-full rounded-t-3xl p-6 pb-safe animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Entry Options</h3>
                    <button onClick={() => setActiveMenuId(null)} className="p-2 bg-gray-100 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={() => {
                            const entry = entries.find(e => e.id === activeMenuId);
                            if (entry) openEditModal(entry);
                        }}
                        className="w-full flex items-center gap-4 p-4 bg-gray-50 text-gray-800 rounded-xl font-medium active:scale-95 transition-transform"
                    >
                        <div className="p-2 bg-white border border-gray-200 rounded-full"><Edit2 size={20} /></div>
                        Edit Content
                    </button>
                    <button 
                         onClick={() => handleDelete(activeMenuId)}
                        className="w-full flex items-center gap-4 p-4 bg-red-50 text-red-600 rounded-xl font-medium active:scale-95 transition-transform"
                    >
                         <div className="p-2 bg-red-200 rounded-full"><Trash2 size={20} /></div>
                        Delete Entry
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalEntry && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Edit Entry</h3>
                    <button onClick={() => setEditModalEntry(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Original Text (English)</label>
                        <textarea 
                            value={editOriginal}
                            onChange={(e) => setEditOriginal(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none h-24"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Translation (Chinese)</label>
                        <input 
                            type="text"
                            value={editTranslation}
                            onChange={(e) => setEditTranslation(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                        />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex gap-3">
                    <button onClick={() => setEditModalEntry(null)} className="flex-1 py-3 text-gray-600 font-semibold text-sm">Cancel</button>
                    <button onClick={saveEdit} className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm shadow-sm flex items-center justify-center gap-2">
                        <Save size={16} /> Save Changes
                    </button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseView;