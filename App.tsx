
import React, { useState } from 'react';
import { 
  Database, 
  Map as MapIcon, 
  CheckSquare, 
  Settings as SettingsIcon,
  Github,
  Upload,
  RefreshCw,
  Info,
  History,
  AlertCircle,
  Plus,
  ChevronDown
} from 'lucide-react';
import { useStore } from './store';
import ImportPage from './pages/ImportPage';
import MatchingPage from './pages/MatchingPage';
import ReviewPage from './pages/ReviewPage';
import MapPage from './pages/MapPage';
import ExportPage from './pages/ExportPage';
import HistoryPage from './pages/HistoryPage';
import UnmatchedPage from './pages/UnmatchedPage';

type Tab = 'import' | 'matching' | 'review' | 'map' | 'export' | 'history' | 'unmatched';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('import');
  const { currentJob, jobs, setCurrentJobId, resetApp } = useStore();
  const job = currentJob();

  const tabs = [
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'matching', label: 'Auto-Match', icon: RefreshCw, disabled: !job || job.osmData.length === 0 || job.googleData.length === 0 },
    { id: 'review', label: 'Review', icon: CheckSquare, disabled: !job || job.matches.length === 0 },
    { id: 'unmatched', label: 'Unmatched', icon: AlertCircle, disabled: !job || (job.unmatchedOSM.length === 0 && job.unmatchedGoogle.length === 0) },
    { id: 'map', label: 'Map View', icon: MapIcon, disabled: !job || job.matches.length === 0 },
    { id: 'export', label: 'Export', icon: Database, disabled: !job || job.matches.length === 0 },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight">Restaurant Matcher Pro</h1>
                <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-400 rounded">v1.1.0</span>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  {job ? `Job: ${job.name}` : 'No Job Selected'}
                </p>
                {jobs.length > 0 && (
                  <div className="relative group">
                    <button className="p-0.5 hover:bg-gray-100 rounded transition-colors">
                      <ChevronDown size={12} className="text-gray-400" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">
                      {jobs.map(j => (
                        <button 
                          key={j.id} 
                          onClick={() => { setCurrentJobId(j.id); setActiveTab('review'); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between ${j.id === job?.id ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-600'}`}
                        >
                          <span className="truncate">{j.name}</span>
                          {j.status === 'in_progress' && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                        </button>
                      ))}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button 
                          onClick={() => { setActiveTab('import'); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2"
                        >
                          <Plus size={12} /> New Job
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  disabled={tab.disabled}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : tab.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end mr-2">
               <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Cloud Sync Active
               </span>
               <span className="text-[9px] text-gray-400">Last saved: Just now</span>
            </div>
            <button 
              onClick={resetApp}
              className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
              title="Factory Reset"
            >
              <RefreshCw size={18} />
            </button>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 overflow-x-hidden">
        {activeTab === 'import' && <ImportPage onNext={() => setActiveTab('matching')} />}
        {activeTab === 'matching' && <MatchingPage onNext={() => setActiveTab('review')} />}
        {activeTab === 'review' && <ReviewPage />}
        {activeTab === 'unmatched' && <UnmatchedPage />}
        {activeTab === 'map' && <MapPage />}
        {activeTab === 'export' && <ExportPage />}
        {activeTab === 'history' && <HistoryPage onViewJob={(id) => { setCurrentJobId(id); setActiveTab('review'); }} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-[11px] text-gray-400 font-medium">
          <p>© 2024 Restaurant Matcher Pro • Enterprise Edition</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <Github size={14} /> Documentation
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <Info size={14} /> Help Center
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
