
import React, { useState } from 'react';
import { Database, Link2, Shield, Save, Check, RefreshCw, AlertCircle, Terminal, Copy, Trash2 } from 'lucide-react';
import { useStore } from '../store';

const SettingsPage: React.FC = () => {
  const { supabaseConfig, setSupabaseConfig, resetApp } = useStore();
  
  const [config, setConfig] = useState(supabaseConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sqlSnippet = `CREATE TABLE ${config.tableName || 'restaurants'} (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  latitude double precision,
  longitude double precision,
  address text,
  city text,
  area text,
  country text,
  cover_image text,
  tiktok_url text,
  google_place_id text UNIQUE,
  external_place_id text,
  rating numeric,
  reviews_count integer,
  opening_hours text,
  source text,
  claimed text,
  phone text,
  website text,
  category_name text,
  google_maps_url text,
  osm_name text,
  postcode text,
  match_confidence text,
  match_score numeric,
  match_method text,
  created_at timestamp with time zone DEFAULT now()
);`;

  const handleSave = () => {
    setIsSaving(true);
    setSupabaseConfig(config);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 500);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMasterReset = () => {
    if (window.confirm("⚠️ MASTER RESET: This will permanently delete all jobs, matches, and configurations. This cannot be undone. Are you sure?")) {
      // Direct storage clear to be 100% sure
      localStorage.clear();
      resetApp(); // Also call store reset
      
      // Force clean reload at root path
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  const handleTestConnection = async () => {
    if (!config.url || !config.key || !config.tableName) return;

    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const baseUrl = config.url.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/rest/v1/${config.tableName}?limit=1`;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        }
      });

      if (response.ok) {
        setTestResult('success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setTestResult('error');
        setTestError(errorData.message || `Table "${config.tableName}" not accessible (HTTP ${response.status})`);
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setTestResult('error');
      setTestError(error.message === 'Failed to fetch' 
        ? 'Network error. Verify URL format and ensure Supabase project is active.' 
        : error.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2">System Configuration</h2>
        <p className="text-slate-500 font-medium">Manage integrations, API keys, and global application behavior.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-1 space-y-4">
          <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4">
              <Link2 size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-800">Integrations</h3>
            <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">Connect RM Pro to external databases for automated syncing and real-time updates.</p>
          </div>
          
          <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm mb-4">
              <Shield size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-800">Security</h3>
            <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">Keys are stored locally in your browser's encrypted storage and never transmitted to our servers.</p>
          </div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Database size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-800">Supabase Integration</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database Sync Configuration</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${supabaseConfig.url ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {supabaseConfig.url ? 'Configured' : 'Offline'}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Project URL</label>
                <input 
                  type="text" 
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">API Service Key (anon/service)</label>
                <input 
                  type="password" 
                  value={config.key}
                  onChange={(e) => setConfig({ ...config, key: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Target Table Name</label>
                <input 
                  type="text" 
                  value={config.tableName}
                  onChange={(e) => setConfig({ ...config, tableName: e.target.value })}
                  placeholder="restaurants"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={18} className="animate-spin" /> : (saveSuccess ? <Check size={18} /> : <Save size={18} />)}
                  {isSaving ? 'Saving...' : (saveSuccess ? 'Settings Saved' : 'Update Configuration')}
                </button>
                <button 
                  onClick={handleTestConnection}
                  disabled={isTesting || !config.url}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isTesting ? <RefreshCw size={18} className="animate-spin" /> : 'Test Sink'}
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${testResult === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {testResult === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">
                      {testResult === 'success' ? 'Connection validated successfully' : 'Validation failed'}
                    </p>
                    {testError && <p className="text-[10px] mt-1 font-medium opacity-80">{testError}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <Terminal size={20} />
              </div>
              <div>
                <h4 className="font-black">Table Schema Helper</h4>
                <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Required Supabase Structure</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-medium mb-6 leading-relaxed">
              If you see "column not found" errors, ensure your Supabase table has these columns. 
              Run this SQL snippet in the Supabase SQL Editor to create the correct table structure:
            </p>

            <div className="relative group">
              <pre className="bg-slate-800 p-6 rounded-2xl text-[10px] font-mono text-indigo-100 overflow-x-auto border border-slate-700 custom-scrollbar max-h-48">
                {sqlSnippet}
              </pre>
              <button 
                onClick={handleCopySql}
                className="absolute top-4 right-4 p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                title="Copy SQL"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Master Reset Area */}
      <div className="flex justify-end pt-10 border-t border-slate-100">
        <div className="flex flex-col items-end gap-3 text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Destructive Actions</p>
          <button 
            onClick={handleMasterReset}
            className="group flex items-center gap-3 px-8 py-4 bg-white border-2 border-red-100 text-red-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:border-red-200 transition-all shadow-xl shadow-red-100/20 active:scale-95"
          >
            <Trash2 size={16} className="group-hover:rotate-12 transition-transform" />
            Master System Reset
          </button>
          <p className="text-[9px] font-bold text-slate-300 max-w-xs leading-relaxed">
            Clicking this will wipe all browser local storage, delete your current jobs, and revert all settings to factory defaults.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
