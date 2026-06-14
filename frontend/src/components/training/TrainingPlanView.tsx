import React from 'react';
import { Calendar, CheckCircle2, Info, ChevronRight, Timer, Footprints, Target, Award, ArrowRight } from 'lucide-react';
import { parseISO, addDays, format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Session {
  day: string;
  type: string;
  distance: number;
  targetPace: string;
  duration: string;
  notes: string;
}

interface WeeklyPlan {
  week: number;
  theme: string;
  totalKm: number;
  sessions: Session[];
}

interface Phase {
  phaseName: string;
  phaseNumber: number;
  durationWeeks: number;
  weekRange: string;
  goal: string;
  trainingFocus: string[];
  targetTrainingPace: string;
  weeklyPlan: WeeklyPlan[];
}

interface TrainingPlan {
  summary: string;
  totalWeeks: number;
  phases: Phase[];
  coachTips: {
    baseBuilding: string[];
    buildPhase: string[];
    peakPhase: string[];
    tapering: string[];
  };
  raceDay: {
    nutritionAdvice: string;
    warmupAdvice: string;
    strategyAdvice: string;
  };
}

export default function TrainingPlanView({ plan }: { plan: TrainingPlan }) {
  const [activePhase, setActivePhase] = React.useState(0);

  const phase = plan.phases[activePhase];

  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Award className="w-32 h-32 text-orange-500" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-orange-500" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">AI Periodized Training Plan</span>
          </div>
          <h2 className="text-2xl font-black mb-3">Road to Race Day</h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">{plan.summary}</p>
          <div className="flex gap-4 mt-6">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Duration</span>
              <span className="text-sm font-bold">{plan.totalWeeks} Weeks</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Total Phases</span>
              <span className="text-sm font-bold">{plan.phases.length} Phases</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {plan.phases.map((p, idx) => (
          <button
            key={idx}
            onClick={() => setActivePhase(idx)}
            className={`flex-shrink-0 px-5 py-3 rounded-2xl text-xs font-bold transition-all border ${
              activePhase === idx 
                ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            Phase {p.phaseNumber}: {p.phaseName}
          </button>
        ))}
      </div>

      {/* Active Phase Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Phase Details Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
             <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-orange-500" /> Phase Objective
             </h3>
             <div className="space-y-4">
               <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Goal</span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">{phase.goal}</p>
               </div>
               <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Target Pace</span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">{phase.targetTrainingPace}</p>
               </div>
               <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Training Focus</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {phase.trainingFocus.map((f, i) => (
                      <span key={i} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 rounded-lg">{f}</span>
                    ))}
                  </div>
               </div>
             </div>
          </div>

          <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6 text-orange-600 dark:text-orange-400">
             <h3 className="text-sm font-bold uppercase mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Coach Tips
             </h3>
             <ul className="space-y-2">
                {(plan.coachTips as any)[Object.keys(plan.coachTips)[activePhase]]?.map((tip: string, idx: number) => (
                  <li key={idx} className="text-xs flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {tip}
                  </li>
                ))}
             </ul>
          </div>
        </div>

        {/* Weekly Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {phase.weeklyPlan.map((week) => (
            <div key={week.week} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
               <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center font-bold text-sm">W{week.week}</div>
                    <div>
                       <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{week.theme}</h4>
                       <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{week.totalKm} KM Total Volume</span>
                    </div>
                  </div>
               </div>
               <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {week.sessions.map((session, sIdx) => {
                    let dateDisplay = "";
                    let dayDisplay = session.day;
                    if ((week as any).startDate) {
                      const startDateObj = parseISO((week as any).startDate);
                      if (!isNaN(startDateObj.getTime())) {
                        const daysMap: Record<string, number> = { 'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4, 'Sabtu': 5, 'Minggu': 6 };
                        const offset = daysMap[session.day] || 0;
                        const sessionDate = addDays(startDateObj, offset);
                        dateDisplay = format(sessionDate, 'd MMMM', { locale: id });
                        dayDisplay = format(sessionDate, 'EEEE', { locale: id }).toUpperCase();
                      }
                    }

                    return (
                    <div key={sIdx} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors flex flex-col sm:flex-row sm:items-center gap-4">
                       <div className="w-16 sm:text-right shrink-0">
                         <div className="text-xs font-bold text-zinc-400 uppercase">{dayDisplay}</div>
                         {dateDisplay && <div className="text-[10px] text-zinc-500 font-medium sm:mt-0.5 mt-1 truncate">{dateDisplay}</div>}
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                               session.type.toLowerCase().includes('rest') ? 'bg-zinc-200 text-zinc-600' : 
                               session.type.toLowerCase().includes('tempo') || session.type.toLowerCase().includes('interval') ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' :
                               'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                             }`}>{session.type}</span>
                             <span className="text-sm font-bold text-zinc-900 dark:text-white">{session.distance > 0 ? `${session.distance} KM` : ''}</span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">{session.notes}</p>
                       </div>
                       <div className="flex items-center gap-4 shrink-0 sm:pl-4">
                          {session.targetPace !== '-' && (
                            <div className="flex items-center gap-1.5 min-w-[80px]">
                               <Timer className="w-3.5 h-3.5 text-zinc-400" />
                               <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">{session.targetPace}</span>
                            </div>
                          )}
                          {session.duration !== '-' && (
                            <div className="flex items-center gap-1.5 min-w-[70px]">
                               <Clock className="w-3.5 h-3.5 text-zinc-400" />
                               <span className="text-xs font-mono font-medium text-zinc-500">{session.duration}</span>
                            </div>
                          )}
                        </div>
                     </div>
                    );
                  })}
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Race Day Strategy */}
      <div className="bg-gradient-to-r from-orange-600 to-rose-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-600/20 border border-white/10">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
               <Target className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight">Race Day Execution Strategy</h3>
         </div>
         
         <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
               <span className="text-[10px] font-bold uppercase text-orange-100/70 border-b border-orange-100/20 pb-1 block">Nutrition & Hydration</span>
               <p className="text-xs leading-relaxed text-orange-50 font-medium">{plan.raceDay.nutritionAdvice}</p>
            </div>
            <div className="space-y-3">
               <span className="text-[10px] font-bold uppercase text-orange-100/70 border-b border-orange-100/20 pb-1 block">Warm-up Protocol</span>
               <p className="text-xs leading-relaxed text-orange-50 font-medium">{plan.raceDay.warmupAdvice}</p>
            </div>
            <div className="space-y-3">
               <span className="text-[10px] font-bold uppercase text-orange-100/70 border-b border-orange-100/20 pb-1 block">Pacing Strategy</span>
               <p className="text-xs leading-relaxed text-orange-50 font-medium">{plan.raceDay.strategyAdvice}</p>
            </div>
         </div>
      </div>
    </div>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}
