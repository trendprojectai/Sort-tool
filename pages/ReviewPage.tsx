
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
  Info
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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">No matches to review</h3>
        <p className="text-gray-500 max-w-xs mx-auto mt-2">All matches have been processed or none were found in this dataset.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Top Bar Stats */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between sticky top-[72px] z-40 backdrop-blur-md bg-white/90">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reviewed</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{confirmedCount + rejectedCount}</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-500 text-sm">{totalCount}</span>
            </div>
          </div>
          <div className="h-10 w-px bg-gray-100" />
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</div>
            <div className="flex gap-2">
              <button onClick={() => setFilter('All')} className={`px-2 py-1 rounded text-xs font-semibold ${filter === 'All' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>All</button>
              <button onClick={() => setFilter('High')} className={`px-2 py-1 rounded text-xs font-semibold ${filter === 'High' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>High</button>
              <button onClick={() => setFilter('Medium')} className={`px-2 py-1 rounded text-xs font-semibold ${filter === 'Medium' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Medium</button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setReviewIndex(Math.max(0, currentReviewIndex - 1))}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="font-mono text-sm font-bold text-gray-400 px-3">
            {currentReviewIndex + 1} of {totalCount}
          </span>
          <button 
            onClick={() => setReviewIndex(Math.min(totalCount - 1, currentReviewIndex + 1))}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 mt-8">
        {/* OSM Card */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 px-4 py-2 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl">
            OSM Source
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-6 mt-8">{currentMatch.osmData.name}</h3>
          
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <MapPin className="text-gray-400 mt-1" size={18} />
              <div>
                <p className="text-sm font-semibold text-gray-700">{currentMatch.osmData['addr:street'] || 'Street not provided'}</p>
                <p className="text-xs text-gray-500">{currentMatch.osmData['addr:postcode'] || 'No Postcode'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Star className="text-gray-400" size={18} />
              <p className="text-sm text-gray-600">{currentMatch.osmData.cuisine || 'Cuisine unspecified'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Info className="text-gray-400" size={18} />
              <code className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-500">{currentMatch.osmData['@id']}</code>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-50 flex justify-between items-center">
            <a href={`https://www.openstreetmap.org/${currentMatch.osmData['@id']}`} target="_blank" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
              View on OSM <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Center Analysis */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center gap-4 py-4">
           <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
             currentMatch.confidence === 'High' ? 'border-green-100 text-green-600 bg-green-50' : 
             currentMatch.confidence === 'Medium' ? 'border-amber-100 text-amber-600 bg-amber-50' : 'border-red-100 text-red-600 bg-red-50'
           }`}>
             <span className="text-xl font-black">{Math.round(currentMatch.score)}%</span>
           </div>
           <div className="text-center">
             <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Match Confidence</p>
             <p className={`text-xs font-bold ${
               currentMatch.confidence === 'High' ? 'text-green-600' : 
               currentMatch.confidence === 'Medium' ? 'text-amber-600' : 'text-red-600'
             }`}>{currentMatch.confidence}</p>
           </div>
           {currentMatch.method === 'manual_verified' && (
             <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold animate-pulse">
               MANUAL VERIFIED
             </div>
           )}
           <div className="h-20 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
        </div>

        {/* Google Card */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-gray-100 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 px-4 py-2 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl">
            Google Maps
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-6 mt-8">{currentMatch.googleData.title}</h3>

          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <MapPin className="text-gray-400 mt-1" size={18} />
              <div>
                <p className="text-sm font-semibold text-gray-700">{currentMatch.googleData.street}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Star className="text-amber-400 fill-amber-400" size={18} />
              <p className="text-sm text-gray-700 font-bold">{currentMatch.googleData.totalScore} <span className="text-gray-400 font-medium">({currentMatch.googleData.reviewsCount} reviews)</span></p>
            </div>
            {currentMatch.googleData.phone && (
              <div className="flex items-center gap-3">
                <Phone className="text-gray-400" size={18} />
                <p className="text-sm text-gray-600">{currentMatch.googleData.phone}</p>
              </div>
            )}
            {currentMatch.googleData.website && (
              <div className="flex items-center gap-3">
                <Globe className="text-gray-400" size={18} />
                <p className="text-sm text-blue-600 truncate">{currentMatch.googleData.website.replace('https://', '')}</p>
              </div>
            )}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-50">
            <a href={currentMatch.googleData.url} target="_blank" className="text-emerald-600 hover:underline text-xs flex items-center gap-1">
              View on Google Maps <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-6 mt-4">
        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-lg border border-gray-100">
          <button 
            onClick={() => handleAction('rejected')}
            className="flex flex-col items-center gap-1 px-8 py-3 rounded-2xl hover:bg-red-50 text-red-600 transition-all active:scale-95 group"
          >
            <XCircle size={32} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">REJECT (N)</span>
          </button>
          
          <div className="h-12 w-px bg-gray-100" />
          
          <button 
            onClick={() => handleAction('confirmed')}
            className="flex flex-col items-center gap-1 px-12 py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white transition-all shadow-xl shadow-green-100 active:scale-95 group"
          >
            <CheckCircle2 size={40} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-black uppercase tracking-widest">CONFIRM (Y)</span>
          </button>
          
          <div className="h-12 w-px bg-gray-100" />

          <button 
            onClick={() => handleAction('skipped')}
            className="flex flex-col items-center gap-1 px-8 py-3 rounded-2xl hover:bg-gray-100 text-gray-500 transition-all active:scale-95 group"
          >
            <SkipForward size={32} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">SKIP (S)</span>
          </button>
        </div>

        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors py-2 px-4 rounded-full border border-gray-100 hover:border-blue-100">
          <Search size={16} /> Search for Better Match (E)
        </button>
        
        <p className="text-[10px] text-gray-400 font-mono">
          Shortcuts: Y=Confirm | N=Reject | S=Skip | E=Search | ←→=Navigate
        </p>
      </div>
    </div>
  );
};

export default ReviewPage;
