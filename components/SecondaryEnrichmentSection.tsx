import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle, FileText, Zap, Loader2, ChevronRight, ChevronDown,
  Square, AlertCircle, Image as ImageIcon, Layers, Cloud, RefreshCw,
  Globe, Phone, Hourglass, X, CloudUpload, Database, ArrowRight, ExternalLink, Sparkles, Film, Compass
} from 'lucide-react';
import { Job, Match } from '../types';
import { pythonServerManager } from '../lib/pythonServerManager';
import { exportJobToCSV, parseEnrichedCSV, mergeEnrichedData, EnrichedData } from '../lib/secondaryEnrichment';
import { useStore } from '../store';
import { generateExportData } from '../lib/utils';
import Papa from 'papaparse';

interface Props {
  job: Job;
  onComplete: () => void;
}

type ServerState = 'checking' | 'ready' | 'processing' | 'completed' | 'error' | 'partial_failure';
type InjectionStatus = 'idle' | 'injecting' | 'success';

interface LogEntry {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  website?: string;
  details?: string;
}

const BATCH_SIZE = 2; // Reduced batch size for better reliability and avoiding timeouts

export default function SecondaryEnrichmentSection({ job, onComplete }: Props) {
  const { updateJobWithEnrichment, setSecondaryStatus, secondaryProcessingStatus, settings, pushToVideoInjector, pushToTertiary, setActiveCsvDataset } = useStore();
  const [serverState, setServerState] = useState<ServerState>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [injectionStatus, setInjectionStatus] = useState<InjectionStatus>('idle');
  const [showPreview, setShowPreview] = useState(true);
  
  // Processing state
  const [processedIndex, setProcessedIndex] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Track accumulated results for partial success
  const enrichedResultsRef = useRef<EnrichedData[]>([]);

  const isDarkMode = settings.theme === 'dark';
  const totalItems = job.matches.length;
  const progress = Math.round((processedIndex / totalItems) * 100);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handle server state based on processing status, avoiding redundant re-checks
  useEffect(() => {
    if (secondaryProcessingStatus === 'completed') {
      setServerState('completed');
      setProcessedIndex(totalItems);
    } else if (secondaryProcessingStatus === 'idle') {
      // Only check connection if we haven't already completed or partially failed
      if (serverState !== 'completed' && serverState !== 'partial_failure' && serverState !== 'error') {
        checkConnection();
      }
    }
  }, [secondaryProcessingStatus]);

  const checkConnection = async () => {
    setServerState('checking');
    setErrorMessage('');
    const isHealthy = await pythonServerManager.checkServerHealth();
    if (isHealthy) {
      setServerState('ready');
    } else {
      setServerState('error');
      setErrorMessage('Cannot connect to cloud API. Please verify the Railway service is active.');
    }
  };

  const processBatch = async (startIndex: number) => {
    const endIndex = Math.min(startIndex + BATCH_SIZE, totalItems);
    const currentMatches = job.matches.slice(startIndex, endIndex);
    
    // Update logs to "processing"
    setLogs(prev => prev.map(log => {
      const isCurrent = currentMatches.some(m => m.googleData.title === log.name);
      return isCurrent ? { ...log, status: 'processing' } : log;
    }));

    try {
      // Create a temporary job object just for this batch
      const batchJob: Job = { ...job, matches: currentMatches };
      const csvInput = exportJobToCSV(batchJob);
      
      const enrichedCsv = await pythonServerManager.enrichRestaurants(csvInput);
      const batchData = parseEnrichedCSV(enrichedCsv);
      
      // Store results
      enrichedResultsRef.current = [...enrichedResultsRef.current, ...batchData];
      
      // Update logs to "completed" with details
      setLogs(prev => prev.map(log => {
        const enriched = batchData.find(d => {
          // Find matching match in job by title or place ID
          const match = currentMatches.find(m => m.googleData.title === log.name);
          const gid = match?.googleData.google_place_id || match?.googleData.url?.split('query_place_id=')[1]?.split('&')[0];
          return d.google_place_id === gid;
        });

        if (enriched) {
          const findings = [];
          if (enriched.cover_image) findings.push('cover image');
          if (enriched.menu_url || enriched.menu_pdf_url) findings.push('menu URL');
          if (enriched.gallery_images && enriched.gallery_images.length > 2) findings.push('gallery');
          if (enriched.phone) findings.push('phone');
          
          return { 
            ...log, 
            status: 'completed', 
            details: findings.length > 0 ? `Found: ${findings.join(', ')}` : 'No extra data found'
          };
        }
        return log;
      }));

      return true;
    } catch (error: any) {
      setLogs(prev => prev.map(log => {
        const isCurrent = currentMatches.some(m => m.googleData.title === log.name);
        return isCurrent ? { ...log, status: 'error', details: error.message || 'Batch failed' } : log;
      }));
      throw error;
    }
  };

  const handleRunEnrichment = async (startFrom = 0) => {
    setServerState('processing');
    setSecondaryStatus('processing');
    setErrorMessage('');
    setInjectionStatus('idle');
    
    // Initialize logs if starting fresh
    if (startFrom === 0) {
      setLogs(job.matches.map((m, i) => ({
        id: `log-${i}`,
        name: m.googleData.title,
        status: 'pending',
        website: m.googleData.website
      })));
      enrichedResultsRef.current = [];
    }

    try {
      for (let i = startFrom; i < totalItems; i += BATCH_SIZE) {
        setProcessedIndex(i);
        await processBatch(i);
        // Add a small delay between batches for UI smoothness
        await new Promise(r => setTimeout(r, 500));
      }
      
      setProcessedIndex(totalItems);
      finalizeEnrichment();
    } catch (error: any) {
      console.error('Enrichment chain broken:', error);
      setServerState('partial_failure');
      setSecondaryStatus('idle');
      setErrorMessage(`Stopped at ${processedIndex}/${totalItems} restaurants. Partial progress saved.`);
      
      // Still attempt to merge what we have so far automatically for failures
      savePartialProgress();
    }
  };

  const savePartialProgress = () => {
    if (enrichedResultsRef.current.length > 0) {
      const updatedJob = mergeEnrichedData(job, enrichedResultsRef.current);
      console.log('🔄 Syncing progress to store. Updated Job State:', updatedJob);
      updateJobWithEnrichment(job.id, updatedJob);
      return updatedJob;
    }
    return job;
  };

  const handleInjectData = async () => {
    console.log('🚀 Initiating Data Injection...');
    console.log('Enriched results buffer:', enrichedResultsRef.current);
    
    setInjectionStatus('injecting');
    
    // Artificial delay for feedback
    await new Promise(r => setTimeout(r, 1200));
    
    try {
      // 1. Merge the enriched data into the matches
      const updatedJob = mergeEnrichedData(job, enrichedResultsRef.current);
      console.log('✅ Merge successful. Final Job structure:', updatedJob);
      
      // 2. Persist to the main store
      updateJobWithEnrichment(job.id, updatedJob);

      // 3. Initialize active CSV dataset for the pipeline reference
      const csvData = generateExportData(updatedJob.matches);
      setActiveCsvDataset(job.id, csvData);
      
      setInjectionStatus('success');
      console.log('🎉 Injection cycle complete.');
    } catch (err) {
      console.error('❌ Injection failed:', err);
      setInjectionStatus('idle');
      setErrorMessage('Failed to merge data. See console for details.');
    }
  };

  const finalizeEnrichment = () => {
    // Save to store immediately to ensure results are visible even if page is refreshed
    savePartialProgress();
    setSecondaryStatus('completed');
    setServerState('completed');
    setProcessedIndex(totalItems);
  };

  const handlePushToVideo = () => {
    pushToVideoInjector(job.id);
    onComplete();
  };

  const handlePushToTertiary = () => {
    pushToTertiary(job.id);
    onComplete();
  };

  const enrichedPreview = useMemo(() => {
    if (serverState !== 'completed' && serverState !== 'partial_failure') return null;
    const matches = job.matches;
    return {
      total: matches.length,
      coverImages: matches.filter(m => m.cover_image).length,
      menuUrls: matches.filter(m => m.menu_url || m.menu_pdf_url).length,
      galleryImages: matches.reduce((acc, m) => acc + (m.gallery_images?.length || 0), 0),
      phones: matches.filter(m => m.enriched_phone).length,
    };
  }, [job, serverState]);

  const hasMissingFields = useMemo(() => {
    return job.matches.some(m => 
      !m.enriched_opening_hours || 
      !m.cuisine_type || 
      !m.price_range || 
      (!m.enriched_phone && !m.googleData.phone)
    );
  }, [job]);

  const renderDataRow = (label: string, value: string | null | undefined, isLink = false) => {
    const exists = !!value && value !== 'null' && value !== '{}' && value !== '[]';
    return (
      <div className="flex items-start gap-2 text-[11px]">
        {exists ? <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> : <X size={14} className="text-slate-300 shrink-0 mt-0.5" />}
        <div className="flex flex-col">
          <span className="font-bold text-slate-500 uppercase tracking-tighter text-[9px]">{label}</span>
          <span className="truncate font-medium text-slate-700 max-w-[200px]">
            {!exists ? (
              <span className="text-slate-300 italic">Not found</span>
            ) : isLink ? (
              <a href={value!} target="_blank" className="text-indigo-600 hover:underline flex items-center gap-1">
                {value!.replace(/https?:\/\//, '')} <ExternalLink size={10} />
              </a>
            ) : (
              value
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl animate-in zoom-in-95 duration-500">
      <div className={`${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'} border p-6 rounded-[2rem] mb-8 flex items-center gap-4`}>
        <div className={`${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white text-emerald-600'} w-12 h-12 rounded-xl flex items-center justify-center shadow-sm`}>
          <CheckCircle size={24} />
        </div>
        <div>
          <h4 className={`${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'} font-black`}>
            {serverState === 'partial_failure' ? 'Partial Enrichment' : 'Cloud Scraper Pipeline'}
          </h4>
          <p className={`${isDarkMode ? 'text-emerald-500/80' : 'text-emerald-600'} text-xs font-medium`}>
            {serverState === 'partial_failure' ? 'Some data was successfully merged before the pipeline stalled.' : 'Processing one-by-one to ensure maximum accuracy and stability.'}
          </p>
        </div>
      </div>

      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border rounded-[2.5rem] p-10 shadow-sm`}>
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText size={24} className="text-indigo-600" />
              <h3 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{job.name}</h3>
            </div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest pl-9">
              STAGED FOR CLOUD ENRICHMENT • {job.matches.length} BASE MATCHES
            </p>
          </div>
          <div className={`${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'} px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2`}>
            <Cloud size={14} /> Batch Mode V1.1
          </div>
        </div>

        {errorMessage && (
          <div className={`mb-8 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 border ${serverState === 'partial_failure' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
            <AlertCircle size={24} className={serverState === 'partial_failure' ? 'text-orange-600' : 'text-red-600'} />
            <div className="flex-1">
              <p className="font-black text-sm">{errorMessage}</p>
              {serverState === 'partial_failure' && (
                <button 
                  onClick={() => handleRunEnrichment(processedIndex)} 
                  className="mt-3 bg-orange-600 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-orange-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw size={14} /> Resume From Last Stop
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-8">
          {serverState === 'checking' && (
            <div className="w-full py-20 flex flex-col items-center gap-4 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
              <Loader2 size={48} className="animate-spin text-indigo-600" />
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Handshaking with Cloud API...</p>
            </div>
          )}

          {serverState === 'ready' && (
            <div className="space-y-6">
              <div className={`${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50/30 border-indigo-100'} p-8 rounded-3xl border`}>
                <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-tight text-xs">
                  <Zap size={14} className="text-yellow-500" /> Enrichment Capabilities
                </h4>
                <ul className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Cover Media Extraction', desc: 'Finds high-res landing photos' },
                    { label: 'Menu Discovery', desc: 'Locates PDFs and internal links' },
                    { label: 'Phone Verification', desc: 'Syncs confirmed contact info' },
                    { label: 'Photo Galleries', desc: 'Extracts lifestyle image sets' }
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-slate-800">{item.label}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              <button 
                onClick={() => handleRunEnrichment(0)}
                className="w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-indigo-600 shadow-2xl transition-all flex items-center justify-center gap-4 group active:scale-[0.98]"
              >
                <Cloud size={24} className="group-hover:animate-bounce" />
                Start Sequential Cloud Scrape
              </button>
            </div>
          )}

          {(serverState === 'processing' || serverState === 'partial_failure') && (
            <div className="space-y-6">
              {/* Progress Bar Section */}
              <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'} p-8 rounded-[2rem] border border-slate-100`}>
                <div className="flex justify-between items-end mb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Overall Progress</span>
                    <span className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Enriching restaurants... {processedIndex} / {totalItems}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full h-5 bg-slate-200 rounded-full overflow-hidden border border-slate-300 shadow-inner">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-700 ease-out relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                   <FileText size={14} className="text-slate-400" />
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Activity Log</h4>
                </div>
                <div className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'} rounded-3xl p-6 h-[300px] overflow-y-auto font-mono text-xs shadow-inner scrollbar-thin scrollbar-thumb-slate-700`}>
                   <div className="space-y-4">
                     {logs.map((log) => (
                       <div key={log.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-1">
                          <div className="mt-1">
                            {log.status === 'completed' && <CheckCircle size={14} className="text-emerald-400" />}
                            {log.status === 'processing' && <Loader2 size={14} className="text-indigo-400 animate-spin" />}
                            {log.status === 'pending' && <Hourglass size={14} className="text-slate-600" />}
                            {log.status === 'error' && <X size={14} className="text-red-400" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start gap-4">
                                <span className={`${log.status === 'processing' ? 'text-indigo-300 font-bold' : log.status === 'completed' ? 'text-slate-300' : 'text-slate-600'}`}>
                                  {log.name}
                                </span>
                                <span className={`text-[9px] font-black uppercase ${log.status === 'completed' ? 'text-emerald-500' : 'text-slate-500'}`}>
                                  {log.status}
                                </span>
                            </div>
                            {log.website && (
                              <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                                <Globe size={10} />
                                <span className="truncate max-w-[200px] text-[10px]">{log.website.replace('https://', '')}</span>
                              </div>
                            )}
                            {log.details && (
                              <div className={`mt-1 pl-2 border-l border-slate-700 text-[10px] ${log.status === 'error' ? 'text-red-400' : 'text-indigo-400/80 italic'}`}>
                                → {log.details}
                              </div>
                            )}
                          </div>
                       </div>
                     ))}
                     <div ref={logEndRef} />
                   </div>
                </div>
              </div>
            </div>
          )}

          {serverState === 'completed' && (
            <div className="space-y-8 animate-in fade-in zoom-in-98 duration-700">
              {injectionStatus === 'success' ? (
                <div className={`${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-800'} p-10 rounded-[3rem] border text-center shadow-inner animate-in zoom-in-95`}>
                  <div className={`${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white text-indigo-500'} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm`}>
                    <Database size={36} />
                  </div>
                  <p className="text-3xl font-black mb-3">✓ Data Injected Successfully!</p>
                  <p className="text-sm font-medium opacity-80 max-w-sm mx-auto">{enrichedResultsRef.current.length} restaurants updated with cloud intelligence.</p>
                </div>
              ) : (
                <div className={`${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800'} p-10 rounded-[3rem] border text-center shadow-inner`}>
                  <div className={`${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white text-emerald-500'} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm`}>
                    <CheckCircle size={36} />
                  </div>
                  <p className="text-3xl font-black mb-3">✓ Enrichment Complete!</p>
                  <p className="text-sm font-medium opacity-80 max-w-sm mx-auto">{enrichedResultsRef.current.length} restaurants enriched and ready for injection.</p>
                </div>
              )}

              {enrichedPreview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Covers', value: enrichedPreview.coverImages, icon: ImageIcon, color: 'text-indigo-500' },
                    { label: 'Menus', value: enrichedPreview.menuUrls, icon: FileText, color: 'text-emerald-500' },
                    { label: 'Gallery', value: enrichedPreview.galleryImages, icon: Layers, color: 'text-amber-500' },
                    { label: 'Phones', value: enrichedPreview.phones, icon: Phone, color: 'text-blue-500' }
                  ].map((stat, i) => (
                    <div key={i} className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-3xl border shadow-sm`}>
                      <div className={`flex items-center gap-2 ${stat.color} mb-2`}>
                        <stat.icon size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <p className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Data Preview Section */}
              {enrichedResultsRef.current.length > 0 && injectionStatus !== 'success' && (
                <div className="space-y-4">
                  <div 
                    className="flex items-center justify-between px-4 py-2 cursor-pointer group"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                      📊 Enrichment Preview - Review Before Injecting
                    </h4>
                    <button className="text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 group-hover:underline">
                      {showPreview ? 'Collapse' : 'Expand'} Details
                      {showPreview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                  
                  {showPreview && (
                    <div className="max-h-[400px] overflow-y-auto space-y-3 p-2 bg-slate-50/50 border border-slate-100 rounded-[2rem] custom-scrollbar">
                      {enrichedResultsRef.current.map((data, idx) => {
                        const match = job.matches.find(m => {
                          const google = m.googleData;
                          const gid = google.google_place_id || 
                                      google.url?.split('query_place_id=')[1]?.split('&')[0] || 
                                      `g-${google.title.replace(/\s+/g, '-')}`;
                          return gid === data.google_place_id;
                        });

                        const galleryCount = (() => {
                          if (!data.gallery_images) return 0;
                          try { return JSON.parse(data.gallery_images).length; } catch { return 0; }
                        })();

                        const hasOpeningHours = data.opening_hours && data.opening_hours !== 'null' && data.opening_hours !== '{}';

                        return (
                          <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-4 mb-4">
                              {data.cover_image ? (
                                <img src={data.cover_image} className="w-12 h-12 rounded-xl object-cover shadow-sm border border-slate-100" />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100">
                                  <ImageIcon size={20} />
                                </div>
                              )}
                              <div>
                                <h5 className="font-black text-slate-800 text-sm leading-tight">{match?.googleData.title || 'Unknown Restaurant'}</h5>
                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{data.google_place_id}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 px-2">
                              {renderDataRow('Cover Image', data.cover_image ? 'Found' : null)}
                              {renderDataRow('Menu URL', data.menu_url, true)}
                              {renderDataRow('Menu PDF', data.menu_pdf_url, true)}
                              {renderDataRow('Gallery', galleryCount > 0 ? `${galleryCount} images found` : null)}
                              {renderDataRow('Phone', data.phone)}
                              {renderDataRow('Hours', hasOpeningHours ? 'Found' : null)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-6">
                {injectionStatus !== 'success' ? (
                  <div className="flex flex-col items-center">
                    <p className="text-sm font-bold text-slate-500 mb-6 uppercase tracking-widest">Merge enriched data back into your main dataset</p>
                    <button 
                      onClick={handleInjectData}
                      disabled={injectionStatus === 'injecting'}
                      className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-[0.98] disabled:opacity-50"
                    >
                      {injectionStatus === 'injecting' ? <Loader2 size={28} className="animate-spin" /> : <Database size={28} />}
                      {injectionStatus === 'injecting' ? 'Injecting Data...' : 'Inject Data'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={handlePushToTertiary}
                        disabled={!hasMissingFields}
                        className={`flex-1 py-6 rounded-[2rem] font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 group ${hasMissingFields ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                      >
                        <Compass size={24} className={hasMissingFields ? "group-hover:animate-spin" : ""} />
                        Send missing fields to TripAdvisor scrape
                      </button>
                      <button 
                        onClick={handlePushToVideo}
                        className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] group"
                      >
                        <Film size={24} className="group-hover:animate-bounce" />
                        Push to Video Injector
                      </button>
                    </div>
                    <button 
                      onClick={onComplete}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-98 group"
                    >
                      Continue to Pipeline
                      <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
      `}} />
    </div>
  );
}