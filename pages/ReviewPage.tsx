
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  SkipForward, 
  Search, 
  MapPin, 
  Phone, 
  Globe, 
  Star, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { useStore } from '../store';
import { Match } from '../types';

const ReviewPage: React.FC = () => {
  const job = useStore(state => state.currentJob());
  const updateMatchStatus = useStore(state => state.updateMatchStatus);
  const setReviewIndex = useStore(state => state.setReviewIndex);
  
  const [filter, setFilter] = useState<Match['confidence'] | 'All'>('All');
  
  const matches = job?.matches || [];
  const currentReviewIndex = job?.currentReviewIndex || 0;
  const currentMatch = matches[currentReviewIndex];
  
  const confirmedCount = matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed').length;
  const rejectedCount = matches.filter(m => m.status === 'rejected').length;
  const totalCount = matches.length;

  const handleAction = useCallback((status: Match['status']) => {
    if (!job) return;
    updateMatchStatus(currentReviewIndex, status);
    
    // Move to next pending
    const nextPending = matches.findIndex((m, i) => i > currentReviewIndex && m.status === 'pending');
    if (nextPending !== -1) {
      setReviewIndex(nextPending);
    } else {
      const firstPending = matches.findIndex(m => m.status === 'pending');
      if (firstPending !== -1) setReviewIndex(firstPending);
    }
  }, [currentReviewIndex, matches, updateMatchStatus, setReviewIndex, job]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'y' || e.key === 'Enter') handleAction('confirmed');
      if (e.key.toLowerCase() === 'n' || e.key === 'Delete') handleAction('rejected');
      if (e.key.toLowerCase() === 's' || e.key === ' ') handleAction('skipped');
      if (e.key === 'ArrowLeft') setReviewIndex(Math.max(0, currentReviewIndex - 1));
      if (e.key === 'ArrowRight') setReviewIndex(Math.min(totalCount - 1, currentReviewIndex + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, currentReviewIndex, totalCount, setReviewIndex]);

  if (!currentMatch) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner shadow-indigo-100/50">
          <CheckCircle2 size={48} />
        </div>
        <h3 className="text-3xl font-black text-slate-800 tracking-tight">Review Queue Clear</h3>
        <p className="text-slate-400 font-medium max-w-sm mx-auto mt-4 leading-relaxed">All pending matches have been processed. Switch to Export to finalize your data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-10">
      {/* Immersive Top Stats */}
      <div className="glass border border-white/60 rounded-2xl p-4 shadow-sm flex items-center justify-between sticky top-[92px] z-40">
        <div className="flex items-center gap-8 pl-4">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Queue Status</div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-800 text-lg">{(confirmedCount + rejectedCount).toLocaleString()}</span>
                <span className="text-slate-300 font-bold">/</span>
                <span className="text-slate-400 font-bold text-sm">{totalCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="hidden md:flex gap-1.5 p-1 bg-slate-50 rounded-xl">
            {['All', 'High', 'Medium'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f as any)} 
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {f}
                </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setReviewIndex(Math.max(0, currentReviewIndex - 1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-800 transition-all border border-transparent hover:border-slate-100 active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="glass px-4 py-2 rounded-xl text-[11px] font-black text-slate-600 mono tracking-tighter shadow-inner">
            {currentReviewIndex + 1} OF {totalCount}
          </div>
          <button 
            onClick={() => setReviewIndex(Math.min(totalCount - 1, currentReviewIndex + 1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-800 transition-all border border-transparent hover:border-slate-100 active:scale-90"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-10">
        {/* Source A (OSM) */}
        <div className="lg:col-span-3 bg-white/40 border border-slate-100 rounded-[2.5rem] p-10 shadow-sm relative group hover:bg-white hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500">
          <div className="absolute top-8 left-8 flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Layers size={16} />
            </div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Source A (OSM)</span>
          </div>
          
          <div className="mt-16">
            <h3 className="text-3xl font-black text-slate-800 mb-8 leading-tight">{currentMatch.osmData.name}</h3>
            
            <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <MapPin size={18} />
                    </div>
                    <div>
                        <p className="text-base font-bold text-slate-700 leading-tight">{currentMatch.osmData['addr:street'] || 'Unknown Street'}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{currentMatch.osmData['addr:postcode'] || 'No Postcode'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <Star size={18} />
                    </div>
                    <p className="text-sm font-bold text-slate-600">{currentMatch.osmData.cuisine || 'Cuisine unspecified'}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <Info size={18} />
                    </div>
                    <code className="text-[10px] font-black mono text-slate-400 px-2 py-1 bg-slate-50 rounded-md border border-slate-100">{currentMatch.osmData['@id']}</code>
                </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-50">
            <a href={`https://www.openstreetmap.org/${currentMatch.osmData['@id']}`} target="_blank" className="text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 hover:translate-x-1 transition-all">
              Inspect on OSM <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Center Scoring Analysis */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center gap-6 py-6 lg:border-x border-slate-100">
            <div className="relative group">
                <div className={`absolute inset-0 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-all ${
                    currentMatch.confidence === 'High' ? 'bg-emerald-500' : 
                    currentMatch.confidence === 'Medium' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <div className={`relative w-24 h-24 rounded-[2rem] glass flex items-center justify-center border-4 neo-shadow transition-transform duration-500 group-hover:scale-110 ${
                    currentMatch.confidence === 'High' ? 'border-emerald-100 text-emerald-600' : 
                    currentMatch.confidence === 'Medium' ? 'border-amber-100 text-amber-600' : 'border-red-100 text-red-600'
                }`}>
                    <span className="text-3xl font-black">{Math.round(currentMatch.score)}%</span>
                </div>
            </div>
            
            <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Similarity Score</p>
                <p className={`text-xs font-black uppercase tracking-widest ${
                    currentMatch.confidence === 'High' ? 'text-emerald-500' : 
                    currentMatch.confidence === 'Medium' ? 'text-amber-500' : 'text-red-500'
                }`}>{currentMatch.confidence} Confidence</p>
            </div>

            {currentMatch.method === 'manual_verified' && (
                <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100">
                    Neural Overlay
                </div>
            )}

            <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                <ArrowRightLeft size={24} />
            </div>
        </div>

        {/* Source B (Google) */}
        <div className="lg:col-span-3 bg-white/40 border border-slate-100 rounded-[2.5rem] p-10 shadow-sm relative group hover:bg-white hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500">
          <div className="absolute top-8 left-8 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <Globe size={16} />
            </div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Source B (Google)</span>
          </div>

          <div className="mt-16">
            <h3 className="text-3xl font-black text-slate-800 mb-8 leading-tight">{currentMatch.googleData.title}</h3>

            <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <MapPin size={18} />
                    </div>
                    <p className="text-base font-bold text-slate-700 leading-tight">{currentMatch.googleData.street}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                        <Star size={18} className="fill-amber-500" />
                    </div>
                    <p className="text-sm text-slate-700 font-extrabold">{currentMatch.googleData.totalScore} <span className="text-slate-400 font-bold ml-1">({currentMatch.googleData.reviewsCount} reviews)</span></p>
                </div>
                {currentMatch.googleData.phone && (
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <Phone size={18} />
                    </div>
                    <p className="text-sm font-bold text-slate-600">{currentMatch.googleData.phone}</p>
                </div>
                )}
                {currentMatch.googleData.website && (
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                        <Globe size={18} />
                    </div>
                    <p className="text-sm font-bold text-indigo-600 truncate max-w-[200px]">{currentMatch.googleData.website.replace('https://', '')}</p>
                </div>
                )}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-50">
            <a href={currentMatch.googleData.url} target="_blank" className="text-emerald-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 hover:translate-x-1 transition-all">
              Live Map View <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Floating Action Menu */}
      <div className="flex flex-col items-center gap-10 mt-6 relative pb-10">
        <div className="glass p-5 rounded-[2.5rem] shadow-2xl flex items-center gap-6 border border-white/80 ring-1 ring-slate-100">
          <button 
            onClick={() => handleAction('rejected')}
            className="group flex flex-col items-center gap-2 w-28 py-4 rounded-3xl hover:bg-red-50 text-red-400 hover:text-red-600 transition-all active:scale-[0.85] active:bg-red-100"
          >
            <XCircle size={36} className="group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Reject (N)</span>
          </button>
          
          <div className="h-16 w-px bg-slate-100" />
          
          <button 
            onClick={() => handleAction('confirmed')}
            className="group flex flex-col items-center gap-2 w-48 py-6 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-2xl shadow-indigo-200 active:scale-95 active:shadow-none"
          >
            <CheckCircle2 size={44} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Confirm (Y)</span>
          </button>
          
          <div className="h-16 w-px bg-slate-100" />

          <button 
            onClick={() => handleAction('skipped')}
            className="group flex flex-col items-center gap-2 w-28 py-4 rounded-3xl hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-all active:scale-[0.85]"
          >
            <SkipForward size={36} className="group-hover:translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Skip (S)</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
            <button className="group flex items-center gap-3 px-8 py-3 bg-white border border-slate-100 hover:border-indigo-100 rounded-2xl text-[11px] font-black text-slate-400 hover:text-indigo-600 transition-all shadow-sm hover:shadow-xl active:scale-95">
                <Search size={16} className="group-hover:scale-110 transition-transform" /> 
                Manual Research (E)
            </button>
            <div className="flex items-center gap-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.25em]">
                <span>Shortcuts</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-400">Y</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-400">N</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-400">S</span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-400">← →</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;
