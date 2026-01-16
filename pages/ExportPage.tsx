
import React, { useState } from 'react';
import { Download, CloudUpload, Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { generateExportData } from '../lib/utils';

const ExportPage: React.FC = () => {
  const job = useStore(state => state.currentJob());
  const [isExporting, setIsExporting] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');

  const matches = job?.matches || [];
  const confirmedMatches = matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed');
  
  const handleCsvDownload = () => {
    if (confirmedMatches.length === 0) return;
    setIsExporting(true);
    const data = generateExportData(confirmedMatches);
    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => 
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
    setPushStatus('pushing');
    // Simulate Supabase push
    setTimeout(() => {
      setPushStatus('success');
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-gray-900 mb-3">Finalize & Export</h2>
        <p className="text-gray-500 text-lg">You have {confirmedMatches.length} confirmed matches ready for delivery.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CSV Export Card */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
              <Download size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Download CSV</h3>
            <p className="text-sm text-gray-500 mb-6">Get a standard CSV file formatted with all 25 specific columns required for your database.</p>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <CheckCircle2 size={14} className="text-green-500" /> UTF-8 Encoded
              </li>
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <CheckCircle2 size={14} className="text-green-500" /> Includes Confidence Scores
              </li>
              <li className="flex items-center gap-2 text-xs text-gray-600">
                <CheckCircle2 size={14} className="text-green-500" /> Standard Data Mapping
              </li>
            </ul>
          </div>
          
          <button 
            onClick={handleCsvDownload}
            disabled={confirmedMatches.length === 0 || isExporting}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
          >
            {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            Download .csv
          </button>
        </div>

        {/* Supabase Card */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
              <CloudUpload size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Supabase Sync</h3>
            <p className="text-sm text-gray-500 mb-6">Push directly to your Supabase instance. Existing records will be updated based on Google Place ID.</p>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configuration</span>
                 <span className="text-[10px] font-bold text-red-500">Not Linked</span>
               </div>
               <p className="text-xs text-gray-500 italic">Please configure Supabase credentials in the Settings panel to enable direct sync.</p>
            </div>
          </div>
          
          <button 
            onClick={handleSupabasePush}
            disabled={true}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database size={20} />
            Push to Supabase
          </button>
        </div>
      </div>

      {/* Export Preview */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-4">Export Preview (Top 3)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 text-gray-400">name</th>
                <th className="px-4 py-3 text-gray-400">address</th>
                <th className="px-4 py-3 text-gray-400">rating</th>
                <th className="px-4 py-3 text-gray-400">confidence</th>
              </tr>
            </thead>
            <tbody>
              {generateExportData(confirmedMatches).slice(0, 3).map((row, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-bold">{row.name}</td>
                  <td className="px-4 py-3 text-gray-500">{row.address}</td>
                  <td className="px-4 py-3">{row.rating} ★</td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                      {row.match_confidence}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
