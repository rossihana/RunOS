import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Split, 
  Calendar, 
  Activity, 
  Clock, 
  ChevronRight, 
  Info,
  AlertCircle,
  TrendingUp,
  Award
} from 'lucide-react';
import { parseISO, addDays, format } from 'date-fns';
import { id } from 'date-fns/locale';

interface MasterPlanProps {
  plan: any;
}

const MasterPlanView: React.FC<MasterPlanProps> = ({ plan }) => {
  const [activeWeek, setActiveWeek] = useState(1);
  const { ringkasanStrategi, konflikYangDiselesaikan, masterPlan, mingguKhusus, tipsPelatih } = plan;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. Summary Strategy */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-purple-600/5 rounded-[2.5rem] -m-4"></div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-600/10 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Master Strategy</h2>
              <p className="text-sm text-zinc-500 font-medium">Cohesive multi-race planning logic</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {ringkasanStrategi.penjelasan}
            </div>
            
            <div className="space-y-4">
              {ringkasanStrategi.prioritasRace.map((race: any, i: number) => (
                <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className={`w-4 h-4 ${i === 1 ? 'text-yellow-500' : 'text-zinc-400'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{race.peran}</span>
                  </div>
                  <h4 className="font-bold text-zinc-900 dark:text-white">{race.namaRace}</h4>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Target Time</span>
                    <span className="text-sm font-black text-indigo-600">{race.targetDirevisi}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Conflict Resolutions */}
      {konflikYangDiselesaikan && konflikYangDiselesaikan.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
              <Split className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-400">Conflict Resolutions</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {konflikYangDiselesaikan.map((conflict: any, i: number) => (
              <div key={i} className="bg-white dark:bg-zinc-900/50 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/10">
                <div className="text-[10px] font-bold text-amber-600 uppercase mb-2">Minggu {conflict.week}</div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">{conflict.konflik}</p>
                <div className="bg-emerald-50 dark:bg-emerald-500/5 p-3 rounded-xl flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-400 leading-relaxed"><span className="font-bold">Solusi:</span> {conflict.solusi}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Master Weekly Plan */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-600/10 rounded-2xl">
              <Calendar className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Master Weekly Schedule</h3>
              <p className="text-sm font-medium text-zinc-500 mt-1">
                Hari ini: <span className="font-bold text-rose-600">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide max-w-[200px] sm:max-w-md">
            {masterPlan.map((p: any) => (
              <button
                key={p.week}
                onClick={() => setActiveWeek(p.week)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${
                  activeWeek === p.week 
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                W{p.week}
              </button>
            ))}
          </div>
        </div>

        {masterPlan.map((week: any) => week.week === activeWeek && (
          <div key={week.week} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="px-8 py-6 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xl font-black text-zinc-900 dark:text-white">{week.tema}</h4>
                <p className="text-sm text-zinc-500 font-medium">
                  {week.startDate ? `${format(parseISO(week.startDate), 'd MMM', { locale: id })} - ${format(addDays(parseISO(week.startDate), 6), 'd MMM yyyy', { locale: id })}` : week.tanggal}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center px-4 border-r border-zinc-200 dark:border-zinc-700">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Weekly Load</p>
                  <p className="text-lg font-black text-rose-600">{week.totalKm} km</p>
                </div>
                <div className="text-center px-4 border-r border-zinc-200 dark:border-zinc-700">
                   <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{week.faseRace1}</p>
                   <p className="text-xs font-bold text-zinc-500">Race 1</p>
                </div>
                <div className="text-center px-4">
                   <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{week.faseRace2}</p>
                   <p className="text-xs font-bold text-zinc-500">Race 2</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {week.catatan && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-500/5 rounded-2xl border border-orange-100 dark:border-orange-500/10">
                   <Info className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                   <p className="text-sm text-orange-800 dark:text-orange-400 font-medium italic">{week.catatan}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {week.sesi.map((sesi: any, i: number) => {
                  // Date calculation based on actual calendar days
                  let dateDisplay = "";
                  let dayDisplay = sesi.hari;
                  if (week.startDate) {
                    const startDateObj = parseISO(week.startDate);
                    if (!isNaN(startDateObj.getTime())) {
                      const daysMap: Record<string, number> = { 'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4, 'Sabtu': 5, 'Minggu': 6 };
                      const offset = daysMap[sesi.hari] || 0;
                      const sessionDate = addDays(startDateObj, offset);
                      dateDisplay = format(sessionDate, 'd MMMM', { locale: id });
                      dayDisplay = format(sessionDate, 'EEEE', { locale: id }).toUpperCase();
                    }
                  } else if (week.tanggal) {
                    const match = week.tanggal.match(/(\d{1,2})\s+([a-zA-Z]+)(?:.*?(20\d{2}))?/);
                    if (match) {
                      const startDay = parseInt(match[1]);
                      const monthStr = match[2].toLowerCase();
                      const yearStr = match[3] || new Date().getFullYear().toString();
                      
                      const monthMap: Record<string, number> = {
                        'jan': 0, 'januari': 0, 'feb': 1, 'februari': 1,
                        'mar': 2, 'maret': 2, 'apr': 3, 'april': 3,
                        'mei': 4, 'jun': 5, 'juni': 5, 'jul': 6, 'juli': 6,
                        'agu': 7, 'agustus': 7, 'sep': 8, 'september': 8,
                        'okt': 9, 'oktober': 9, 'nov': 10, 'november': 10,
                        'des': 11, 'desember': 11
                      };
                      
                      const month = monthMap[monthStr] !== undefined ? monthMap[monthStr] : new Date().getMonth();
                      const startDate = new Date(parseInt(yearStr), month, startDay);
                      
                      const daysMap: Record<string, number> = { 'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4, 'Sabtu': 5, 'Minggu': 6 };
                      const offset = daysMap[sesi.hari] || 0;
                      
                      const sessionDate = new Date(startDate);
                      sessionDate.setDate(startDate.getDate() + offset);
                      
                      const inverseMonthMap = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                      dateDisplay = `${sessionDate.getDate()} ${inverseMonthMap[sessionDate.getMonth()]}`;
                      dayDisplay = format(sessionDate, 'EEEE', { locale: id }).toUpperCase();
                    }
                  }

                  return (
                  <div key={i} className="group bg-zinc-50 dark:bg-zinc-800/30 hover:bg-white dark:hover:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-900 transition-all cursor-default">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-rose-500 transition-colors">{dayDisplay}</span>
                        {dateDisplay && <p className="text-xs font-bold text-zinc-500">{dateDisplay}</p>}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sesi.tipe === 'Istirahat' ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}>
                        {sesi.tipe}
                      </div>
                    </div>
                    
                    {sesi.jarak > 0 ? (
                      <>
                        <div className="flex items-baseline gap-2 mb-4">
                          <span className="text-3xl font-black text-zinc-900 dark:text-white">{sesi.jarak}</span>
                          <span className="text-sm font-bold text-zinc-400">km</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2">
                             <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                             <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{sesi.targetPace}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5 text-zinc-400" />
                             <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{sesi.durasi}</span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                           <span className="text-[10px] font-bold text-zinc-400">Tujuan:</span>
                           <span className="text-[10px] font-bold text-rose-500 uppercase">{sesi.untukRace}</span>
                        </div>
                        {sesi.catatan && (
                          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 italic">"{sesi.catatan}"</p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
                        <Activity className="w-8 h-8 opacity-20 mb-2" />
                        <span className="text-xs font-medium">Recovery Day</span>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Special Weeks (Taper/Recovery) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(mingguKhusus).map(([key, data]: [string, any]) => (
          <div key={key} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${
              key.includes('Sebelum') ? 'bg-orange-500' : 'bg-blue-500'
            }`}></div>
            <div className="flex items-center gap-2 mb-4">
               <AlertCircle className={`w-4 h-4 ${key.includes('Sebelum') ? 'text-orange-500' : 'text-blue-500'}`} />
               <h5 className="text-sm font-bold text-zinc-900 dark:text-white">{data.tema}</h5>
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase mb-3">Minggu {data.week}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold italic">"{data.pesan}"</p>
          </div>
        ))}
      </div>

      {/* 5. Coach Tips */}
      <div className="bg-zinc-900 dark:bg-black rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Split className="w-48 h-48 rotate-12" />
        </div>
        
        <div className="relative">
          <h3 className="text-2xl font-black mb-8">Coach Multi-Race Tips</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <h5 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">General Protocol</h5>
              <ul className="space-y-3">
                {tipsPelatih.umumMultiRace.map((tip: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm font-medium">
                    <span className="text-indigo-400 font-bold">#</span> {tip}
                  </li>
                ))}
              </ul>
              
              <h5 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 mt-8">Transition Period</h5>
              <ul className="space-y-3">
                {tipsPelatih.antaraRace.map((tip: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm font-medium">
                    <span className="text-emerald-400 font-bold">#</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm p-8 rounded-[2rem] border border-white/10">
              <h5 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">Specific Race Tactics</h5>
              <div className="space-y-6">
                <div>
                   <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Race 1 Focus</p>
                   {tipsPelatih.seputarRace1.map((tip: string, i: number) => (
                     <p key={i} className="text-xs text-zinc-300 leading-relaxed mb-2">• {tip}</p>
                   ))}
                </div>
                <div className="pt-4 border-t border-white/10">
                   <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Race 2 Focus</p>
                   {tipsPelatih.seputarRace2.map((tip: string, i: number) => (
                     <p key={i} className="text-xs text-zinc-300 leading-relaxed mb-2">• {tip}</p>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default MasterPlanView;
