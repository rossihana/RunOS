import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Activity, HeartPulse, Footprints } from 'lucide-react';

interface SplitData {
  split: number;
  hr: number;
  pace: number; // in decimal minutes, e.g., 5.5 = 5:30/km
  distance?: number;
}

interface AerobicDecouplingChartProps {
  data: {
    hasBase: boolean;
    driftPercentage: number;
    splitsData: SplitData[];
  };
}

export default function AerobicDecouplingChart({ data }: AerobicDecouplingChartProps) {
  if (!data || !data.splitsData || data.splitsData.length === 0) return null;

  // Format decimal pace back to mm:ss
  const formatPace = (decimalPace: number) => {
    const mins = Math.floor(decimalPace);
    const secs = Math.round((decimalPace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length >= 2) {
      const splitData = payload[0].payload;
      const isPartial = splitData.distance && splitData.distance < 950;
      const displayLabel = isPartial 
        ? `KM ${splitData.split} (${(splitData.distance / 1000).toFixed(2)}km)` 
        : `KM ${splitData.split}`;

      return (
        <div className="bg-zinc-900 border border-zinc-700/50 p-3 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-zinc-400 text-xs font-bold mb-2 uppercase tracking-wider">{displayLabel}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-white text-sm font-semibold">{payload[0].value} <span className="text-[10px] text-zinc-500 font-normal">bpm</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Footprints className="w-3.5 h-3.5 text-indigo-400" />
              {/* Pace scale is inverted so we get the raw value directly from payload */ }
              <span className="text-white text-sm font-semibold">{formatPace(payload[1].value)} <span className="text-[10px] text-zinc-500 font-normal">/km</span></span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Aerobic Decoupling</h3>
            <p className="text-[10px] text-zinc-500">Pace vs HR pada lari jauh terakhir</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-zinc-800/50 px-3 py-2 rounded-2xl">
           <div className="text-right">
             <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">HR Drift</div>
             <div className="text-lg font-black text-white leading-none">
               {data.driftPercentage > 0 ? '+' : ''}{data.driftPercentage}%
             </div>
           </div>
           <div className={`w-2 h-10 rounded-full ${data.hasBase ? 'bg-emerald-500' : 'bg-orange-500'}`} />
        </div>
      </div>

      <div className="flex-1 min-h-[250px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.splitsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="split" 
              stroke="#52525b" 
              fontSize={10} 
              tickMargin={10} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(val, index) => {
                const item = data.splitsData[index];
                return item?.distance && item.distance < 950 ? `${val}k*` : `${val}k`;
              }}
            />
            {/* Left Y Axis for HR */}
            <YAxis 
              yAxisId="hr" 
              stroke="#52525b" 
              fontSize={10} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(val) => `${val}`}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            {/* Right Y Axis for Pace (Inverted so faster pace = higher point) */}
            <YAxis 
              yAxisId="pace" 
              orientation="right" 
              stroke="#52525b" 
              fontSize={10} 
              axisLine={false} 
              tickLine={false}
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              reversed={true} // Faster pace (lower number) goes up!
              tickFormatter={formatPace}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Legend 
               verticalAlign="bottom" 
               height={36} 
               iconType="circle"
               wrapperStyle={{ fontSize: '11px', color: '#a1a1aa', paddingTop: '10px' }}
            />
            
            <Line 
              yAxisId="hr" 
              type="monotone" 
              name="Heart Rate"
              dataKey="hr" 
              stroke="#f43f5e" // rose-500
              strokeWidth={3} 
              dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} 
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={1500}
            />
            <Line 
              yAxisId="pace" 
              type="monotone"
              name="Pace" 
              dataKey="pace" 
              stroke="#818cf8" // indigo-400
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: '#818cf8', strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={1500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-zinc-500">
           {data.hasBase 
              ? "Garis HR dan Pace berjalan sejajar. Fondasi aerobikmu sangat kuat! 🚀"
              : "Garis HR naik menjauh dari Pace (decoupling). Perbanyak lari zona 2 untuk memperkuat base. 🐢"
           }
        </p>
      </div>
    </div>
  );
}
