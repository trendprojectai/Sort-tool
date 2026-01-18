import React, { useState, useEffect } from 'react';
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
  CheckCircle,
  Image as ImageIcon,
  ExternalLink,
  Wifi,
  WifiOff,
  Moon,
  Sun,
  Film,
  Compass
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
import VideoInjectorPage from './pages/VideoInjectorPage';
import TertiaryScrapePage from './pages/TertiaryScrapePage';
import SecondaryEnrichmentSection from './components/SecondaryEnrichmentSection';
import { pythonServerManager } from './lib/pythonServerManager';

export type MainSection = 'primary' | 'secondary' | 'tertiary' | 'video' | 'export' | 'map' | 'history' | 'settings';
type SubTab = 'import' | 'matching' | 'review' | 'unmatched';
type ApiStatus = 'unknown' | 'online' | 'offline' | 'checking';

// Main Application Component
const App: React.FC = () => {
  const [mainSection, setMainSection] = useState<MainSection>('primary');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('import');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [apiStatus, setApiStatus] = useState<ApiStatus>('unknown');
  
  const { 
    currentJob, 
    jobs, 
    setCurrentJobId, 
    resetApp, 
    saveToPersistence, 
    pushToSecondary, 
    pushedToSecondaryId,
    pushedToTertiaryId,
    pushedToVideoId,
    settings,
    toggleTheme
  } = useStore();
  
  const job = currentJob();
  const secondaryJob = jobs.find(j => j.id === pushedToSecondaryId);
  const tertiaryJob = jobs.find(j => j.id === pushedToTertiaryId);
  const videoJob = jobs.find(j => j.id === pushedToVideoId);
  const isDarkMode = settings.theme === 'dark';

  const checkApiHealth = async () => {
    setApiStatus('checking');
    const isHealthy = await pythonServerManager.checkServerHealth();
    setApiStatus(isHealthy ? 'online' : 'offline');
  };

  useEffect(() => {
    if (mainSection === 'secondary' || mainSection === 'tertiary') {
      checkApiHealth();
    }
  }, [mainSection]);

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
    }
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
    { id: 'tertiary', label: 'Tertiary Scrape (TripAdvisor)', icon: Compass },
    { id: 'video', label: 'Video Injector', icon: Film },
    { id: 'export', label: 'Export', icon: CloudUpload, disabled: !job || job.matches.length === 0 },
    { id: 'map', label: 'Map View', icon: MapIcon, disabled: !job || job.matches.length === 0 },
    { id: 'history', label: 'History', icon: HistoryIcon },
  ];

  // Base64 data URI for the bubbly "Cravey" logo
  const craveyLogoUri = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='40' viewBox='0 0 140 40'%3E%3Ctext x='0' y='32' font-family='Arial Black, sans-serif' font-weight='900' font-size='32' fill='black' style='letter-spacing: -2px;'%3ECravey%3C/text%3E%3C/svg%3E";

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar Navigation */}
      <aside className={`w-72 border-r flex flex-col shrink-0 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="p-8">
          <div className="mb-10 flex flex-col">
            <img src={craveyLogoUri} alt="Cravey" className={`h-8 w-auto object-contain self-start ${isDarkMode ? 'invert' : ''}`} />
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] ml-0.5 mt-1 italic opacity-80">
              V0.5 Push
            </p>
          </div>
          
          <nav className="space-y-2">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => setMainSection(item.id as MainSection)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-left ${
                  mainSection === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/20' 
                    : item.disabled ? 'opacity-30 cursor-not-allowed text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <item.icon size={20} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 space-y-2">
          <button
            onClick={() => setMainSection('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
              mainSection === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/20' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <SettingsIcon size={20} />
            Settings
          </button>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold hover:bg-slate-100 transition-all text-slate-500"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className={`h-20 border-b flex items-center justify-between px-10 shrink-0 ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            {mainSection === 'primary' && (
              <>
                {primaryTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as SubTab)}
                    disabled={tab.disabled}
                    className={`flex items-center gap-2 h-20 border-b-2 font-bold px-2 transition-all ${
                      activeSubTab === tab.id 
                        ? 'border-indigo-600 text-indigo-600' 
                        : tab.disabled ? 'opacity-30 border-transparent text-slate-400' : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <tab.icon size={18} />
                    {tab.label}
                  </button>
                ))}
                
                {/* Push to Secondary Action Button */}
                <button
                  onClick={handlePushToSecondary}
                  disabled={!job || job.matches.length === 0}
                  className="flex items-center gap-2 h-20 border-b-2 border-transparent font-bold px-4 transition-all text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed ml-4 border-l border-slate-100"
                >
                  <Sparkles size={18} className="text-indigo-400" />
                  <span className="whitespace-nowrap">Push to Secondary</span>
                </button>
              </>
            )}
            {mainSection !== 'primary' && (
              <h2 className="text-xl font-black capitalize tracking-tight">
                {mainSection === 'video' ? 'Video Injector' : 
                 mainSection === 'tertiary' ? 'Tertiary Scrape (TripAdvisor)' : 
                 mainSection} View
              </h2>
            )}
          </div>

          <div className="flex items-center gap-4">
            {job && (
              <button 
                onClick={handleSave}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                  saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : 
                 saveStatus === 'saved' ? <Check size={16} /> : <Save size={16} />}
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Progress'}
              </button>
            )}
            <button 
              onClick={handleStartNewJob}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95"
            >
              <PlusCircle size={18} />
              New Workspace
            </button>
          </div>
        </header>

        {/* View Routing Area */}
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/20">
          {mainSection === 'primary' && (
            <>
              {activeSubTab === 'import' && <ImportPage onNext={() => setActiveSubTab('matching')} />}
              {activeSubTab === 'matching' && <MatchingPage onNext={() => setActiveSubTab('review')} />}
              {activeSubTab === 'review' && <ReviewPage />}
              {activeSubTab === 'unmatched' && <UnmatchedPage />}
            </>
          )}

          {mainSection === 'secondary' && (
            <div className="flex flex-col items-center">
              <div className="mb-8 flex items-center gap-4 bg-white/50 px-4 py-2 rounded-full border border-slate-100 shadow-sm">
                 <div className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500 animate-pulse' : apiStatus === 'offline' ? 'bg-red-500' : 'bg-slate-300'}`} />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                   Cloud Pipeline: {apiStatus}
                 </span>
                 {apiStatus !== 'online' && (
                   <button onClick={checkApiHealth} className="text-indigo-600 hover:text-indigo-800 transition-colors ml-2">
                     <RefreshCw size={12} className={apiStatus === 'checking' ? 'animate-spin' : ''} />
                   </button>
                 )}
              </div>
              {secondaryJob ? (
                <SecondaryEnrichmentSection job={secondaryJob} onComplete={() => setMainSection('tertiary')} />
              ) : (
                <div className="text-center py-20 bg-white/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 max-w-xl mx-auto shadow-sm">
                   <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-400 mx-auto mb-8">
                     <Sparkles size={40} />
                   </div>
                   <h3 className="text-2xl font-black mb-3">Enrichment Queue Empty</h3>
                   <p className="text-slate-500 mb-10 leading-relaxed font-medium">Secondary enrichment requires confirmed matches from your primary workspace. Push a job to the cloud from the summary view.</p>
                   {job && job.matches.length > 0 && (
                     <button 
                       onClick={handlePushToSecondary}
                       className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-600 transition-all flex items-center gap-3 mx-auto active:scale-95"
                     >
                       <Zap size={20} />
                       Push Workspace to Cloud
                     </button>
                   )}
                </div>
              )}
            </div>
          )}

          {mainSection === 'tertiary' && (
            <div className="flex flex-col items-center">
              {tertiaryJob ? (
                <TertiaryScrapePage job={tertiaryJob} onNavigate={setMainSection} />
              ) : (
                <div className="text-center py-20 bg-white/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 max-w-xl mx-auto shadow-sm">
                   <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-400 mx-auto mb-8">
                     <Compass size={40} />
                   </div>
                   <h3 className="text-2xl font-black mb-3">Tertiary Queue Empty</h3>
                   <p className="text-slate-500 mb-10 leading-relaxed font-medium">TripAdvisor scrape requires jobs pushed from the Secondary Enrichment stage.</p>
                </div>
              )}
            </div>
          )}

          {mainSection === 'video' && (
            <div className="flex flex-col items-center">
               {videoJob ? (
                 <VideoInjectorPage job={videoJob} />
               ) : (
                 <div className="text-center py-20 bg-white/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 max-w-xl mx-auto shadow-sm">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-400 mx-auto mb-8">
                      <Film size={40} />
                    </div>
                    <h3 className="text-2xl font-black mb-3">Video Injector Idle</h3>
                    <p className="text-slate-500 mb-10 leading-relaxed font-medium">No jobs ready for video injection. Push a completed enrichment stage to begin.</p>
                 </div>
               )}
            </div>
          )}

          {mainSection === 'export' && <ExportPage />}
          {mainSection === 'map' && <MapPage />}
          {mainSection === 'history' && <HistoryPage onViewJob={(id) => { setCurrentJobId(id); setMainSection('primary'); setActiveSubTab('review'); }} />}
          {mainSection === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
};

// Default export required for index.tsx
export default App;