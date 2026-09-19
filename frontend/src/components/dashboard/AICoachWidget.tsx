import { useState } from 'react';
import { Sparkles, TrendingUp, Info, ChevronRight, ChevronDown, ChevronUp, MessageSquare, Timer, Activity, Footprints, AlertCircle, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface AIAnalysis {
  analysisDate: string;
  daysToRace: number;
  thisWeekAnalysis: {
    compliancePercentage: number;
    positiveHighlights: string[];
    attentionHighlights: string[];
  };
  conditionDiagnosis: {
    physicalCondition: string;
    physicalConditionMessage: string;
    planStatus: string;
    planStatusMessage: string;
    trainingPhase: string;
  };
  tomorrowRecommendation: {
    date: string;
    sessionType: string;
    sessionTitle: string;
    distance: number;
    targetPace: string;
    estimatedDuration: string;
    heartRateZone: string;
    sessionStructure: Array<{
      part: string;
      duration: string;
      instruction: string;
    }>;
    recommendationReason: string;
    executionTips: string[];
    ifSkipped: string;
  };
  forwardOutlook: {
    next3DaysFocus: string;
    specialWarning: string;
    coachMotivation: string;
  };
}

export default function AICoachWidget() {
  const [data, setData] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.post('/ai/dashboard-analysis');
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch AI analysis:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const conditionColors: Record<string, string> = {
    'SEGAR': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    'NORMAL': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'LELAH RINGAN': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'LELAH BERAT': 'text-red-400 bg-red-400/10 border-red-400/20',
    'PERLU ISTIRAHAT': 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  };

  const getConditionStyle = (cond: string) => conditionColors[cond] || 'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl p-6 text-white shadow-xl border border-zinc-800 flex flex-col h-full relative overflow-hidden group">
      {/* Decorative Sparkle Background */}
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
        <Sparkles className="w-32 h-32 text-orange-500 fill-orange-500" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Sparkles className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">AI Coach Insights</h3>
              <p className="text-xs text-zinc-400 font-medium">Analytic • Supportive</p>
            </div>
          </div>
          <Link to="/ai-coach" aria-label="AI Coach" className="text-zinc-400 hover:text-white transition-colors p-2 bg-zinc-800 rounded-lg">
            <MessageSquare className="w-4 h-4" />
          </Link>
        </div>

        {!data && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-6">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">Let AI analyze your 1-week trend.</p>
              <p className="text-xs text-zinc-500 mt-1">Get personalized training suggestions.</p>
            </div>
            <button
              onClick={fetchAnalysis}
              className="mt-2 bg-white text-black hover:bg-zinc-200 px-6 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2"
            >
              Analyze Now <ChevronRight className="w-4 h-4" />
            </button>
            {error && <p className="text-xs text-red-400 mt-2">Failed to load analysis. Please try again.</p>}
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-6">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-zinc-400 animate-pulse">Consulting with AI Coach...</p>
          </div>
        )}

        {data && !loading && (
          <div className="flex-1 flex flex-col">
            <div className={`relative ${!expanded ? 'max-h-[320px] overflow-hidden' : ''}`}>
              <div className="space-y-6">
            
            {/* Condition Diagnosis */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Physical</span>
                    <Heart className="w-3.5 h-3.5 text-zinc-400" />
                 </div>
                 <div className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold mb-1 border ${getConditionStyle(data.conditionDiagnosis.physicalCondition ?? 'NORMAL')}`}>
                    {data.conditionDiagnosis.physicalCondition}
                 </div>
                 <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{data.conditionDiagnosis.physicalConditionMessage}</p>
              </div>
              
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Plan Status</span>
                    <Activity className="w-3.5 h-3.5 text-zinc-400" />
                 </div>
                 <div className="text-sm font-bold text-white mb-1 truncate">{data.conditionDiagnosis.planStatus}</div>
                 <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{data.conditionDiagnosis.planStatusMessage}</p>
              </div>
            </div>

            {/* Warning if any */}
            {data.forwardOutlook?.specialWarning && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3 text-amber-200/90 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <p>{data.forwardOutlook.specialWarning}</p>
              </div>
            )}

            {/* Next Workout Detailed */}
            {data.tomorrowRecommendation && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl overflow-hidden">
                <div className="bg-zinc-800 px-4 py-2 border-b border-zinc-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Suggested for Tomorrow</span>
                  </div>
                  <span className="text-[10px] font-medium text-zinc-500">{data.tomorrowRecommendation.date}</span>
                </div>
                
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-white mb-1">{data.tomorrowRecommendation.sessionTitle}</h4>
                    <span className="inline-block px-2 py-1 bg-zinc-700/50 text-orange-400 text-[10px] font-bold uppercase rounded">{data.tomorrowRecommendation.sessionType}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/20 rounded-lg p-2 flex flex-col justify-center items-center text-center">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Distance</span>
                      <span className="text-sm font-black text-white">{data.tomorrowRecommendation.distance} <span className="text-[10px] text-zinc-400 font-normal">km</span></span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 flex flex-col justify-center items-center text-center">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Pace</span>
                      <span className="text-sm font-black text-white">{data.tomorrowRecommendation.targetPace}</span>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 flex flex-col justify-center items-center text-center">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Duration</span>
                      <span className="text-sm font-black text-white">{data.tomorrowRecommendation.estimatedDuration?.replace('~', '')}</span>
                    </div>
                  </div>

                  {data.tomorrowRecommendation.sessionStructure && data.tomorrowRecommendation.sessionStructure.length > 0 && (
                     <div className="space-y-2 mt-2 pt-3 border-t border-zinc-700/50">
                        {data.tomorrowRecommendation.sessionStructure.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></div>
                             <div>
                                <span className="text-xs font-bold text-zinc-300 mr-1">{step.part} ({step.duration}):</span>
                                <span className="text-xs text-zinc-400">{step.instruction}</span>
                             </div>
                          </div>
                        ))}
                     </div>
                  )}
                </div>
              </div>
            )}

            {/* Coach Motivation */}
            {data.forwardOutlook?.coachMotivation && (
              <div className="text-sm font-medium text-zinc-400 italic text-center px-4 leading-relaxed">
                "{data.forwardOutlook.coachMotivation}"
              </div>
            )}

            <button
              onClick={fetchAnalysis}
              className="w-full py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1"
            >
              Update Analysis
            </button>
              </div>

              {/* Gradient fade overlay when collapsed */}
              {!expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-900 via-zinc-900/90 to-transparent pointer-events-none" />
              )}
            </div>

            {/* Expand/Collapse Toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 w-full py-2.5 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors flex items-center justify-center gap-1.5 bg-zinc-800/50 rounded-xl border border-zinc-700/50 hover:border-zinc-600/50"
            >
              {expanded ? (
                <><ChevronUp className="w-3.5 h-3.5" /> Show Less</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> Show More</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
