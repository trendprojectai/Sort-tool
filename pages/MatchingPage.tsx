import React, { useState, useEffect } from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle2, ChevronRight, Loader2, Zap, ShieldCheck, Activity, Search } from 'lucide-react';
import { useStore } from '../store';
import { calculateMatchScore, getConfidence } from '../lib/utils';
import { Match, OSMRestaurant, GoogleRestaurant } from '../types';

interface MatchingPageProps {
  onNext: () => void;
}

const MatchingPage: React.FC<MatchingPageProps> = ({ onNext }) => {
  const { currentJob, setMatches } = useStore();
  const job = currentJob();
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [stats, setStats] = useState({
    totalMatched: 0,
    autoConfirmed: 0,
    needsReview: 0,
    high: 0,
    medium: 0,
    low: 0,
  });

  useEffect(() => {
    if (job && job.osmData.length && job.googleData.length) {
      setTimeout(runMatching, 1500);
    }
  }, []);

  const runMatching = () => {
    if (!job) return;
    
    const matches: Match[] = [];
    const unmatchedOSM: OSMRestaurant[] = [];
    const usedGoogleIndices = new Set<number>();

    job.osmData.forEach((osm) => {
      let bestMatch: { index: number; score: number; method: string } | null = null;

      job.googleData.forEach((google, idx) => {
        const { score, method } = calculateMatchScore(osm, google);
        if (score >= 70) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { index: idx, score, method };
          }
        }
      });

      if (bestMatch) {
        usedGoogleIndices.add(bestMatch.index);
        const status = bestMatch.score >= 95 ? 'auto_confirmed' : 'pending';
        const googleItem = job.googleData[bestMatch.index] as any;
        
        matches.push({
          osmData: osm,
          googleData: job.googleData[bestMatch.index],
          score: bestMatch.score,
          method: bestMatch.method,
          confidence: getConfidence(bestMatch.score),
          status: status,
          reviewed_at: status === 'auto_confirmed' ? new Date().toISOString() : undefined,
          // Carry over existing enrichment fields if present in source
          tripadvisor_status: googleItem.tripadvisor_status || null,
          tripadvisor_url: googleItem.tripadvisor_url || null,
          tripadvisor_confidence: googleItem.tripadvisor_confidence !== undefined ? Number(googleItem.tripadvisor_confidence) : null,
          tripadvisor_distance_m: googleItem.tripadvisor_distance_m !== undefined ? Number(googleItem.tripadvisor_distance_m) : null,
          tripadvisor_match_notes: googleItem.tripadvisor_match_notes || null
        });
      } else {
        unmatchedOSM.push(osm);
      }
    });

    const unmatchedGoogle = job.googleData.filter((_, idx) => !usedGoogleIndices.has(idx));

    setMatches(matches, unmatchedOSM, unmatchedGoogle);
    
    setStats({
      totalMatched: matches.length,
      autoConfirmed: matches.filter(m => m.status === 'auto_confirmed').length,
      needsReview: matches.filter(m => m.status === 'pending').length,
      high: matches.filter(m => m.confidence === 'High').length,
      medium: matches.filter(m => m.confidence === 'Medium').length,
      low: matches.filter(m => m.confidence === 'Low').length,
    });
    
    setIsProcessing(false);
  };

  const chartData = [
    { name: 'High Confidence', value: stats.high, color: '#10B981' },
    { name: 'Partial Match', value: stats.medium, color: '#F59E0B' },
    { name: 'Low Confidence', value: stats.low, color: '#ef4444' },
  ];

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-8 animate-in fade-in duration-700">
        <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative glass p-10 rounded-[3rem] border-indigo-100/50 neo-shadow">
                <Loader2 className="animate-spin text-indigo-600 mb-6 mx-auto" size={56} />
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-slate-800">Neural Sync Engine</h3>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Processing {job?.osmData.length.toLocaleString()} nodes...</p>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                <ShieldCheck size={28} />
            </div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">Sync Complete</h2>
          </div>
          <p className="text-slate-500 font-medium max-w-lg">The engine has automatically verified <span className="text-emerald-600 font-bold">{stats.autoConfirmed}</span> records with near-perfect confidence scores.</p>
        </div>

        <button 
          onClick={onNext}
          className="group flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-[1.25rem] hover:bg-indigo-600 transition-all font-black text-lg shadow-2xl hover:translate-y-[-4px]"
        >
          Review {stats.needsReview} Pending
          <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
            { label: 'Identified', value: stats.totalMatched, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
            { label: 'Auto-Locked', value: stats.autoConfirmed, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
            { label: 'Manual Queue', value: stats.needsReview, icon: Search, color: 'text-amber-600', bg: 'bg-amber-50/50' },
            { label: 'Unlinked', value: (job?.unmatchedOSM.length || 0) + (job?.unmatchedGoogle.length || 0), icon: Zap, color: 'text-slate-400', bg: 'bg-slate-50' }
        ].map((item, idx) => (
            <div key={idx} className={`p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all hover:border-white`}>
                <div className={`w-10 h-10 ${item.bg} ${item.color} rounded-xl flex items-center justify-center mb-6`}>
                    <item.icon size={20} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                <div className="text-4xl font-black text-slate-800 mt-2">{item.value.toLocaleString()}</div>
            </div>
        ))}
      </div>

      <div className="bg-white/50 border border-slate-100 rounded-[2.5rem] p-10 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-10 px-2">
            <div>
                <h3 className="text-lg font-black text-slate-800">Confidence Distribution</h3>
                <p className="text-sm font-medium text-slate-400">Heuristic matching quality analysis</p>
            </div>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
              />
              <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={60}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MatchingPage;