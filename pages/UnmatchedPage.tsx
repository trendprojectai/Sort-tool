
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bot, 
  Flag, 
  Search, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  X, 
  ChevronDown, 
  Sparkles, 
  CheckSquare, 
  Square,
  Zap,
  RotateCw,
  MapPin,
  Clock,
  History,
  Save,
  Database,
  Info,
  Filter
} from 'lucide-react';
import { useStore } from '../store';
import { getBulkAISuggestions } from '../lib/ai';
import { getDeterministicSuggestions, checkUnmatchedMemoryCache } from '../lib/utils';
import { OSMRestaurant, GoogleRestaurant, UnmatchedCacheEntry } from '../types';

type SortKey = 'name' | 'street' | 'cuisine';

interface SweepResult {
  osmId: string;
  googleIndex: number;
  confidence: number;
  reason: string;
  osmItem: OSMRestaurant;
  googleItem: GoogleRestaurant;
  selected: boolean;
  source?: 'ai' | 'fuzzy' | 'deterministic';
}

const UnmatchedPage: React.FC = () => {
  const { currentJob, addFlaggedItem, updateCurrentJob, linkItems, unmatchedCache, cacheAllUnmatched } = useStore();
  const job = currentJob();
  
  const [showFlagged, setShowFlagged] = useState(false);
  const [showCacheViewer, setShowCacheViewer] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  
  const [selectedOSM, setSelectedOSM] = useState<OSMRestaurant | null>(null);
  const [selectedGoogle, setSelectedGoogle] = useState<GoogleRestaurant | null>(null);
  
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const [isSweepMode, setIsSweepMode] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [sweepProgress, setSweepProgress] = useState(0);
  const [sweepResults, setSweepResults] = useState<SweepResult[]>([]);
  
  const [toast, setToast] = useState<string | null>(null);

  // Cache Viewer Filters
  const [cacheSearch, setCacheSearch] = useState('');
  const [cacheSourceFilter, setCacheSourceFilter] = useState<'all' | 'overpass' | 'apify'>('all');

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Use Deterministic Assistant when OSM item is clicked
  useEffect(() => {
    const fetchSuggestions = () => {
      if (!selectedOSM || !job || isSweepMode) return;
      setIsLoadingSuggestions(true);
      
      // Perform deterministic matching instead of LLM call
      const candidates = job.unmatchedGoogle;
      const results = getDeterministicSuggestions(selectedOSM, candidates, unmatchedCache);
      
      setAiSuggestions(results);
      setIsLoadingSuggestions(false);
    };

    if (selectedOSM) {
      fetchSuggestions();
    }
  }, [selectedOSM, job?.unmatchedGoogle, isSweepMode, unmatchedCache]);

  const sortedOSM = useMemo(() => {
    if (!job) return [];
    return [...job.unmatchedOSM].sort((a, b) => {
      if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortKey === 'street') return (a['addr:street'] || '').localeCompare(b['addr:street'] || '');
      if (sortKey === 'cuisine') return (a.cuisine || '').localeCompare(b.cuisine || '');
      return 0;
    });
  }, [job?.unmatchedOSM, sortKey]);

  const sortedGoogle = useMemo(() => {
    if (!job) return [];
    return [...job.unmatchedGoogle].sort((a, b) => {
      if (sortKey === 'name') return (a.title || '').localeCompare(b.title || '');
      if (sortKey === 'street') return (a.street || '').localeCompare(b.street || '');
      if (sortKey === 'cuisine') return (a.categoryName || '').localeCompare(b.categoryName || '');
      return 0;
    });
  }, [job?.unmatchedGoogle, sortKey]);

  // Filtered Unmatched Cache Entries
  const filteredCache = useMemo(() => {
    return unmatchedCache
      .filter(e => {
        const matchesSearch = (e.original_name || '').toLowerCase().includes(cacheSearch.toLowerCase());
        const matchesSource = cacheSourceFilter === 'all' || e.source === cacheSourceFilter;
        return matchesSearch && matchesSource;
      })
      .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
  }, [unmatchedCache, cacheSearch, cacheSourceFilter]);

  if (!job) return null;

  const handleManualLink = () => {
    if (selectedOSM && selectedGoogle) {
      linkItems(selectedOSM, selectedGoogle);
      setToast(`✅ Linked ${selectedOSM.name} to ${selectedGoogle.title}`);
      setSelectedOSM(null);
      setSelectedGoogle(null);
    }
  };

  const handleAISuggestionLink = (googleItem: GoogleRestaurant) => {
    if (selectedOSM && googleItem) {
      linkItems(selectedOSM, googleItem);
      setToast(`✅ Linked ${selectedOSM.name} to ${googleItem.title}`);
      setSelectedOSM(null);
      setSelectedGoogle(null);
    }
  };

  const handleCacheRemaining = async () => {
    setIsCaching(true);
    try {
      await cacheAllUnmatched();
      setToast(`📥 Remaining unmatched items stored in Memory Cache`);
    } catch (err) {
      setToast(`❌ Failed to cache items`);
    } finally {
      setIsCaching(false);
    }
  };

  const handleRunSweep = async () => {
    setIsSweepMode(true);
    setIsSweeping(true);
    setSweepProgress(0);
    setSweepResults([]);
    setSelectedOSM(null);
    setSelectedGoogle(null);
    
    try {
      const totalToProcess = Math.min(job.unmatchedOSM.length, 50);
      const batchSize = 10;
      const allResults: SweepResult[] = [];

      for (let i = 0; i < totalToProcess; i += batchSize) {
        const osmSubset = job.unmatchedOSM.slice(i, i + batchSize);
        
        // Use deterministic logic for each item in the batch
        setSweepProgress(Math.round((i / totalToProcess) * 100));
        
        osmSubset.forEach(osm => {
          const suggestions = getDeterministicSuggestions(osm, job.unmatchedGoogle, unmatchedCache);
          if (suggestions.length > 0) {
            const best = suggestions[0];
            allResults.push({
              osmId: osm['@id'] || '',
              googleIndex: best.index,
              confidence: best.confidence_score * 100,
              reason: best.reason,
              osmItem: osm,
              googleItem: job.unmatchedGoogle[best.index - 1],
              selected: best.confidence_score >= 0.8,
              source: 'deterministic'
            });
          }
        });
      }
      
      setSweepResults(allResults);
      setSweepProgress(100);
    } catch (err) {
      console.error("Sweep failed", err);
      setToast("❌ Sweep failed. Try again.");
    } finally {
      setIsSweeping(false);
    }
  };

  const toggleSweepSelection = (osmId: string) => {
    setSweepResults(prev => prev.map(r => 
      r.osmId === osmId ? { ...r, selected: !r.selected } : r
    ));
  };

  const handleConfirmSweep = () => {
    const toLink = sweepResults.filter(r => r.selected);
    toLink.forEach(pair => {
      linkItems(pair.osmItem, pair.googleItem);
    });
    setToast(`✨ Successfully linked ${toLink.length} restaurants`);
    setIsSweepMode(false);
    setSweepResults([]);
  };

  const handleFlagSelected = () => {
    if (!selectedOSM) return;
    const reason = prompt("Why are you flagging this?");
    if (reason) {
      addFlaggedItem({
        source: 'osm',
        restaurant: selectedOSM,
        reason,
        notes: "Manually flagged from unmatched queue"
      });
      updateCurrentJob({
        unmatchedOSM: job.unmatchedOSM.filter(item => item['@id'] !== selectedOSM['@id'])
      });
      setSelectedOSM(null);
      setToast("🚩 Restaurant flagged for later");
    }
  };

  if (showFlagged) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-gray-900">Flagged Resources</h2>
          <button onClick={() => setShowFlagged(false)} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1">
            <X size={16} /> Back to Unmatched
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {job.flaggedItems.map((flag, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-50 rounded-xl text-orange-500">
                  <Flag size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{flag.restaurant.name || (flag.restaurant as any).title}</h4>
                  <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-1">Reason: {flag.reason}</p>
                  <p className="text-xs text-gray-500 italic">"{flag.notes}"</p>
                </div>
              </div>
            </div>
          ))}
          {job.flaggedItems.length === 0 && <p className="text-center py-12 text-gray-400 italic">No flagged items yet.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full h-[calc(100vh-160px)] flex flex-col space-y-4 relative">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* Cache Viewer Sidebar */}
      {showCacheViewer && (
        <div className="fixed inset-0 z-[1000] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCacheViewer(false)} />
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
                   <Database size={20} className="text-blue-600" /> Memory Cache Auditor
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Viewing historical unmatched items</p>
              </div>
              <button onClick={() => setShowCacheViewer(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 flex gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={cacheSearch}
                  onChange={(e) => setCacheSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <select 
                value={cacheSourceFilter}
                onChange={(e) => setCacheSourceFilter(e.target.value as any)}
                className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-600 outline-none"
              >
                <option value="all">All Sources</option>
                <option value="overpass">Overpass</option>
                <option value="apify">Apify</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredCache.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <Database size={32} />
                  </div>
                  <p className="text-sm text-gray-400 font-medium italic">No matching records in cache.</p>
                </div>
              ) : (
                filteredCache.map((entry, idx) => (
                  <div key={idx} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-blue-100 transition-all group">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{entry.original_name}</h4>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">
                        {entry.source}
                      </span>
                    </div>
                    {entry.normalized_address && (
                      <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={10} /> {entry.normalized_address}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Seen Count</p>
                        <p className="text-sm font-black text-gray-900">{entry.seen_count} times</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Last Seen</p>
                        <p className="text-[10px] font-bold text-gray-900">{new Date(entry.last_seen_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {entry.google_place_id && (
                      <div className="mt-2 bg-blue-50 px-2 py-1 rounded text-[9px] font-mono text-blue-600 truncate">
                        ID: {entry.google_place_id}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
               <p className="text-[10px] text-gray-400 font-bold uppercase">Total unique items: {unmatchedCache.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-black text-gray-900">Unmatched Resources</h2>
          <div className="flex items-center gap-3 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sort by:</span>
            <select 
              value={sortKey} 
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs font-bold text-blue-600 outline-none cursor-pointer bg-transparent"
            >
              <option value="name">Name</option>
              <option value="street">Street</option>
              <option value="cuisine">Cuisine</option>
            </select>
            <ChevronDown size={14} className="text-gray-400" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
             <div className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">OSM ({job.unmatchedOSM.length})</div>
             <div className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">Google ({job.unmatchedGoogle.length})</div>
          </div>
          <button 
            onClick={() => setShowFlagged(true)}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-all flex items-center gap-2"
          >
            <Flag size={14} /> Flagged ({job.flaggedItems.length})
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden px-2">
        {/* Left Column: OSM */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">OpenStreetMap (Left)</span>
            <span className="px-2 py-0.5 bg-white rounded border border-gray-100 text-[10px] font-bold text-gray-400">{sortedOSM.length} left</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {sortedOSM.map((osm) => {
              const isSelected = selectedOSM?.['@id'] === osm['@id'];
              const cacheInfo = checkUnmatchedMemoryCache(osm, unmatchedCache);
              return (
                <div 
                  key={osm['@id'] || osm.name}
                  onClick={() => { setSelectedOSM(isSelected ? null : osm); setIsSweepMode(false); }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer group ${isSelected ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-md' : 'border-gray-50 hover:border-gray-200 bg-white shadow-sm'}`}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-900 leading-tight">{osm.name}</h4>
                    {cacheInfo.seen_before && (
                        <div className="bg-orange-50 text-orange-600 p-1 rounded-md" title={cacheInfo.reason}>
                            <Clock size={14} />
                        </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{osm['addr:street'] || 'Unknown Street'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">{osm.cuisine || 'Unknown Cuisine'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel: Deterministic Assistant */}
        <div className="w-[380px] flex flex-col gap-4">
          <div className="flex-1 bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-gray-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={20} />
                <span className="text-xs font-black uppercase tracking-widest">Matching Assistant (v2)</span>
              </div>
              {isSweepMode && (
                <button onClick={() => setIsSweepMode(false)} className="text-white/70 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="flex-1 p-5 overflow-y-auto flex flex-col custom-scrollbar">
              {isSweepMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                       <Zap size={14}/> {isSweeping ? 'Calculating Matches...' : 'Sweep Results'}
                    </h3>
                  </div>

                  {isSweeping && (
                    <div className="space-y-3">
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-gray-800 h-full transition-all duration-500" 
                          style={{ width: `${sweepProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-center font-bold text-gray-800 uppercase">{sweepProgress}% Processed</p>
                    </div>
                  )}

                  {isSweeping ? (
                    <div className="py-12 flex flex-col items-center gap-3 text-center">
                      <Loader2 size={32} className="animate-spin text-gray-400" />
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-widest animate-pulse">Running Gated Analysis...</p>
                    </div>
                  ) : sweepResults.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                         <p className="text-[10px] text-gray-700 font-bold uppercase tracking-tight">
                           {sweepResults.length} Suggestions Found
                         </p>
                         <button 
                           onClick={handleRunSweep}
                           className="text-gray-600 hover:text-gray-800 flex items-center gap-1 text-[10px] font-bold"
                         >
                           <RotateCw size={12}/> Rescan
                         </button>
                      </div>
                      {sweepResults.map((r) => (
                        <div 
                          key={r.osmId} 
                          onClick={() => toggleSweepSelection(r.osmId)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer group flex gap-3 ${r.selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-300'}`}
                        >
                          <div className="mt-1">
                            {r.selected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <h5 className="text-[11px] font-black text-gray-900 truncate">{r.osmItem.name}</h5>
                              <span className={`text-[9px] font-black px-1.5 rounded ${r.confidence >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {Math.round(r.confidence)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 my-1 text-gray-200">
                              <div className="h-px flex-1 bg-current" />
                              <ArrowRight size={10} />
                              <div className="h-px flex-1 bg-current" />
                            </div>
                            <h5 className="text-[11px] font-black text-gray-900 truncate">{r.googleItem.title}</h5>
                            <p className="text-[9px] text-gray-500 mt-1 italic leading-tight">💡 {r.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                        <Search size={32}/>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-bold">No Suggestions Meet Criteria</p>
                        <p className="text-[10px] text-gray-400 mt-1">Check distance constraints (>150m hard cutoff).</p>
                      </div>
                      <button 
                        onClick={handleRunSweep} 
                        className="px-4 py-2 bg-gray-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                      >
                        Scan Workspace
                      </button>
                    </div>
                  )}
                </div>
              ) : !selectedOSM ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
                  <div className="p-4 bg-gray-50 rounded-full text-gray-300">
                    <Bot size={48} />
                  </div>
                  <div className="space-y-4 w-full">
                    <p className="text-sm text-gray-500 font-medium italic">"Deterministic suggestions based on name, distance, and IDs."</p>
                    
                    <div className="grid grid-cols-1 gap-3 w-full">
                      <button 
                        onClick={handleRunSweep}
                        className="group flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:shadow-xl hover:translate-y-[-2px] transition-all"
                      >
                        <Sparkles size={18} /> 
                        Run Match Scan
                      </button>
                      
                      <div className="h-px bg-gray-100 my-2" />
                      
                      <button 
                        onClick={handleCacheRemaining}
                        disabled={isCaching || (job.unmatchedOSM.length === 0 && job.unmatchedGoogle.length === 0)}
                        className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        {isCaching ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} className="text-blue-500" />}
                        Cache Remaining Unmatched
                      </button>

                      <button 
                        onClick={() => setShowCacheViewer(true)}
                        className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                      >
                        <History size={14} className="text-amber-500" />
                        View Memory Cache ({unmatchedCache.length})
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 max-w-[200px] leading-tight">
                    Deterministic gating: 150m max distance, core name normalization, and Place ID matching.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                       Suggestions For:
                    </h3>
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="font-black text-gray-900 text-xl leading-tight">{selectedOSM.name}</p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin size={10} /> {selectedOSM['addr:street'] || 'Address Unknown'}
                            </p>
                        </div>
                        {(() => {
                            const cacheInfo = checkUnmatchedMemoryCache(selectedOSM, unmatchedCache);
                            return cacheInfo.seen_before ? (
                                <div className="bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">
                                    <p className="text-[9px] font-black text-orange-600 uppercase leading-none">SEEN BEFORE</p>
                                    <p className="text-[8px] text-orange-500 font-bold mt-1">Found {cacheInfo.count}x in cache</p>
                                </div>
                            ) : null;
                        })()}
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {isLoadingSuggestions ? (
                    <div className="py-12 flex flex-col items-center gap-3">
                      <Loader2 size={32} className="animate-spin text-gray-200" />
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-widest animate-pulse">Running deterministic engine...</p>
                    </div>
                  ) : aiSuggestions.length > 0 ? (
                    <div className="space-y-4">
                      {aiSuggestions.map((s, i) => {
                        const candidate = job.unmatchedGoogle[s.index - 1];
                        if (!candidate) return null;
                        return (
                          <div key={i} className="p-4 bg-white border border-gray-100 rounded-2xl space-y-3 hover:border-blue-200 transition-all shadow-sm">
                            <div className="flex justify-between items-start gap-2">
                              <h5 className="text-sm font-bold text-gray-900 leading-tight">{candidate.title}</h5>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${s.confidence_score >= 0.8 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {Math.round(s.confidence_score * 100)}% Match
                              </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-[11px] text-gray-500 leading-tight">{candidate.street || 'No street listed'}</p>
                                {s.distance_meters && (
                                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">
                                        Dist: {s.distance_meters}m
                                    </p>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100/50 italic">
                              💡 {s.reason}
                            </p>
                            <button 
                              onClick={() => handleAISuggestionLink(candidate)}
                              className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                              ✅ Link These
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                        <Search size={24}/>
                      </div>
                      <p className="text-xs text-gray-400 italic font-medium">No valid candidates found within 150m or with similar names.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isSweepMode && sweepResults.length > 0 && !isSweeping && (
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={handleConfirmSweep}
                  disabled={!sweepResults.some(r => r.selected)}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
                >
                  Confirm {sweepResults.filter(r => r.selected).length} Matches
                </button>
              </div>
            )}

            {!isSweepMode && selectedOSM && (
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={handleFlagSelected}
                  className="w-full py-3 flex items-center justify-center gap-2 text-xs font-bold text-orange-600 bg-white border border-orange-100 hover:bg-orange-50 rounded-xl transition-all shadow-sm"
                >
                  <Flag size={14} /> Mark as "No Match"
                </button>
              </div>
            )}
          </div>

          {!isSweepMode && (
            <div className={`p-4 bg-white rounded-3xl border border-gray-200 shadow-xl transition-all duration-300 ${selectedOSM && selectedGoogle ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-2 pointer-events-none scale-95'}`}>
              <button 
                onClick={handleManualLink}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-green-700 shadow-xl active:scale-95 transition-all"
              >
                Manual Link Selected <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Google */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Google Maps (Right)</span>
            <span className="px-2 py-0.5 bg-white rounded border border-gray-100 text-[10px] font-bold text-gray-400">{sortedGoogle.length} available</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {sortedGoogle.map((google) => {
              const isSelected = selectedGoogle?.url === google.url;
              const cacheInfo = checkUnmatchedMemoryCache(google, unmatchedCache);
              return (
                <div 
                  key={google.url || google.title}
                  onClick={() => { setSelectedGoogle(isSelected ? null : google); setIsSweepMode(false); }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer group ${isSelected ? 'border-green-500 bg-green-50/50 ring-2 ring-green-500/20 shadow-md' : 'border-gray-50 hover:border-gray-200 bg-white shadow-sm'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 leading-tight flex-1 group-hover:text-blue-600 transition-colors">{google.title}</h4>
                    <div className="flex items-center gap-1">
                        {cacheInfo.seen_before && (
                            <div className="bg-orange-50 text-orange-600 p-1 rounded-md" title={cacheInfo.reason}>
                                <Clock size={12} />
                            </div>
                        )}
                        {google.totalScore && (
                        <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px] font-black">
                            {google.totalScore} ★
                        </div>
                        )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{google.street || 'No Street Provided'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">{google.categoryName || 'General Category'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
};

export default UnmatchedPage;
