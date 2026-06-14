import { useState } from 'react';
import { Target, TrendingUp, AlertCircle, RefreshCw, CheckCircle2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';

export default function RacePredictionCard({ race, onUpdate }: { race: any, onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    setError(false);
    try {
      await api.post(`/ai/race-prediction/${race.id}`);
      onUpdate(); 
      setIsExpanded(true); // Auto expand after predicting
    } catch (err) {
      console.error('Failed to predict race:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const prediction = race.prediction;

  if (!prediction && !loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between group overflow-hidden relative gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full blur-3xl group-hover:bg-orange-600/20 transition-all"></div>
        <div className="relative z-10 flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
             <Target className="w-5 h-5 text-orange-500" />
           </div>
           <div>
             <h4 className="text-white font-bold mb-0.5">Race Potential Analyzer</h4>
             <p className="text-xs text-zinc-400 max-w-xs">Let AI simulate your race readiness and predict 3 possible finish times.</p>
           </div>
        </div>
        <button
          onClick={handlePredict}
          className="relative z-10 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
        >
          <TrendingUp className="w-4 h-4" /> Analyze
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mt-4 flex flex-col items-center justify-center text-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium text-white">Running Simulations...</p>
        <p className="text-xs text-zinc-500 mt-1">Analyzing pace trends and endurance capacity</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 mt-4 flex items-center gap-3">
        <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
        <p className="text-sm text-red-200">Failed to generate prediction.</p>
        <button onClick={handlePredict} className="ml-auto text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg">Retry</button>
      </div>
    );
  }

  const getReadinessColor = (colorStr: string = '') => {
    switch (colorStr.toLowerCase()) {
      case 'hijau': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'kuning': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'merah': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getGapColor = (status: string = '') => {
    if (status.includes('di atas')) return 'text-red-400';
    if (status.includes('di bawah')) return 'text-emerald-400';
    return 'text-blue-400';
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl mt-4 relative overflow-hidden transition-all duration-300">
      {/* Background glow when expanded */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[80px] pointer-events-none transition-opacity duration-500 ${isExpanded ? 'opacity-100' : 'opacity-0'} ${
        prediction.readinessLevel?.color === 'hijau' ? 'bg-emerald-500/20' : 
        prediction.readinessLevel?.color === 'kuning' ? 'bg-amber-500/20' : 'bg-rose-500/20'
      }`}></div>

      {/* Expandable Header */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-zinc-800/30 transition-colors text-left relative z-10"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">AI Prediction Console</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Click to view race analysis & predictions</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {!isExpanded && prediction.readinessLevel?.percentage && (
            <div className={`hidden sm:flex px-3 py-1 rounded-full text-[10px] font-bold border items-center gap-1.5 ${getReadinessColor(prediction.readinessLevel?.color)}`}>
              {prediction.readinessLevel?.percentage}% Readiness
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
        </div>
      </button>

      {/* Expanded Content with CSS Grid transition */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-6 pt-0 border-t border-zinc-800/50 mt-2">
            
            <div className="flex items-center justify-between mb-6 pt-4">
              <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getReadinessColor(prediction.readinessLevel?.color)}`}>
                {prediction.readinessLevel?.percentage}% Overall Readiness
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handlePredict(); }} 
                className="text-white hover:text-orange-400 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5" 
                title="Recalculate Predictions"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-Analyze
              </button>
            </div>

            <p className="text-xs text-zinc-300 mb-6 italic border-l-2 border-zinc-700 pl-3">"{prediction.readinessLevel?.message}"</p>

            {/* Scenarios Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Pessimistic</span>
                <span className="text-base sm:text-lg font-mono font-bold text-zinc-400">{prediction.prediction?.pessimisticFinishTime}</span>
              </div>
              <div className="bg-zinc-800 border border-zinc-700/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg transform -translate-y-1">
                <span className="text-[10px] font-bold text-orange-500 uppercase mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Realistic</span>
                <span className="text-lg sm:text-xl font-mono font-black text-white">{prediction.prediction?.realisticFinishTime}</span>
                <span className="text-[10px] text-zinc-400 mt-1">{prediction.prediction?.realisticPace}</span>
              </div>
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Optimistic</span>
                <span className="text-base sm:text-lg font-mono font-bold text-emerald-400">{prediction.prediction?.optimisticFinishTime}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Analysis Summary */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Info className="w-3 h-3" /> Area Analysis</div>
                {prediction.analysis && Object.entries(prediction.analysis).map(([key, data]: [string, any]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-white font-mono">{data.score}/10</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(data.score / 10) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Immediate Recommendations */}
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4">
                <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">Coach Action Plan</div>
                <ul className="space-y-2">
                  {prediction.immediateRecommendations?.map((rec: string, idx: number) => (
                    <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                      <div className="w-1 h-1 rounded-full bg-orange-500 mt-1.5 shrink-0"></div>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Gap Status */}
            <div className="mt-4 pt-4 border-t border-zinc-700/50 flex items-center justify-between">
              <div className="text-xs text-zinc-400">Target Time Analysis:</div>
              <div className={`text-xs font-bold ${getGapColor(prediction.prediction?.gapStatus)}`}>
                {prediction.prediction?.gapFromTarget} ({prediction.prediction?.gapStatus})
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
