import React, { useState, useEffect } from 'react';
import { 
  Compass, Play, Database, AlertCircle, Loader2, 
  ExternalLink, List, CloudUpload, Film, Package, 
  CheckCircle2, MessageSquare, Image as ImageIcon,
  Zap, ArrowRight, RefreshCw, Clock, Info, ShieldAlert,
  Search, History
} from 'lucide-react';
import { Job, Match } from '../types';
import { useStore } from '../store';
import { pythonServerManager } from '../lib/pythonServerManager';
import { MainSection } from '../App';
import { generateExportData, normalizeName } from '../lib/utils';
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
  const confirmedMatches = job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed');

  // Hard state persistence checks
  const hasSnapshotId = !!(job.tertiarySnapshotId || job.tertiary_snapshot_id);
  const isEnriched = job.stage === 'TERTIARY_ENRICHED' || tertiaryProcessingStatus === 'completed';

  /**
   * SNAPSHOT LIFECYCLE RULE:
   * Snapshot IDs are ephemeral. If the page reloads, we force recreation to avoid 404 errors.
   */
  useEffect(() => {
    if (job.stage === "TERTIARY_SNAPSHOT_CREATED" && hasSnapshotId) {
       console.log("♻️ [Lifecycle] Page/Session reload detected. Resetting temporary snapshot ID to ensure fresh state.");
       handleResetSnapshot();
    }
  }, []);

  const handleResetSnapshot = () => {
    updateJobWithEnrichment(job.id, {
      ...job,
      tertiarySnapshotId: undefined,
      tertiary_snapshot_id: undefined,
      stage: "SECONDARY_COMPLETE" // Revert to ready state
    });
  };

  const handleCreateSnapshot = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirmedMatches.length === 0) {
      setErrorMessage("No confirmed matches found to snapshot.");
      return;
    }

    setIsCreatingSnapshot(true);
    setErrorMessage(null);
    
    try {
      const exportData = generateExportData(confirmedMatches);
      const csvData = Papa.unparse(exportData);
      
      const response = await pythonServerManager.createTertiarySnapshot(csvData);
      
      if (!response.tertiary_snapshot_id) {
        throw new Error("Backend failed to return a valid tertiary_snapshot_id.");
      }
      
      const updatedJob: Job = {
        ...job,
        tertiarySnapshotId: response.tertiary_snapshot_id,
        tertiary_snapshot_id: response.tertiary_snapshot_id,
        tertiary_snapshot_count: response.row_count,
        stage: "TERTIARY_SNAPSHOT_CREATED",
        lockedDataset: true,
        activeCsvDataset: exportData,
        updated_at: new Date().toISOString()
      };

      updateJobWithEnrichment(job.id, updatedJob);
      
    } catch (err: any) {
      setErrorMessage(`Snapshot failed: ${err.message || 'Unknown network error'}`);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRunTertiaryScrape = async () => {
    const snapshotId = job.tertiarySnapshotId || job.tertiary_snapshot_id;
    
    if (!snapshotId) {
        setErrorMessage("Snapshot required. Please click 'Create Tertiary Snapshot' first.");
        return;
    }

    setIsProcessing(true);
    setTertiaryStatus('processing');
    setErrorMessage(null);

    try {
      const fullResponse = await pythonServerManager.tertiaryEnrich(snapshotId);
      
      if (fullResponse.action === "RECREATE_SNAPSHOT") {
        setErrorMessage("Snapshot expired or invalidated by server. Please recreate the snapshot.");
        handleResetSnapshot();
        setIsProcessing(false);
        setTertiaryStatus('idle');
        return;
      }

      const results = fullResponse.results || 
                      fullResponse.enriched_rows || 
                      fullResponse.data || 
                      (Array.isArray(fullResponse) ? fullResponse : []);

      if (!Array.isArray(results)) {
        throw new Error("Invalid response format: No results field found in backend response.");
      }

      if (results.length === 0) {
        setErrorMessage("Scrape complete, but no verified TripAdvisor matches were found. You can still proceed with manual data.");
      }

      const updatedMatches = [...job.matches];
      
      results.forEach((result: any) => {
        const matchIndex = updatedMatches.findIndex(m => {
          const gid = m.googleData.google_place_id || m.googleData.url?.split('query_place_id=')[1]?.split('&')[0];
          return gid === result.google_place_id;
        });

        if (matchIndex !== -1) {
          const original = updatedMatches[matchIndex];
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

      const finalData = generateExportData(updatedMatches);
      setFinalEnrichedDataset(job.id, finalData);
      setActiveCsvDataset(job.id, finalData);

      updateJobWithEnrichment(job.id, {
        ...job,
        matches: updatedMatches,
        tertiary_at: new Date().toISOString(),
        finalEnrichedDataset: finalData,
        activeCsvDataset: finalData,
        stage: "TERTIARY_ENRICHED"
      });

      setTertiaryStatus('completed');
    } catch (err: any) {
      if (err.message.includes('404') || err.message.toLowerCase().includes('not found') || err.message.includes('expired')) {
         setErrorMessage("Snapshot invalid or expired. Please recreate the snapshot.");
         handleResetSnapshot();
      } else {
         setErrorMessage(`Scrape failed: ${err.message}`);
      }
      setTertiaryStatus('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInjectMedia = () => {
    setIsInjecting(true);
    setTimeout(() => {
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

  const getDetailedStatus = (match: Match) => {
    const status = match.tripadvisor_status || 'not_attempted';
    const confidence = match.tripadvisor_confidence || 0;
    const notes = (match.tripadvisor_match_notes || '').toLowerCase();

    if (status === 'searching' || (isProcessing && status === 'not_attempted')) {
      return { label: 'Searching...', color: 'bg-indigo-400 animate-pulse', textColor: 'text-indigo-600' };
    }
    
    if (status === 'found') {
      if (confidence >= 0.75) return { label: 'Verified Match', color: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]', textColor: 'text-emerald-600' };
      if (confidence >= 0.6) return { label: 'Review Suggested', color: 'bg-amber-400', textColor: 'text-amber-500' };
      if (confidence >= 0.4) return { label: 'Weak Match Found', color: 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]', textColor: 'text-yellow-600' };
      return { label: 'Rejected (Low Confidence)', color: 'bg-orange-500', textColor: 'text-orange-600' };
    }
    
    if (status === 'not_found') {
      if (notes.includes('distance')) return { label: 'Rejected (Distance)', color: 'bg-orange-500', textColor: 'text-orange-600' };
      if (notes.includes('confidence') || notes.includes('low')) return { label: 'Rejected (Confidence)', color: 'bg-orange-500', textColor: 'text-orange-600' };
      return { label: 'No Candidates Found', color: 'bg-slate-400', textColor: 'text-slate-500' };
    }

    if (match.tertiary_status === 'error') {
      return { label: 'Search Error', color: 'bg-red-500', textColor: 'text-red-600' };
    }

    return { label: 'Staged', color: 'bg-slate-300', textColor: 'text-slate-400' };
  };

  return (
    <div className="w-full max-w-full animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-10 px-6">
        <div>
          <h2 className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'} tracking-tight flex items-center gap-3`}>
             <Compass size={40} className="text-amber-500" /> Tertiary Pipeline (TripAdvisor)
          </h2>
          <p className="text-slate-500 font-medium mt-2">Identity Verification & Global Index Sync.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot || isEnriched || hasSnapshotId}
            className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all active:scale-95 ${
              hasSnapshotId ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {isCreatingSnapshot ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
            {hasSnapshotId ? 'Snapshot Active' : 'Create Tertiary Snapshot'}
          </button>

          <button 
            type="button"
            onClick={handleRunTertiaryScrape}
            disabled={isProcessing || isEnriched || !hasSnapshotId}
            className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all active:scale-95 ${
              isEnriched
                ? 'bg-emerald-100 text-emerald-600' 
                : isProcessing 
                  ? 'bg-amber-100 text-amber-600' 
                  : !hasSnapshotId ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:bg-amber-600'
            } disabled:opacity-50`}
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {isEnriched ? 'Scrape Complete' : 'Run TripAdvisor Scrape'}
          </button>
        </div>
      </div>

      {hasSnapshotId && !isEnriched && (
        <div className="mb-8 mx-6 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-between gap-4 text-emerald-800 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-500" />
            <div>
              <p className="font-black">Snapshot Ready ({job.tertiary_snapshot_count || confirmedMatches.length} restaurants)</p>
              <p className="text-[10px] font-bold opacity-60 flex items-center gap-1 mt-0.5">
                <Clock size={10} /> Ephemeral session ID: {job.tertiarySnapshotId || job.tertiary_snapshot_id}
              </p>
            </div>
          </div>
          <button 
            onClick={handleCreateSnapshot}
            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors"
            title="Recreate Snapshot"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-8 mx-6 p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-800 animate-in slide-in-from-top-2">
          <ShieldAlert size={24} />
          <div className="flex-1">
            <p className="font-black">Operation Insight</p>
            <p className="text-sm font-bold opacity-80">{errorMessage}</p>
          </div>
          {errorMessage.includes("expired") && (
            <button 
              onClick={handleCreateSnapshot}
              className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700"
            >
              Recreate Snapshot
            </button>
          )}
        </div>
      )}

      {isEnriched && (
        <div className="mb-10 mx-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
          <button 
            type="button"
            onClick={handleInjectMedia}
            disabled={isInjecting}
            className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               {isInjecting ? <Loader2 size={32} className="animate-spin" /> : <Package size={32} />}
            </div>
            <h4 className="font-black text-slate-800">Inject Media</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Persist TA Assets</p>
          </button>

          <button 
            type="button"
            onClick={handlePushToExport}
            className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <CloudUpload size={32} />
            </div>
            <h4 className="font-black text-slate-800">Final Export</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">Download Scrape Results</p>
          </button>

          <button 
            type="button"
            onClick={handlePushToVideo}
            className="p-8 bg-slate-900 text-white rounded-[2rem] shadow-xl hover:bg-indigo-600 transition-all flex flex-col items-center text-center group active:scale-95"
          >
            <div className="w-16 h-16 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <Film size={32} />
            </div>
            <h4 className="font-black text-white">Video Injector</h4>
            <p className="text-[10px] text-white/40 font-bold uppercase mt-2 leading-relaxed">Proceed to Discovery</p>
          </button>
        </div>
      )}

      <div className={`mx-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border rounded-[2.5rem] shadow-xl overflow-hidden`}>
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <List size={18} className="text-slate-400" />
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Validation Intelligence Ledger</h4>
          </div>
          {hasSnapshotId && (
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase tracking-widest border border-indigo-100">
              {isEnriched ? 'Verified Truth' : 'Snapshot Staged'}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Restaurant</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Outcome</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Confidence</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Dist (m)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity Link</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Assets</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Truth Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed').map((m, idx) => {
                const detailedStatus = getDetailedStatus(m);
                const confidence = m.tripadvisor_confidence || 0;
                const status = m.tripadvisor_status || 'not_attempted';
                
                return (
                  <tr key={idx} className={`hover:bg-slate-50/20 transition-colors ${confidence >= 0.75 ? 'bg-emerald-50/10' : confidence >= 0.4 ? 'bg-yellow-50/10' : ''}`}>
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
                    <td className="px-6 py-6">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className={`w-3 h-3 rounded-full ${detailedStatus.color}`} />
                        <span className={`text-[8px] font-black uppercase tracking-tighter text-center leading-none ${detailedStatus.textColor}`}>
                          {detailedStatus.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className={`text-[11px] font-black ${confidence >= 0.75 ? 'text-emerald-600' : confidence >= 0.6 ? 'text-amber-500' : confidence >= 0.4 ? 'text-yellow-600' : confidence > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                         {confidence > 0 ? `${Math.round(confidence * 100)}%` : '--'}
                       </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                       <span className={`text-[10px] font-bold ${m.tripadvisor_distance_m && m.tripadvisor_distance_m > 150 ? 'text-orange-400' : 'text-slate-500'}`}>
                         {m.tripadvisor_distance_m !== null && m.tripadvisor_distance_m !== undefined ? `${m.tripadvisor_distance_m}` : '--'}
                       </span>
                    </td>
                    <td className="px-6 py-6">
                      {m.tripadvisor_url ? (
                        <div className="flex flex-col gap-1.5">
                          <a 
                            href={m.tripadvisor_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-1.5 text-[10px] font-bold bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50"
                          >
                            <span className="truncate max-w-[150px]">{m.tripadvisor_url.replace('https://www.tripadvisor.com/', '')}</span>
                            <ExternalLink size={12} className="shrink-0" />
                          </a>
                        </div>
                      ) : status === 'not_found' ? (
                        <div className="flex flex-col gap-1 opacity-40">
                          <span className="text-slate-400 italic text-[10px] pl-2 font-medium">No candidates verified</span>
                          <div className="flex items-center gap-1 pl-2 text-[8px] font-bold text-slate-400 uppercase">
                             <Search size={8} /> Tried: {normalizeName(m.googleData.title)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[10px] pl-2 font-medium">Unverified</span>
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
                          <p className={`text-[10px] italic font-medium max-w-[180px] line-clamp-2 ${confidence >= 0.75 ? 'text-slate-500' : 'text-slate-400'}`} title={m.tripadvisor_match_notes || ''}>
                             {m.tripadvisor_match_notes || '--'}
                          </p>
                          <div className="p-1.5 bg-slate-50 rounded-lg text-slate-300">
                             <MessageSquare size={12} />
                          </div>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 mx-6 p-8 bg-indigo-50/30 border border-indigo-100 rounded-[2.5rem] flex items-start gap-5 mb-10">
         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
           <Zap size={24} />
         </div>
         <div className="space-y-2">
           <h4 className="font-black text-indigo-900 mb-1 flex items-center gap-2">
             <ShieldAlert size={18} className="text-indigo-500" /> Truth Validation Engine
           </h4>
           <p className="text-indigo-700/70 text-sm font-medium leading-relaxed">
             Stage 3 performs verified identity matching using physical proximity and name similarity coefficients. 
             <span className="font-black text-indigo-900 mx-1">Weak Match Found (Yellow)</span> indicates candidates were found but scored between 40-60%. 
             <span className="font-black text-indigo-900 mx-1">No Candidates Found</span> is often a data limitation of the global index and does not imply a pipeline failure. You can always proceed to the next stage using manual confirmed data.
           </p>
         </div>
      </div>
    </div>
  );
}
