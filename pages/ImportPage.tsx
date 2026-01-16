
import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, X, AlertCircle, ArrowRight, FolderPlus } from 'lucide-react';
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
      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
              <FolderPlus size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">Start New Project</h2>
              <p className="text-gray-500 text-sm font-medium">Create a workspace for your datasets</p>
            </div>
          </div>

          <form onSubmit={handleCreateJob} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Project Name *</label>
              <input 
                type="text" 
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Soho Restaurants Jan 2026"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description (Optional)</label>
              <textarea 
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Briefly describe the purpose of this data match..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium h-24 resize-none"
              />
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95"
            >
              Create Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  const Dropzone = ({ type, label, data }: { type: 'osm' | 'google', label: string, data: any[] }) => (
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">{label}</h3>
      <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all ${
        data.length > 0 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-gray-50'
      }`}>
        {data.length > 0 ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 size={48} className="text-blue-600 mb-4" />
            <p className="font-bold text-gray-900 mb-1">Data Loaded!</p>
            <p className="text-sm text-gray-600 mb-4">{data.length} records found</p>
            <button 
              onClick={() => type === 'osm' ? setOSMData([]) : setGoogleData([])}
              className="text-xs text-red-500 hover:underline flex items-center gap-1"
            >
              <X size={14} /> Remove and Re-upload
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center cursor-pointer group">
            <Upload size={48} className="text-gray-300 group-hover:text-blue-500 mb-4 transition-colors" />
            <p className="font-semibold text-gray-900 mb-1">Click or drag CSV</p>
            <p className="text-sm text-gray-500">Supports .csv files</p>
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Workspace: {job.name}</h2>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">Upload your datasets to this project to begin matching.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <Dropzone type="osm" label="OSM Data (export.csv)" data={job.osmData} />
        <Dropzone type="google" label="Google Maps Data" data={job.googleData} />
      </div>

      <div className="flex justify-center pt-6 border-t border-gray-100">
        <button
          disabled={job.osmData.length === 0 || job.googleData.length === 0}
          onClick={onNext}
          className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl hover:translate-y-[-2px] ${
            job.osmData.length > 0 && job.googleData.length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Begin Auto-Matching
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
};

export default ImportPage;
