
import React, { useState } from 'react';
import { 
  Film, Search, Play, CheckCircle, AlertCircle, Loader2, 
  ChevronDown, ExternalLink, Heart, Eye, User, X, 
  Square, CheckSquare, CloudUpload, Info, Database
} from 'lucide-react';
import { Job, Match, VideoDiscoveryResult, VideoInjectionStatus } from '../types';
import { useStore } from '../store';

interface Props {
  job: Job;
}

const VIDEO_LIMIT = 3;

export default function VideoInjectorPage({ job }: Props) {
  const { updateMatchVideoStatus, settings } = useStore();
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null);
  const [injectingIndex, setInjectingIndex] = useState<number | null>(null);
  
  const isDarkMode = settings.theme === 'dark';
  const matches = job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed');

  const getStatusBadge = (status?: VideoInjectionStatus) => {
    switch (status) {
      case 'discovering':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest"><Loader2 size={12} className="animate-spin" /> Discovering</span>;
      case 'ready_for_review':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest"><CheckSquare size={12} /> Ready for review</span>;
      case 'injected':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest"><CheckCircle size={12} /> Injected</span>;
      case 'error':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest"><AlertCircle size={12} /> Error</span>;
      default:
        return <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Not started</span>;
    }
  };

  const handleRunDiscovery = async (index: number) => {
    const match = matches[index];
    const realIndex = job.matches.indexOf(match);
    
    updateMatchVideoStatus(job.id, realIndex, 'discovering');
    
    // Simulate external scraper request (Apify)
    await new Promise(r => setTimeout(r, 2000));
    
    // Mocked discovery results
    const mockResults: VideoDiscoveryResult[] = [
      {
        id: crypto.randomUUID(),
        source_url: `https://www.tiktok.com/@foodie/video/${Math.random().toString(36).substring(7)}`,
        thumbnail_url: `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80`,
        view_count: 12500,
        like_count: 850,
        caption: `Best carbonara in ${match.googleData.street || 'London'}! Absolute hidden gem. #londonfoodie`,
        author_handle: 'pasta_lover_99'
      },
      {
        id: crypto.randomUUID(),
        source_url: `https://www.tiktok.com/@eats/video/${Math.random().toString(36).substring(7)}`,
        thumbnail_url: `https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=300&q=80`,
        view_count: 45000,
        like_count: 3200,
        caption: `You HAVE to visit ${match.googleData.title}. The vibes are immaculate ✨`,
        author_handle: 'london_eats'
      },
      {
        id: crypto.randomUUID(),
        source_url: `https://www.tiktok.com/@vibe/video/${Math.random().toString(36).substring(7)}`,
        thumbnail_url: `https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=300&q=80`,
        view_count: 8900,
        like_count: 450,
        caption: `Cocktail masterclass at this spot. Highly recommend! 🍸`,
        author_handle: 'cocktail_queen'
      },
      {
        id: crypto.randomUUID(),
        source_url: `https://www.tiktok.com/@night/video/${Math.random().toString(36).substring(7)}`,
        thumbnail_url: `https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=300&q=80`,
        view_count: 3200,
        like_count: 120,
        caption: `Late night snack run. Can't go wrong here.`,
        author_handle: 'midnight_munchies'
      }
    ];

    updateMatchVideoStatus(job.id, realIndex, 'ready_for_review', mockResults, []);
  };

  const toggleVideoSelection = (matchIndex: number, videoId: string) => {
    const match = matches[matchIndex];
    const realIndex = job.matches.indexOf(match);
    const currentSelection = match.selectedVideos || [];
    
    let newSelection;
    if (currentSelection.includes(videoId)) {
      newSelection = currentSelection.filter(id => id !== videoId);
    } else {
      if (currentSelection.length >= VIDEO_LIMIT) return;
      newSelection = [...currentSelection, videoId];
    }
    
    updateMatchVideoStatus(job.id, realIndex, match.videoStatus || 'ready_for_review', match.discoveryResults, newSelection);
  };

  const handleAttachVideos = async (index: number) => {
    const match = matches[index];
    const realIndex = job.matches.indexOf(match);
    
    setInjectingIndex(index);
    
    try {
      // Step 1: Simulated Download & Storage Upload
      await new Promise(r => setTimeout(r, 2500));
      
      // Step 2: Simulated Database Insertion
      console.log(`📌 Injecting ${match.selectedVideos?.length} videos for ${match.googleData.title}`);
      
      updateMatchVideoStatus(job.id, realIndex, 'injected');
      setReviewingIndex(null);
    } catch (err) {
      updateMatchVideoStatus(job.id, realIndex, 'error');
    } finally {
      setInjectingIndex(null);
    }
  };

  return (
    <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
             <Film size={40} className="text-indigo-600" /> Video Injector Pipeline
          </h2>
          <p className="text-slate-500 font-medium mt-2">Discover, review, and inject high-quality TikTok content for {matches.length} restaurants.</p>
        </div>
        <div className="bg-white/50 border border-slate-100 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
           <Info size={18} className="text-indigo-500" />
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limit: 3 Videos Per Restaurant</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Restaurant</th>
              <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
              <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Injection Status</th>
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {matches.map((match, idx) => (
              <React.Fragment key={idx}>
                <tr className={`hover:bg-slate-50/30 transition-colors ${reviewingIndex === idx ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                        <Film size={18} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 leading-tight">{match.googleData.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{match.googleData.google_place_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <p className="text-sm font-bold text-slate-600">{match.googleData.street || 'Soho'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">London, UK</p>
                  </td>
                  <td className="px-6 py-6">
                    {getStatusBadge(match.videoStatus)}
                  </td>
                  <td className="px-10 py-6 text-right">
                    {match.videoStatus === 'ready_for_review' ? (
                      <button 
                        onClick={() => setReviewingIndex(reviewingIndex === idx ? null : idx)}
                        className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                      >
                        {reviewingIndex === idx ? 'Close Review' : 'Review Results'}
                      </button>
                    ) : match.videoStatus === 'injected' ? (
                      <button disabled className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest cursor-default flex items-center gap-2 ml-auto">
                        <CheckCircle size={14} /> Completed
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleRunDiscovery(idx)}
                        disabled={match.videoStatus === 'discovering'}
                        className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95 flex items-center gap-2 ml-auto disabled:opacity-50"
                      >
                        {match.videoStatus === 'discovering' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Run TikTok Discovery
                      </button>
                    )}
                  </td>
                </tr>
                {reviewingIndex === idx && match.discoveryResults && (
                  <tr className="bg-indigo-50/20 border-b border-indigo-100 animate-in slide-in-from-top-2">
                    <td colSpan={4} className="px-10 py-10">
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                           <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">
                             🎥 Discovered Content ({match.discoveryResults.length} videos)
                           </h4>
                           <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                              Selected: {match.selectedVideos?.length || 0} / {VIDEO_LIMIT}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {match.discoveryResults.map((video) => {
                            const isSelected = match.selectedVideos?.includes(video.id);
                            const canSelect = isSelected || (match.selectedVideos?.length || 0) < VIDEO_LIMIT;
                            
                            return (
                              <div 
                                key={video.id} 
                                onClick={() => canSelect && toggleVideoSelection(idx, video.id)}
                                className={`group relative bg-white rounded-3xl border transition-all cursor-pointer overflow-hidden ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10 scale-[1.02] shadow-xl' : 'border-slate-100 hover:border-slate-300'} ${!canSelect && !isSelected ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                              >
                                <div className="aspect-[9/16] relative bg-slate-900">
                                   <img src={video.thumbnail_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                      <p className="text-white text-[10px] font-medium leading-relaxed line-clamp-2">
                                        {video.caption}
                                      </p>
                                   </div>
                                   <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/20 border-white/40'}`}>
                                      {isSelected && <CheckCircle size={14} />}
                                   </div>
                                </div>
                                <div className="p-4 space-y-3">
                                   <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                                         <User size={12} className="text-slate-400" />
                                      </div>
                                      <span className="text-[10px] font-black text-slate-600">@{video.author_handle}</span>
                                   </div>
                                   <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                         <Eye size={12} /> {(video.view_count / 1000).toFixed(1)}k
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                         <Heart size={12} /> {(video.like_count / 1000).toFixed(1)}k
                                      </div>
                                   </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col items-center pt-4 border-t border-indigo-100">
                           <button 
                             onClick={() => handleAttachVideos(idx)}
                             disabled={!match.selectedVideos?.length || injectingIndex !== null}
                             className="group px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 shadow-2xl transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                           >
                             {injectingIndex === idx ? <Loader2 size={24} className="animate-spin" /> : <Database size={24} />}
                             {injectingIndex === idx ? 'Processing Injection...' : `Attach ${match.selectedVideos?.length || 0} Selected Videos`}
                           </button>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-6 flex items-center gap-2">
                              <CloudUpload size={14} className="text-emerald-500" /> Downloads MP4 & Syncs to Supabase Storage
                           </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
      `}} />
    </div>
  );
}
