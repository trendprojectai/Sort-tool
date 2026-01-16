
import React, { useState } from 'react';
import { 
  Database, 
  Map as MapIcon, 
  CheckSquare, 
  Settings as SettingsIcon,
  Upload,
  RefreshCw,
  History as HistoryIcon,
  AlertCircle,
  Save,
  Check,
  Loader2,
  PlusCircle,
  Layers,
  ChevronRight,
  Sparkles,
  CloudUpload,
  Send,
  FileText,
  Zap,
  CheckCircle
} from 'lucide-react';
import { useStore } from './store';
import ImportPage from './pages/ImportPage';
import MatchingPage from './pages/MatchingPage';
import ReviewPage from './pages/ReviewPage';
import MapPage from './pages/MapPage';
import ExportPage from './pages/ExportPage';
import HistoryPage from './pages/HistoryPage';
import UnmatchedPage from './pages/UnmatchedPage';
import SettingsPage from './pages/SettingsPage';

type MainSection = 'primary' | 'secondary' | 'export' | 'map' | 'history' | 'settings';
type SubTab = 'import' | 'matching' | 'review' | 'unmatched';

const App: React.FC = () => {
  const [mainSection, setMainSection] = useState<MainSection>('primary');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('import');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const { 
    currentJob, 
    jobs, 
    setCurrentJobId, 
    resetApp, 
    saveToPersistence, 
    pushToSecondary, 
    pushedToSecondaryId,
    secondaryProcessingStatus,
    setSecondaryStatus
  } = useStore();
  
  const job = currentJob();
  const secondaryJob = jobs.find(j => j.id === pushedToSecondaryId);

  const handleSave = async () => {
    setSaveStatus('saving');
    await saveToPersistence();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleStartNewJob = () => {
    setCurrentJobId('');
    setMainSection('primary');
    setActiveSubTab('import');
  };

  const handlePushToSecondary = () => {
    if (job) {
      pushToSecondary(job.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      // Optional: auto-navigate to secondary or show toast
    }
  };

  const handleRunSecondaryProcess = () => {
    setSecondaryStatus('processing');
    setTimeout(() => {
      setSecondaryStatus('completed');
    }, 4000);
  };

  const primaryTabs = [
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'matching', label: 'Auto-Match', icon: RefreshCw, disabled: !job || job.osmData.length === 0 || job.googleData.length === 0 },
    { id: 'review', label: 'Review', icon: CheckSquare, disabled: !job || job.matches.length === 0 },
    { id: 'unmatched', label: 'Unmatched', icon: AlertCircle, disabled: !job || (job.unmatchedOSM.length === 0 && job.unmatchedGoogle.length === 0) },
  ];

  const sidebarItems = [
    { id: 'primary', label: 'Primary Scrape', icon: Layers },
    { id: 'secondary', label: 'Secondary Scrape', icon: Sparkles },
    { id: 'export', label: 'Export', icon: CloudUpload, disabled: !job || job.matches.length === 0 },
    { id: 'map', label: 'Map View', icon: MapIcon, disabled: !job || job.matches.length === 0 },
    { id: 'history', label: 'History', icon: HistoryIcon },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      {/* Sidebar Navigation */}
      <aside className="w-72 fixed h-full z-[60] bg-white border-r border-slate-200 flex flex-col p-6 shadow-sm">
        {/* Sidebar Branding */}
        <div className="mb-10 px-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Database size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter text-slate-800">RM Pro</h1>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">v1.1.0 SOHO 1</span>
            </div>
          </div>
          
          {job && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative group">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Project</p>
              <p className="text-sm font-black text-slate-800 truncate">{job.name}</p>
              
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl py-2 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all z-[70] origin-top">
                <div className="px-4 py-2 border-b border-slate-50 mb-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Switch Project</p>
                </div>
                {jobs.map(j => (
                  <button 
                    key={j.id} 
                    onClick={() => { setCurrentJobId(j.id); setMainSection('primary'); setActiveSubTab('review'); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center justify-between transition-colors ${j.id === job?.id ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-600'}`}
                  >
                    <span className="truncate">{j.name}</span>
                    {j.id === job?.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Main Links */}
        <nav className="flex-1 space-y-2">
          <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Navigation</p>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = mainSection === item.id;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => setMainSection(item.id as MainSection)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'
                    : item.disabled
                      ? 'text-slate-300 cursor-not-allowed opacity-50'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </div>
                {isActive && <ChevronRight size={14} />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-slate-100 mt-auto space-y-2">
          <button 
            onClick={() => setMainSection('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
              mainSection === 'settings' 
                ? 'bg-slate-900 text-white shadow-xl' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <SettingsIcon size={18} />
            Settings
          </button>
          <button 
            onClick={resetApp}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <RefreshCw size={18} />
            Factory Reset
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-72 min-h-screen flex flex-col relative overflow-x-hidden">
        
        {/* Main Header (Context-aware for Primary Scrape) */}
        {mainSection === 'primary' && (
          <header className="sticky top-0 z-50 px-8 py-4 bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleStartNewJob}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-indigo-600 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95"
                >
                  <PlusCircle size={16} />
                  New Job
                </button>
                <div className="h-6 w-px bg-slate-200" />
                <nav className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  {primaryTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        disabled={tab.disabled}
                        onClick={() => setActiveSubTab(tab.id as SubTab)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          activeSubTab === tab.id
                            ? 'bg-slate-100 text-indigo-600'
                            : tab.disabled
                              ? 'text-slate-300 cursor-not-allowed opacity-50'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
                <div className="h-6 w-px bg-slate-200" />
                <button 
                  onClick={handlePushToSecondary}
                  disabled={!job || job.matches.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-black transition-all disabled:opacity-50"
                >
                  <Send size={16} />
                  Push to Secondary
                </button>
              </div>

              <button 
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-sm ${
                  saveStatus === 'saving' 
                    ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-wait'
                    : saveStatus === 'saved'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <Check size={14} />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </header>
        )}

        {/* Global Header for non-primary sections */}
        {mainSection !== 'primary' && mainSection !== 'settings' && mainSection !== 'map' && (
           <header className="sticky top-0 z-50 px-8 py-4 bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
             <div className="max-w-7xl mx-auto flex items-center justify-between">
                <h2 className="font-black text-slate-800 capitalize tracking-tight text-xl">{mainSection.replace('_', ' ')}</h2>
                <div className="flex items-center gap-4">
                  {mainSection === 'secondary' && secondaryJob && (
                     <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                       <FileText size={12} /> Working File: {secondaryJob.name}
                     </div>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-sm ${
                      saveStatus === 'saving' 
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-wait'
                        : saveStatus === 'saved'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'saved' ? <Check size={14} /> : <Save size={14} />}
                    {saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : 'Save Changes'}
                  </button>
                </div>
             </div>
           </header>
        )}

        {/* Main Content Body */}
        <div className={`flex-1 ${mainSection === 'map' ? 'p-0' : 'p-8'} animate-in fade-in slide-in-from-right-4 duration-500`}>
          {mainSection === 'primary' && (
            <div className="max-w-7xl mx-auto">
              {activeSubTab === 'import' && <ImportPage onNext={() => setActiveSubTab('matching')} />}
              {activeSubTab === 'matching' && <MatchingPage onNext={() => setActiveSubTab('review')} />}
              {activeSubTab === 'review' && <ReviewPage />}
              {activeSubTab === 'unmatched' && <UnmatchedPage />}
            </div>
          )}

          {mainSection === 'secondary' && (
            <div className="max-w-7xl mx-auto h-full flex flex-col items-center justify-center">
              {!secondaryJob ? (
                <div className="text-center p-12 space-y-6">
                  <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-[2.5rem] flex items-center justify-center shadow-inner mx-auto">
                    <Sparkles size={48} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Secondary Scrape Engine</h2>
                    <p className="text-slate-500 font-medium mt-3 leading-relaxed max-w-lg mx-auto">
                      No file currently staged for secondary processing. Use the "Push to Secondary" action in the Primary Scrape workspace.
                    </p>
                  </div>
                  <button 
                    onClick={() => setMainSection('primary')}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Return to Primary
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-4xl animate-in zoom-in-95 duration-500">
                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] mb-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-emerald-800 font-black">File has been moved to Secondary Scrape</h4>
                      <p className="text-emerald-600 text-xs font-medium">Ready for advanced data enrichment and social sentiment analysis.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
                    <div className="flex items-start justify-between mb-10">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <FileText size={20} className="text-indigo-600" />
                           <h3 className="text-2xl font-black text-slate-800">{secondaryJob.name}</h3>
                        </div>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest pl-8">
                          STAGED FOR ENRICHMENT • {secondaryJob.matches.length} BASE MATCHES
                        </p>
                      </div>
                      <div className="px-4 py-2 bg-slate-50 rounded-xl text-slate-500 text-xs font-bold">
                        V1.0 Staging
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-10">
                       <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Baseline Confidence</p>
                          <p className="text-2xl font-black text-slate-800">84%</p>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Enrichment Source</p>
                          <p className="text-2xl font-black text-slate-800">Python Script</p>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                          <p className="text-2xl font-black text-slate-800 capitalize">{secondaryProcessingStatus}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       {secondaryProcessingStatus === 'idle' && (
                         <button 
                            onClick={handleRunSecondaryProcess}
                            className="w-full py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-indigo-600 shadow-2xl transition-all flex items-center justify-center gap-4 group"
                          >
                            <Zap size={24} className="group-hover:text-yellow-400 transition-colors" />
                            Load & Process Advanced Scraping
                          </button>
                       )}

                       {secondaryProcessingStatus === 'processing' && (
                         <div className="w-full py-12 flex flex-col items-center gap-4 bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
                            <Loader2 size={48} className="animate-spin text-indigo-600" />
                            <div className="text-center">
                              <p className="text-lg font-black text-slate-800">Triggering Python Enrichment Scraper...</p>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Collecting social metrics and additional attributes</p>
                            </div>
                         </div>
                       )}

                       {secondaryProcessingStatus === 'completed' && (
                         <div className="space-y-6">
                           <div className="p-8 bg-emerald-50 text-emerald-800 rounded-[1.5rem] border border-emerald-100 text-center">
                              <p className="text-xl font-black mb-2">Processing Complete</p>
                              <p className="text-sm font-medium">Additional data points successfully merged into {secondaryJob.name}.</p>
                           </div>
                           <button 
                             onClick={() => setMainSection('export')}
                             className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl"
                           >
                             Proceed to Export <ChevronRight size={20} />
                           </button>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {mainSection === 'export' && (
            <div className="max-w-7xl mx-auto">
              <ExportPage />
            </div>
          )}

          {mainSection === 'history' && (
            <div className="max-w-7xl mx-auto">
              <HistoryPage onViewJob={(id) => { setCurrentJobId(id); setMainSection('primary'); setActiveSubTab('review'); }} />
            </div>
          )}

          {mainSection === 'map' && <MapPage />}
          
          {mainSection === 'settings' && (
            <div className="max-w-7xl mx-auto">
              <SettingsPage />
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <footer className="px-8 py-6 border-t border-slate-200/60 bg-white">
          <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
            <p>© 2024 Restaurant Matcher Pro • {job?.name || 'No Active Project'}</p>
            <p className="text-slate-300">Enterprise Ready • Privacy First</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
