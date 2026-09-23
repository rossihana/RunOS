import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { HeartPulse } from 'lucide-react';

export interface HealthRow {
  date: string;
  hrv: number | null;
  sleep: number | null;
  vo2max: number | null;
  rhr: number | null;
}

const COLORS = { hrv: '#fb7185', sleep: '#a5b4fc', vo2max: '#34d399', rhr: '#facc15' };

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as HealthRow;
  if (!row) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-4 shadow-2xl shadow-black/30">
      <p className="text-xs font-bold text-white mb-2">
        {format(parseISO(row.date), 'EEEE, d MMM yyyy', { locale: id })}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-rose-400">HRV</span>
          <span className="font-bold text-white">{row.hrv ?? '—'} ms</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-indigo-300">Sleep Score</span>
          <span className="font-bold text-white">{row.sleep ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-emerald-400">VO2max</span>
          <span className="font-bold text-white">{row.vo2max ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-amber-400">RHR</span>
          <span className="font-bold text-white">{row.rhr ?? '—'} bpm</span>
        </div>
      </div>
    </div>
  );
};

export default function HealthTrendChart({ data }: { data: HealthRow[] }) {
  if (!data || data.length === 0) return null;
  const last = data[data.length - 1];
  const chips = [
    { label: 'HRV', value: last.hrv != null ? `${last.hrv} ms` : '—', color: 'text-rose-400' },
    { label: 'Sleep', value: last.sleep != null ? `${last.sleep}` : '—', color: 'text-indigo-300' },
    { label: 'VO2max', value: last.vo2max != null ? `${last.vo2max}` : '—', color: 'text-emerald-400' },
    { label: 'RHR', value: last.rhr != null ? `${last.rhr}` : '—', color: 'text-amber-400' },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Garmin Health Trend</h3>
            <p className="text-[10px] text-zinc-500">HRV • Sleep Score • VO2max — {data.length} hari terakhir (sync harian)</p>
          </div>
        </div>
        <div className="flex gap-2">
          {chips.map(c => (
            <div key={c.label} className="px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-center">
              <div className={`text-sm font-black ${c.color}`}>{c.value}</div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Terbaru</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => format(parseISO(v), 'd MMM', { locale: id })}
              stroke="#52525b"
              tick={{ fontSize: 10 }}
              interval={Math.max(Math.floor(data.length / 6), 1)}
            />
            {/* HRV & VO2max skala kiri; Sleep skala kanan (0-100) */}
            <YAxis yAxisId="left" stroke="#52525b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
            <YAxis yAxisId="right" orientation="right" stroke="#52525b" tick={{ fontSize: 10 }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Line yAxisId="left" type="monotone" dataKey="hrv" stroke={COLORS.hrv} strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="right" type="monotone" dataKey="sleep" stroke={COLORS.sleep} strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="left" type="monotone" dataKey="vo2max" stroke={COLORS.vo2max} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
            <Line yAxisId="left" type="monotone" dataKey="rhr" stroke={COLORS.rhr} strokeWidth={2} strokeDasharray="2 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-5 mt-3 text-[10px] font-medium">
        <span className="text-rose-400">━ HRV (ms, kiri)</span>
        <span className="text-indigo-300">━ Sleep Score (kanan 0-100)</span>
        <span className="text-emerald-400">╍ VO2max (kiri)</span>
        <span className="text-amber-400">┈ RHR (bpm, kiri)</span>
      </div>
    </div>
  );
}
