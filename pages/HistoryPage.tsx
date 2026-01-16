
import React from 'react';
import { History, Calendar, CheckCircle2, ChevronRight, BarChart3, Archive, Trash2 } from 'lucide-react';
import { useStore } from '../store';

interface HistoryPageProps {
  onViewJob: (id: string) => void;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ onViewJob }) => {
  const { jobs } = useStore();

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Project History</h2>
          <p className="text-gray-500 text-sm">Access your previous workspaces and archived reports.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold text-gray-500">
             <BarChart3 size={14}/> {jobs.length} Total Projects
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {jobs.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
             <History size={48} className="mx-auto text-gray-200 mb-4" />
             <p className="text-gray-500 font-medium">No history available yet.</p>
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
               <div className="flex items-start justify-between">
                 <div className="flex gap-4">
                    <div className={`p-4 rounded-2xl ${job.status === 'in_progress' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                       {job.status === 'in_progress' ? <RefreshCw className="animate-spin-slow"/> : <Archive />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900 mb-1">{job.name}</h3>
                      <p className="text-sm text-gray-500 mb-4">{job.description || 'No description provided'}</p>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <Calendar size={12}/> {new Date(job.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                          <CheckCircle2 size={12}/> {job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed').length} Matches
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="flex flex-col items-end gap-2">
                   <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${job.status === 'in_progress' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                     {job.status.replace('_', ' ')}
                   </span>
                   <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => onViewJob(job.id)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="Open Workspace">
                       <ChevronRight size={20}/>
                     </button>
                     <button className="p-2 hover:bg-gray-100 text-gray-400 rounded-lg transition-colors">
                       <Trash2 size={20}/>
                     </button>
                   </div>
                 </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
  </svg>
);

export default HistoryPage;
