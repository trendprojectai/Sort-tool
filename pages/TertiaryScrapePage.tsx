import React, { useState } from 'react';
import { 
  Compass, Play, Database, AlertCircle, Loader2, 
  ExternalLink, List, CloudUpload, Film, Package, 
  CheckCircle2, MessageSquare, Image as ImageIcon,
  Zap, ArrowRight
} from 'lucide-react';
import { Job, Match } from '../types';
import { useStore } from '../store';
import { pythonServerManager } from '../lib/pythonServerManager';
import { MainSection } from '../App';
import { generateExportData } from '../lib/utils';
import Papa from 'papaparse';

interface Props {
  job: Job;
  onNavigate: (section: MainSection) => void;
}

export default function TertiaryScrapePage({ job, onNavigate }: Props) {
  const { 
    setTertiaryStatus, 
    tertiaryProcessingStatus, 
    settings, 
    updateJobWithEnrichment,
    setFinalEnrichedDataset,
    pushToVideoInjector,
    setActiveCsvDataset
  } = useStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  
  const isDarkMode = settings.theme === 'dark';
  
  // Rule: Table MUST render from job.matches to ensure persistence across re-renders
  const matches = job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed');

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    setErrorMessage(null);
    
    // Logic: Identify confirmed matches for snapshot
    const confirmedMatches = job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed');
    
    try {
      // 1. Generate current dataset CSV from confirmed matches
      const exportData = generateExportData(confirmedMatches);
      const csvData = Papa.unparse(exportData);
      
      console.log('🚀 Snapshot Request Payload (CSV Data):', csvData);
      
      // 2. Push to backend and AWAIT response
      const response = await pythonServerManager.createTertiarySnapshot(csvData);
      
      console.log('✅ Snapshot Backend Response:', response);
      
      // 3. Update store and persist state
      // This locks the dataset and updates UI state without clearing rows
      updateJobWithEnrichment(job.id, {
        ...job,
        tertiary_snapshot_id: response.snapshot_id,
        tertiary_snapshot_count: response.row_count,
        activeCsvDataset: exportData // Lock current state as the active dataset
      });
      
      console.log('💾 Stored tertiary_snapshot_id:', response.snapshot_id);
    } catch (err: any) {
      console.error('❌ Snapshot Creation Failed:', err);
      setErrorMessage(`Snapshot failed: ${err.message}`);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRunTertiaryScrape = async () => {
    if (!job.tertiary_snapshot_id) {
        setErrorMessage("Cannot run scrape: No snapshot ID found. Please create a snapshot first.");
        return;
    }

    setIsProcessing(true);
    setTertiaryStatus('processing');
    setErrorMessage(null);

    try {
      console.log('🔍 Initiating TripAdvisor Scrape for Snapshot ID:', job.tertiary_snapshot_id);
      const results = await pythonServerManager.tertiaryEnrich(job.tertiary_snapshot_id);
      console.log('✅ Tertiary Enrichment Results Received:', results.length);
      
      const updatedMatches = [...job.matches];
      
      results.forEach((result: any) => {
        const matchIndex = updatedMatches.findIndex(m => {
          const gid = m.googleData.google_place_id || m.googleData.url?.split('query_place_id=')[1]?.split('&')[0];
          return gid === result.google_place_id;
        });

        if (matchIndex !== -1) {
          const original = updatedMatches[matchIndex];
          
          // Merge logic: Add TripAdvisor specific data to existing match
          const merged: Match = {
            ...original,
            enriched_opening_hours: original.enriched_opening_hours || result.opening_hours,
            cuisine_type: original.cuisine_type || result.cuisine_type,
            price_range: original.price_range || result.price_range,
            enriched_phone: original.enriched_phone || result.phone,
            tripadvisor_status: result.tripadvisor_status,
            tripadvisor_url: result.tripadvisor_url,
            tripadvisor_confidence: result.tripadvisor_confidence,
            tripadvisor_distance_m: result.tripadvisor_distance_m,
            tripadvisor_match_notes: result.tripadvisor_match_notes,
            tripadvisor_images: result.tripadvisor_images || [],
            tertiary_status: 'completed' as const
          };
          
          updatedMatches[matchIndex] = merged;
        }
      });

      // Update active dataset for export and video injection
      const finalData = generateExportData(updatedMatches);
      setFinalEnrichedDataset(job.id, finalData);
      setActiveCsvDataset(job.id, finalData);

      updateJobWithEnrichment(job.id, {
        ...job,
        matches: updatedMatches,
        tertiary_at: new Date().toISOString(),
        finalEnrichedDataset: finalData,
        activeCsvDataset: finalData
      });

      setTertiaryStatus('completed');
    } catch (err: any) {
      console.error('❌ Tertiary Scrape Failed:', err);
      setErrorMessage(`Scrape failed: ${err.message}`);
      setTertiaryStatus('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInjectMedia = () => {
    setIsInjecting(true);
    setTimeout(() => {
      // Logic: Merge TA images into the main gallery images for matches
      const updatedMatches = job.matches.map(m => {
        if (m.tripadvisor_images && m.tripadvisor_images.length > 0) {
          const currentGallery = m.gallery_images || [];
          return {
            ...m,
            gallery_images: Array.from(new Set([...currentGallery, ...m.tripadvisor_images]))
          };
        }
        return m;
      });

      const finalData = generateExportData(updatedMatches);
      updateJobWithEnrichment(job.id, {
        ...job,
        matches: updatedMatches,
        activeCsvDataset: finalData
      });
      
      setIsInjecting(false);
      alert('TripAdvisor images successfully injected into the main gallery fields.');
    }, 1000);
  };

  const handlePushToExport = () => onNavigate('export');
  const handlePushToVideo = () => {
    pushToVideoInjector(job.id);
    onNavigate('video');
  };

  return (
    <div className="w-full max-w-full animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-10 px-6">
        <div>
          <h2 className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'} tracking-tight flex items-center gap-3`}>
             <Compass size={40} className="text-amber-500" /> Tertiary Pipeline (TripAdvisor)
          </h2>
          <p className="text-slate-500 font-medium mt-2">Verified Profile Extraction & Deep Metadata Validation.</p>
        </div>
        <div className="flex items-center gap-4">
          {!job.tertiary_snapshot_id ? (
            <button 
              onClick={handleCreateSnapshot}
              disabled={isCreatingSnapshot || matches.length === 0}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isCreatingSnapshot ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
              Create Tertiary Snapshot
            </button>
          ) : (
            <button 
              onClick={handleRunTertiaryScrape}
              disabled={isProcessing || tertiaryProcessingStatus === 'completed'}
              className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all active:scale-95 ${
                tertiaryProcessingStatus === 'completed' 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : isProcessing 
                    ? 'bg-amber-100 text-amber-600' 
                    : 'bg-slate-900 text-white hover:bg-amber-600'
              } disabled:opacity-50`}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              {tertiaryProcessingStatus === 'completed' ? 'Cloud Scrape Complete' : 'Run TripAdvisor Scrape'}
            </button>
          )}
        </div>
      </div>

      {job.tertiary_snapshot_id && tertiaryProcessingStatus !== 'completed' && (
        <div className="mb-8 mx-6 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-between gap-4 text-emerald-800 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-500" />
            <p className="font-black">Snapshot created ({job.tertiary_snapshot_count || matches.length} restaurants)</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white border border-emerald-100 rounded-lg">
            ID: {job.tertiary_snapshot_id}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-8 mx-6 p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-800 animate-in slide-in-from-top-2">
          <AlertCircle size={24} />
          <p className="font-bold">{errorMessage}</p>
        </div>
      )}

      {tertiaryProcessingStatus === 'completed' && (
        <div className="mb-10 mx-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
          <button 
            onClick={handleInjectMedia}
            disabled={isInjecting}
            className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               {isInjecting ? <Loader2 size={32} className="animate-spin" /> : <Package size={32} />}
            </div>
            <h4 className="font-black text-slate-800">Inject Media</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Write TA Images to CSV</p>
          </button>

          <button 
            onClick={handlePushToExport}
            className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <CloudUpload size={32} />
            </div>
            <h4 className="font-black text-slate-800">Export CSV</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Final Dataset Forward</p>
          </button>

          <button 
            onClick={handlePushToVideo}
            className="p-8 bg-slate-900 text-white rounded-[2rem] shadow-xl hover:bg-indigo-600 transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-16 h-16 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <Film size={32} />
            </div>
            <h4 className="font-black">Send to Video Injector</h4>
            <p className="text-[10px] text-white/40 font-bold uppercase mt-2 leading-relaxed">Unchanged Dataset Sync</p>
          </button>
        </div>
      )}

      <div className={`mx-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border rounded-[2.5rem] shadow-xl overflow-hidden`}>
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <List size={18} className="text-slate-400" />
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Validation Ledger</h4>
          </div>
          {job.tertiary_snapshot_id && (
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase tracking-widest border border-indigo-100">
              Snapshot Active
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Restaurant</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Confidence</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Dist (m)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">TripAdvisor URL</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Assets</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Audit Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matches.map((m, idx) => {
                const status = m.tripadvisor_status || 'not_attempted';
                const confidence = m.tripadvisor_confidence || 0;
                const isMatchFound = status === 'found' && !!m.tripadvisor_url && confidence >= 0.75;
                const isNoMatch = status === 'not_found';
                const isRunning = status === 'searching' || (isProcessing && status === 'not_attempted');

                return (
                  <tr key={idx} className={`hover:bg-slate-50/20 transition-colors ${isMatchFound ? 'bg-emerald-50/10' : ''}`}>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center text-slate-300">
                           {m.cover_image ? <img src={m.cover_image} className="w-full h-full object-cover" /> : <Compass size={18} />}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 leading-tight">{m.googleData.title}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase truncate max-w-[150px]">{m.googleData.google_place_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${
                          isMatchFound ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 
                          isRunning ? 'bg-amber-500 animate-pulse' : 
                          isNoMatch ? 'bg-red-500' : 'bg-slate-300'
                        }`} />
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className={`text-[10px] font-black ${confidence >= 0.75 ? 'text-emerald-600' : confidence > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                         {confidence > 0 ? `${Math.round(confidence * 100)}%` : '--'}
                       </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className="text-[10px] font-bold text-slate-500">
                         {m.tripadvisor_distance_m !== null ? `${m.tripadvisor_distance_m}` : '--'}
                       </span>
                    </td>
                    <td className="px-6 py-6">
                      {m.tripadvisor_url ? (
                        <a 
                          href={m.tripadvisor_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1.5 text-[10px] font-bold bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50"
                        >
                          <span className="truncate max-w-[180px]">{m.tripadvisor_url.replace('https://www.tripadvisor.com/', '')}</span>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">No link verified</span>
                      )}
                    </td>
                    <td className="px-6 py-6">
                       <div className="flex items-center justify-center gap-1">
                          {m.tripadvisor_images && m.tripadvisor_images.length > 0 ? (
                            <div className="flex -space-x-2">
                               {m.tripadvisor_images.slice(0, 3).map((img, i) => (
                                 <img key={i} src={img} className="w-6 h-6 rounded-full border-2 border-white object-cover shadow-sm" />
                               ))}
                               {m.tripadvisor_images.length > 3 && (
                                 <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-500">
                                   +{m.tripadvisor_images.length - 3}
                                 </div>
                               )}
                            </div>
                          ) : (
                            <ImageIcon size={14} className="text-slate-200" />
                          )}
                       </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                       <div className="flex items-center gap-2 justify-end group cursor-help">
                          <p className="text-[10px] text-slate-500 italic truncate max-w-[150px] font-medium" title={m.tripadvisor_match_notes || ''}>
                             {m.tripadvisor_match_notes || '--'}
                          </p>
                          <MessageSquare size={12} className="text-slate-300" />
                       </div>
                    </td>
                  </tr>
                );
              })}
              {matches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-10 py-20 text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">No confirmed matches in current workspace</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 mx-6 p-8 bg-indigo-50/30 border border-indigo-100 rounded-[2.5rem] flex items-start gap-5 mb-10">
         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
           <Zap size={24} />
         </div>
         <div>
           <h4 className="font-black text-indigo-900 mb-1">Deep Scraper Truth Engine</h4>
           <p className="text-indigo-700/70 text-sm font-medium leading-relaxed">
             Stage 3 performs verified physical proximity matching against the TripAdvisor Global Index. Results are returned with high-fidelity match notes and confirmed image assets directly from restaurant schema markups.
           </p>
         </div>
      </div>
    </div>
  );
}