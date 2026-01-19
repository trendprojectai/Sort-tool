import React, { useState } from 'react';
// Added Check to the lucide-react imports
import { Upload, FileText, CheckCircle2, X, AlertCircle, ArrowRight, FolderPlus, FileSpreadsheet, Check, Lock } from 'lucide-react';
import Papa from 'papaparse';
import { useStore } from '../store';
import { OSMRestaurant, GoogleRestaurant } from '../types';

interface ImportPageProps {
  onNext: () => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ onNext }) => {
  const { currentJob, createJob, setOSMData, setGoogleData } = useStore();
  const job = currentJob();
  
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState('');
  const [jobDesc, setJobDesc] = useState('');

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (jobName.trim()) {
      createJob(jobName, jobDesc);
    }
  };

  const handleFileUpload = (type: 'osm' | 'google', file: File) => {
    if (job?.lockedDataset) return;
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (type === 'osm') {
          setOSMData(results.data as any);
        } else {
          setGoogleData(results.data as any);
        }
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto mt-6">
        <div className="bg-white/50 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl border border-white/60">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
              <FolderPlus size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Create Workspace</h2>
            <p className="text-slate-500 font-medium mt-2">Set up a container for your data matching workflow</p>
          </div>

          <form onSubmit={handleCreateJob} className="space-y-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Project Identifier</label>
              <input 
                type="text" 
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. London Q1 Audit"
                className="w-full px-6 py-4 bg-white/80 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Context / Notes</label>
              <textarea 
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Details about these datasets..."
                className="w-full px-6 py-4 bg-white/80 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 h-28 resize-none shadow-sm"
              />
            </div>
            <button 
              type="submit"
              className="w-full py-5 bg-indigo-600 text-white rounded-[1.25rem] font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              Initialize Project <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  const Dropzone = ({ type, label, data }: { type: 'osm' | 'google', label: string, data: any[] }) => (
    <div className="flex-1 group">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</h3>
        {data.length > 0 && (
          <span className={`text-[10px] font-black uppercase flex items-center gap-1 ${job?.lockedDataset ? 'text-amber-500' : 'text-emerald-500'}`}>
            {job?.lockedDataset ? <><Lock size={12} /> Locked</> : <><Check size={12} /> Ready</>}
          </span>
        )}
      </div>
      <div className={`relative min-h-[320px] rounded-[2rem] p-8 flex flex-col items-center justify-center transition-all duration-500 border-2 border-dashed ${
        data.length > 0 
          ? job?.lockedDataset ? 'bg-amber-50/20 border-amber-100' : 'bg-emerald-50/30 border-emerald-100 shadow-inner' 
          : 'bg-white border-slate-100 hover:border-indigo-400 hover:shadow-2xl hover:bg-indigo-50/5 hover:-translate-y-1'
      }`}>
        {data.length > 0 ? (
          <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg ${job?.lockedDataset ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {job?.lockedDataset ? <Lock size={32} /> : <FileSpreadsheet size={32} />}
            </div>
            <p className="font-extrabold text-slate-800 text-lg mb-1">{job?.lockedDataset ? 'Dataset Immutable' : 'Dataset Loaded'}</p>
            <p className="text-sm font-bold text-slate-400 mb-6">{data.length.toLocaleString()} records</p>
            {!job?.lockedDataset && (
              <button 
                onClick={() => type === 'osm' ? setOSMData([]) : setGoogleData([])}
                className="px-6 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all flex items-center gap-2"
              >
                <X size={14} /> Reset Source
              </button>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center cursor-pointer text-center max-w-[240px]">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 rounded-full flex items-center justify-center mb-6 transition-all duration-500 shadow-inner">
              <Upload size={32} />
            </div>
            <p className="font-extrabold text-slate-800 mb-2">Drop CSV File</p>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">Click to browse or drag and drop your spreadsheet here</p>
            <input 
              type="file" 
              className="hidden" 
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(type, e.target.files[0])}
            />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-3">
          <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${job?.lockedDataset ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
            {job?.lockedDataset ? 'Workspace Locked' : 'Workspace Active'}
          </div>
        </div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">{job.name}</h2>
        <p className="text-slate-500 font-medium mt-2 max-w-2xl">
          {job?.lockedDataset 
            ? 'This project is in a high-fidelity enrichment stage. Source data modifications are disabled to preserve integrity.' 
            : (job.description || 'Import your data sources to begin the matching engine.')}
        </p>
      </div>

      {error && (
        <div className="mb-8 bg-red-50/50 backdrop-blur-sm border border-red-100 text-red-600 px-6 py-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8 mb-12">
        <Dropzone type="osm" label="Data Source A (OSM)" data={job.osmData} />
        <Dropzone type="google" label="Data Source B (Google)" data={job.googleData} />
      </div>

      <div className="flex flex-col items-center pt-8 border-t border-slate-50">
        <button
          disabled={job.osmData.length === 0 || job.googleData.length === 0}
          onClick={onNext}
          className={`group flex items-center gap-4 px-12 py-5 rounded-[1.5rem] font-black text-xl transition-all shadow-2xl ${
            job.osmData.length > 0 && job.googleData.length > 0
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:translate-y-[-4px]'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-60'
          }`}
        >
          {job?.lockedDataset ? 'Continue to Pipeline' : 'Initialize Engine'}
          <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">
          {job?.lockedDataset ? 'Pipeline progress is preserved' : `Ready to match ${(job.osmData.length * job.googleData.length).toLocaleString()} potential pairs`}
        </p>
      </div>
    </div>
  );
};

export default ImportPage;