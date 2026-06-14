import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from 'recharts';

interface ZoneData {
  zone: number;
  label: string;
  color: string;
  seconds: number;
  percentage: number;
  min?: number;
  max?: number;
}

interface Props {
  data: ZoneData[];
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m} menit`;
};

const getInsight = (data: ZoneData[]): string | null => {
  if (!data.length) return null;
  const z2 = data.find(d => d.zone === 2);
  const z4 = data.find(d => d.zone === 4);
  const z5 = data.find(d => d.zone === 5);

  if (z2 && z2.percentage < 30) return `Zona 2 (Aerobik) hanya ${z2.percentage}% dari larimu. Idealnya 60-80%. Coba lebih banyak easy run!`;
  if ((z4?.percentage ?? 0) + (z5?.percentage ?? 0) > 40) return `Terlalu banyak waktu di Zona 4–5 (${(z4?.percentage ?? 0) + (z5?.percentage ?? 0)}%). Risiko overtraining meningkat. Perlambat di hari-hari recovery.`;
  return `Distribusi zona harianmu terlihat seimbang. Pertahankan proporsi ini!`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ZoneData;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs shadow-2xl">
      <div className="font-black text-white mb-1">Zona {d.zone} — {d.label}</div>
      <div className="text-zinc-400">{formatTime(d.seconds)} ({d.percentage}%)</div>
      {d.min !== undefined && (
        <div className="text-zinc-500 mt-1">Threshold: {d.min}–{d.max ?? '∞'} bpm</div>
      )}
    </div>
  );
};

export default function HRZoneChart({ data }: Props) {
  const insight = getInsight(data);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="mb-5">
        <h3 className="text-base font-black text-white">Distribusi Zona HR</h3>
        <p className="text-xs text-zinc-500 mt-0.5">30 hari terakhir — dari lari yang punya data HR</p>
      </div>

      {/* Zone Legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {data.map(z => (
          <div key={z.zone} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
            <span className="text-[10px] text-zinc-400 font-medium">Z{z.zone}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="zone" tickFormatter={(v) => `Z${v}`} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.zone} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insight */}
      {insight && (
        <div className="mt-4 pt-4 border-t border-zinc-800/60 flex items-start gap-2">
          <span className="text-base">💡</span>
          <p className="text-xs text-zinc-300 leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}
