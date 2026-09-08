import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendData {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  monthLabel: string;
  distance: number;
}

interface ThisWeek {
  distance: number;
  time: number;
  elevation: number;
}

interface RecentTrendData {
  thisWeek: ThisWeek;
  trendData: TrendData[];
  maxDistance: number;
}

interface DistanceTrendProps {
  data: RecentTrendData | null;
}

export default function DistanceTrend({ data }: DistanceTrendProps) {
  if (!data) return null;

  const formatMovingTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Group trend data to find month transitions for XAxis labels
  const renderedData = data.trendData.map((d, i) => ({
    ...d,
    // Only show month label if it's the first data point or different from previous
    showMonth: i === 0 || d.monthLabel !== data.trendData[i - 1].monthLabel
  }));

  const yTicks = [0, data.maxDistance / 2, data.maxDistance];

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 flex flex-col shadow-sm border border-zinc-200 dark:border-zinc-800/0 h-full text-zinc-900 dark:text-white font-sans transition-colors">
      {/* Metrics Section */}
      <h2 className="text-xl font-bold tracking-tight mb-6">This week</h2>
      
      <div className="grid grid-cols-3 gap-6 mb-10">
        <div>
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Distance</div>
          <div className="text-2xl font-extrabold tracking-tight">{data.thisWeek.distance.toFixed(2)} <span className="text-base font-bold">km</span></div>
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Time</div>
          <div className="text-2xl font-extrabold tracking-tight">{formatMovingTime(data.thisWeek.time)}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Elev Gain</div>
          <div className="text-2xl font-extrabold tracking-tight">{data.thisWeek.elevation} <span className="text-base font-bold">m</span></div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex-1 flex flex-col min-h-[180px]">
        <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wider">Past 12 weeks</div>
        
        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={renderedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FC5200" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FC5200" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="0" stroke="#E5E7EB" className="dark:stroke-zinc-800" />
              <XAxis 
                dataKey="weekStart" 
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => {
                  const { x, y, payload, index } = props;
                  const item = renderedData[index];
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {item.showMonth && (
                        <text x={0} y={35} dy={16} textAnchor="middle" fill="#71717A" className="text-[11px] font-bold uppercase tracking-widest">
                          {item.monthLabel}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
              <YAxis 
                orientation="right"
                axisLine={false}
                tickLine={false}
                ticks={yTicks}
                tickFormatter={(val) => `${Math.round(val)} km`}
                tick={{ fill: "#71717A", fontSize: 13, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ stroke: '#FC5200', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    const startStr = format(new Date(d.weekStart), 'MMM d');
                    const endStr = format(new Date(d.weekEnd), 'MMM d');
                    return (
                      <div className="bg-zinc-900 border border-zinc-700 p-2 rounded-lg shadow-xl outline-none">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold mb-1">
                          {startStr} — {endStr}
                        </div>
                        <div className="text-white font-bold text-sm">{d.distance.toFixed(2)} km</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="distance" 
                stroke="#FC5200" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorDistance)" 
                activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2, fill: '#FC5200' }}
                dot={{ r: 3, fill: '#FC5200', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          
          {/* Vertical white end line matching classic running-app UI */}
          <div className="absolute top-[10px] bottom-[38px] right-[48px] w-[2px] bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
