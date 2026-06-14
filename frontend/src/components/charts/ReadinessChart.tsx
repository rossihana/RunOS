import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Activity, Zap, ShieldAlert, HeartPulse, Footprints } from 'lucide-react';

interface ActivityMeta {
  name: string;
  distance: number;
  load: number;
}

interface ReadinessData {
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  activities?: ActivityMeta[];
}

interface Props {
  data: ReadinessData[];
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload as ReadinessData;
  if (!dataPoint) return null;

  const formValue = dataPoint.form;
  let formColor = 'text-yellow-500';
  let formLabel = 'Productive';
  if (formValue > 5) { formColor = 'text-emerald-500'; formLabel = 'Fresh'; }
  if (formValue < -20) { formColor = 'text-rose-500'; formLabel = 'Fatigued'; }

  const acts = dataPoint.activities || [];

  return (
    <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-4 shadow-2xl shadow-black/30 min-w-[220px] max-w-[280px]">
      {/* Date Header */}
      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
        {format(parseISO(label), 'EEEE, d MMMM yyyy', { locale: id })}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <div className="text-[9px] text-indigo-400 font-bold uppercase">Fitness</div>
          <div className="text-sm font-black text-indigo-400">{dataPoint.fitness}</div>
        </div>
        <div>
          <div className="text-[9px] text-orange-400 font-bold uppercase">Fatigue</div>
          <div className="text-sm font-black text-orange-400">{dataPoint.fatigue}</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-400 font-bold uppercase">Form</div>
          <div className={`text-sm font-black ${formColor}`}>
            {formValue > 0 ? "+" + formValue : formValue}
          </div>
        </div>
      </div>

      {/* Form Status Badge */}
      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-3 ${
        formValue > 5 ? 'bg-emerald-500/10 text-emerald-400' :
        formValue < -20 ? 'bg-rose-500/10 text-rose-400' :
        'bg-yellow-500/10 text-yellow-400'
      }`}>
        {formLabel}
      </div>

      {/* Activity Details */}
      {acts.length > 0 ? (
        <div className="border-t border-zinc-700/50 pt-3 space-y-2">
          {acts.map((act, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Footprints className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{act.name}</div>
                <div className="text-[10px] text-zinc-400">
                  {(act.distance / 1000).toFixed(1)} km • Load +{act.load}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t border-zinc-700/50 pt-3">
          <div className="text-[10px] text-zinc-500 italic">Rest Day — No activities</div>
        </div>
      )}
    </div>
  );
};

const ReadinessChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const todayData = data[data.length - 1];
  const { form, fitness, fatigue } = todayData;

  let statusColor = "text-yellow-600 dark:text-yellow-400";
  let statusBg = "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
  let statusText = "Productive";
  let StatusIcon = Activity;

  if (form > 5) {
    statusColor = "text-emerald-600 dark:text-emerald-400";
    statusBg = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800";
    statusText = "Fresh / Race Ready";
    StatusIcon = Zap;
  } else if (form < -20) {
    statusColor = "text-rose-600 dark:text-rose-400";
    statusBg = "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800";
    statusText = "Overreaching / High Fatigue";
    StatusIcon = ShieldAlert;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-indigo-500" />
            Training Readiness
          </h2>
          <p className="text-sm text-zinc-500 font-medium mt-1">
            Fitness vs Fatigue balance (TSB Model)
          </p>
        </div>

        <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${statusBg}`}>
          <StatusIcon className={`w-4 h-4 ${statusColor}`} />
          <div>
             <div className="text-[10px] uppercase font-bold text-zinc-500 opacity-80 tracking-wider">Today's Form</div>
             <div className={`text-sm font-black ${statusColor}`}>
               {form > 0 ? "+" + form : form} • {statusText}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
         <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
           <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Fitness (CTL)</div>
           <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{fitness}</div>
           <div className="text-[10px] text-zinc-400 mt-1 leading-tight">42-day avg load</div>
         </div>
         <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
           <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Fatigue (ATL)</div>
           <div className="text-xl font-black text-orange-600 dark:text-orange-400">{fatigue}</div>
           <div className="text-[10px] text-zinc-400 mt-1 leading-tight">7-day avg load</div>
         </div>
         <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hidden md:block">
           <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Form (TSB)</div>
           <div className="text-xl font-black text-zinc-900 dark:text-white">{form > 0 ? "+" + form : form}</div>
           <div className="text-[10px] text-zinc-400 mt-1 leading-tight">Fitness - Fatigue</div>
         </div>
      </div>

      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFitness" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFatigue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickFormatter={(val) => format(parseISO(val), 'd MMM', { locale: id })}
              minTickGap={20}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#71717a' }} 
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <ReferenceLine y={0} stroke="#a1a1aa" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey="fitness" 
              name="Fitness (CTL)"
              stroke="#6366f1" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorFitness)" 
              animationDuration={1500}
            />
            <Area 
              type="monotone" 
              dataKey="fatigue" 
              name="Fatigue (ATL)"
              stroke="#f97316" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorFatigue)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ReadinessChart;

