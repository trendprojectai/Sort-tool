
import React, { useState, useEffect } from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CheckCircle2, ChevronRight, Loader2, Zap, ShieldCheck } from 'lucide-react';
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
      setTimeout(runMatching, 1000);
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
        matches.push({
          osmData: osm,
          googleData: job.googleData[bestMatch.index],
          score: bestMatch.score,
          method: bestMatch.method,
          confidence: getConfidence(bestMatch.score),
          status: status,
          reviewed_at: status === 'auto_confirmed' ? new Date().toISOString() : undefined
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
    { name: 'High', value: stats.high, color: '#10B981' },
    { name: 'Medium', value: stats.medium, color: '#F59E0B' },
    { name: 'Low', value: stats.low, color: '#EF4444' },
  ];

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <Loader2 className="animate-spin text-blue-600" size={64} />
        <div className="text-center">
          <h3 className="text-xl font-bold mb-1">Applying logic patterns...</h3>
          <p className="text-gray-500">Matching {job?.osmData.length} records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-green-100 rounded-2xl">
            <CheckCircle2 className="text-green-600" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Matching Complete</h2>
            <p className="text-gray-500">We automatically verified {stats.autoConfirmed} records with 95%+ confidence.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 text-center">
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Total Matched</span>
            <div className="text-3xl font-black text-blue-700 mt-1">{stats.totalMatched}</div>
          </div>
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1"><ShieldCheck size={12}/> Auto-Confirmed</span>
            <div className="text-3xl font-black text-emerald-700 mt-1">{stats.autoConfirmed}</div>
          </div>
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 text-center">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Pending Review</span>
            <div className="text-3xl font-black text-amber-700 mt-1">{stats.needsReview}</div>
          </div>
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 text-center">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unmatched</span>
            <div className="text-3xl font-black text-gray-700 mt-1">{(job?.unmatchedOSM.length || 0) + (job?.unmatchedGoogle.length || 0)}</div>
          </div>
        </div>

        <div className="h-48 mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onNext}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 transition-all font-bold shadow-xl shadow-blue-100"
          >
            Review {stats.needsReview} Matches
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchingPage;
