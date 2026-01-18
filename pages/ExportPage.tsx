import React, { useState } from 'react';
import { Download, CloudUpload, Database, CheckCircle2, AlertCircle, Loader2, Link2, Check, ExternalLink, MessageSquare } from 'lucide-react';
import { useStore } from '../store';
import { generateExportData } from '../lib/utils';

const ExportPage: React.FC = () => {
  const job = useStore(state => state.currentJob());
  const supabaseConfig = useStore(state => state.supabaseConfig);
  const [isExporting, setIsExporting] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const matches = job?.matches || [];
  const confirmedMatches = matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed');
  
  // Rule: Use activeCsvDataset if it exists for consistency
  const exportData = job?.activeCsvDataset || generateExportData(confirmedMatches);
  
  const isSupabaseLinked = !!(supabaseConfig.url && supabaseConfig.key && supabaseConfig.tableName);

  const handleCsvDownload = () => {
    if (exportData.length === 0) return;
    setIsExporting(true);
    
    const headers = Object.keys(exportData[0] || {}).join(',');
    const rows = exportData.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `matched_restaurants_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => setIsExporting(false), 1000);
  };

  const handleSupabasePush = async () => {
    if (!isSupabaseLinked || exportData.length === 0) return;

    setPushStatus('pushing');
    setErrorMessage(null);

    try {
      // Normalize URL: remove trailing slash and ensure rest/v1 prefix
      const baseUrl = supabaseConfig.url.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/rest/v1/${supabaseConfig.tableName}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'apikey': supabaseConfig.key,
          'Authorization': `Bearer ${supabaseConfig.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        let message = errorBody.message || `Server responded with ${response.status}: ${response.statusText}`;
        
        // Specific help for schema mismatch
        if (message.toLowerCase().includes('column') && message.toLowerCase().includes('not found')) {
          message = `Schema mismatch: ${message}. Visit Settings to use the Table Schema Helper.`;
        }
        
        throw new Error(message);
      }

      setPushStatus('success');
      setTimeout(() => setPushStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Supabase Sync Error:', error);
      setPushStatus('error');
      setErrorMessage(error.message === 'Failed to fetch' 
        ? 'Connection blocked. Check your Supabase URL, API Key, or CORS settings.' 
        : error.message);
      
      setTimeout(() => setPushStatus('idle'), 8000); // Longer delay for complex errors
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-3">Finalize & Export</h2>
        <p className="text-slate-500 text-lg font-medium">You have <span className="text-indigo-600 font-black">{exportData.length}</span> records in the active dataset ready for delivery.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CSV Export Card */}
        <div className="bg-white/50 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/60 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all group">
          <div>
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm group-hover:scale-110 transition-transform">
              <Download size={28} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Download CSV</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">Get a standard CSV file formatted with all specific columns required for your database schema.</p>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> UTF-8 Standard Encoding
              </li>
              <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Multi-Stage Enrichment Data
              </li>
              <li className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> TripAdvisor Validation Fields
              </li>
            </ul>
          </div>
          
          <button 
            onClick={handleCsvDownload}
            disabled={exportData.length === 0 || isExporting}
            className="w-full py-5 bg-slate-900 text-white rounded-[1.25rem] font-black text-base hover:bg-indigo-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-40"
          >
            {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            Download .csv
          </button>
        </div>

        {/* Supabase Card */}
        <div className="bg-white/50 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/60 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all group">
          <div>
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm group-hover:scale-110 transition-transform">
              <CloudUpload size={28} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Supabase Sync</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">Push directly to your Supabase instance. Existing records will be updated based on Google Place ID.</p>
            
            <div className={`p-4 rounded-2xl border mb-8 transition-colors ${isSupabaseLinked ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuration Status</span>
                 <span className={`text-[10px] font-black uppercase flex items-center gap-1 ${isSupabaseLinked ? 'text-emerald-600' : 'text-amber-500'}`}>
                   {isSupabaseLinked ? <><Check size={10} /> Linked</> : <><AlertCircle size={10} /> Not Configured</>}
                 </span>
               </div>
               {isSupabaseLinked ? (
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                   <Link2 size={14} className="text-emerald-500" />
                   <span className="truncate">{supabaseConfig.tableName} @ {supabaseConfig.url.replace(/https?:\/\//, '')}</span>
                 </div>
               ) : (
                 <p className="text-xs text-slate-400 font-medium italic">Please configure Supabase credentials in Settings to enable direct sync.</p>
               )}
            </div>
          </div>
          
          <button 
            onClick={handleSupabasePush}
            disabled={!isSupabaseLinked || exportData.length === 0 || pushStatus === 'pushing'}
            className={`w-full py-5 rounded-[1.25rem] font-black text-base transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-40 ${
              pushStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : 
              pushStatus === 'error' ? 'bg-red-100 text-red-700 border-red-200' :
              'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {pushStatus === 'pushing' ? <Loader2 className="animate-spin" size={20} /> : 
             pushStatus === 'success' ? <CheckCircle2 size={20} /> : 
             pushStatus === 'error' ? <AlertCircle size={20} /> :
             <Database size={20} />}
            {pushStatus === 'pushing' ? 'Syncing...' : 
             pushStatus === 'success' ? 'Sync Successful' : 
             pushStatus === 'error' ? 'Sync Failed' :
             'Push to Supabase'}
          </button>
          
          {errorMessage && (
            <div className="mt-3 bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in">
              <p className="text-[11px] font-black text-red-600 leading-relaxed uppercase tracking-tight">
                {errorMessage}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Export Preview */}
      <div className="bg-white/40 border border-slate-100 rounded-[2.5rem] p-8 shadow-sm overflow-hidden">
        <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-6 px-2">Export Data Preview (Sample)</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-50 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50">
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider">Restaurant Name</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider">TripAdvisor Link</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center">TA Confidence</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider text-center">TA Status</th>
                <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-wider">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {exportData.slice(0, 10).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-800">{row.name}</td>
                  <td className="px-6 py-4">
                    {row.tripadvisor_url ? (
                      <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                        <Check size={12} className="text-emerald-500" />
                        <span className="truncate max-w-[150px]">{row.tripadvisor_url.replace('https://www.', '')}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 italic">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-black ${row.tripadvisor_confidence >= 0.75 ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {row.tripadvisor_confidence ? `${Math.round(row.tripadvisor_confidence * 100)}%` : '--'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-widest ${row.tripadvisor_status === 'found' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      {row.tripadvisor_status || '--'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-2 text-slate-500 italic max-w-[200px]">
                       <MessageSquare size={12} className="shrink-0 text-slate-300" />
                       <span className="truncate">{row.tripadvisor_match_notes || 'No notes'}</span>
                     </div>
                  </td>
                </tr>
              ))}
              {exportData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-300 font-bold italic">
                    No records found in active dataset.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;