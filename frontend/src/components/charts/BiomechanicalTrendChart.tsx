import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Footprints } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BiomechanicalData {
  week: string;
  cadence: number;
  stride: number;
}

interface Props {
  data: BiomechanicalData[];
}

export default function BiomechanicalTrendChart({ data }: Props) {
  if (!data || data.length === 0) return null;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMM');
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-zinc-800 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg">
          <p className="text-zinc-500 text-xs font-bold mb-2">{formatDate(label)}</p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-600 dark:text-zinc-300 text-sm font-medium">{entry.name}:</span>
              <span className="text-zinc-900 dark:text-white font-bold text-sm">
                {entry.value} {entry.name === 'Cadence' ? 'spm' : 'm'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Biomechanics Trend</h3>
          <p className="text-[10px] text-zinc-500">Cadence vs Stride (12 Minggu Terakhir)</p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="week" 
              tickFormatter={formatDate}
              stroke="#52525b" 
              fontSize={10} 
              tickMargin={10}
              tickLine={false}
              axisLine={false}
            />
            {/* Left Y Axis for Cadence */}
            <YAxis 
              yAxisId="left"
              domain={['dataMin - 5', 'dataMax + 5']}
              stroke="#52525b" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}`}
            />
            {/* Right Y Axis for Stride */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={['dataMin - 0.1', 'dataMax + 0.1']}
              stroke="#52525b" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val.toFixed(2)}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="cadence" 
              name="Cadence"
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#18181b' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="stride" 
              name="Stride"
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#18181b' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex justify-between px-2 text-[10px] font-bold uppercase tracking-wider">
        <span className="text-blue-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Cadence (spm)</span>
        <span className="text-emerald-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Stride (m)</span>
      </div>
    </div>
  );
}
