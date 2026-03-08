import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Activity, Calendar, HeartPulse, Target, Clock, ArrowRight, Award, ChevronUp, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNumberCounter } from '../hooks/useNumberCounter';
import { format, differenceInDays } from 'date-fns';

interface PR {
  name: string;
  distance: string;
  timeFormatted: string;
  date: string;
}

interface Summary {
  totalRuns: number;
  weeklyMileage: string;
  monthlyMileage: string;
  averagePace: string;
  averageHeartRate: number;
  trends: {
    weeklyMileage: number;
    monthlyMileage: number;
  };
  prs: PR[];
}

interface Race {
  id: number;
  race_name: string;
  distance: number;
  race_date: string;
  target_time: string;
  target_pace: string;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [nextRace, setNextRace] = useState<Race | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = async () => {
    try {
      const [summaryRes, chartsRes, racesRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/charts'),
        api.get('/races')
      ]);
      setSummary(summaryRes.data);
      setChartData(chartsRes.data);
      
      const upcomingRaces = (racesRes.data as Race[]).filter(r => new Date(r.race_date) >= new Date());
      upcomingRaces.sort((a, b) => new Date(a.race_date).getTime() - new Date(b.race_date).getTime());
      if (upcomingRaces.length > 0) {
        setNextRace(upcomingRaces[0]);
      } else {
        setNextRace(null);
      }

    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      toast.error('Failed to load dashboard data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Syncing activities from Strava...');
    try {
      const res = await api.post('/activities/sync');
      await fetchData();
      toast.success(res.data.count > 0 ? `Synced ${res.data.count} new activities!` : 'All activities are up to date.', { id: toastId });
    } catch (error) {
      console.error('Sync failed', error);
      toast.error('Failed to sync activities.', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const getPaceDiff = (currentPace: string, targetPace: string) => {
    if (!currentPace || !targetPace || currentPace === '0:00') return null;
    const toSecs = (p: string) => {
      const [m, s] = p.split(':').map(Number);
      return m * 60 + s;
    };
    const cSecs = toSecs(currentPace);
    const tSecs = toSecs(targetPace);
    const diff = cSecs - tSecs; // if diff > 0, current pace is slower than target
    
    if (diff === 0) return { text: "On target!", color: "text-emerald-600 dark:text-emerald-400" };
    
    const absDiff = Math.abs(diff);
    const m = Math.floor(absDiff / 60);
    const s = absDiff % 60;
    const diffStr = `${m}:${s.toString().padStart(2, '0')}`;
    
    if (diff > 0) return { text: `${diffStr} /km too slow`, color: "text-red-500 dark:text-red-400" };
    return { text: `${diffStr} /km faster!`, color: "text-emerald-600 dark:text-emerald-400" };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Your running performance at a glance.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-800 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors shadow-sm`}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Activities'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Weekly Mileage" 
          value={Number(summary?.weeklyMileage || 0)} 
          unit="km"
          icon={TrendingUp} 
          decimals={2}
          trend={summary?.trends?.weeklyMileage}
        />
        <StatCard 
          title="Monthly Mileage" 
          value={Number(summary?.monthlyMileage || 0)} 
          unit="km"
          icon={Calendar}
          decimals={2}
          trend={summary?.trends?.monthlyMileage}
        />
        <StatCard 
          title="Avg Pace (30d)" 
          valueText={summary?.averagePace || '0:00'} 
          unit="/km"
          icon={Activity} 
        />
        <StatCard 
          title="Avg Heart Rate" 
          value={summary?.averageHeartRate || 0} 
          unit="bpm"
          icon={HeartPulse} 
        />
      </div>

      {/* PR Badges & Next Race */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Next Race Banner (Takes 2 columns on lg screens) */}
        {nextRace ? (
          <div className="lg:col-span-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
              <Target className="w-48 h-48" />
            </div>
            
            <div className="z-10">
              <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1 uppercase tracking-wider">
                <Calendar className="w-4 h-4" /> Next Up
              </div>
              <h2 className="text-2xl font-bold mb-1">{nextRace.race_name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-white/90">
                <span>{format(new Date(nextRace.race_date), 'MMMM d, yyyy')}</span>
                <span>•</span>
                <span>{nextRace.distance} km</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 flex items-center gap-6 z-10">
              <div className="text-center">
                <div className="text-3xl font-bold">{differenceInDays(new Date(nextRace.race_date), new Date())}</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Days Left</div>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-right">
                    <div className="text-xs text-white/70 font-medium">Target Pace</div>
                    <div className="font-bold">{nextRace.target_pace || '--'} <span className="text-xs font-normal opacity-70">/km</span></div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/50" />
                  <div>
                    <div className="text-xs text-white/70 font-medium">Current Pace</div>
                    <div className="font-bold">{summary?.averagePace || '--'} <span className="text-xs font-normal opacity-70">/km</span></div>
                  </div>
                </div>
                {summary?.averagePace && nextRace.target_pace && (
                  <div className={`text-xs font-semibold px-2 py-1 rounded-md inline-block bg-white/20 backdrop-blur-sm ${getPaceDiff(summary.averagePace, nextRace.target_pace)?.color.replace('text-', 'text-white ')}`}>
                    Gap: {getPaceDiff(summary.averagePace, nextRace.target_pace)?.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
             <Target className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
             <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No Upcoming Races</h3>
             <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">Set a target in the Races tab to track your training pace gap.</p>
          </div>
        )}

        {/* PR Badges - Best Efforts Details */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col h-full max-h-[350px]">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center shrink-0">
            <Award className="w-5 h-5 text-yellow-500 mr-2" />
            Best Efforts
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[
                { id: '5K', label: '5K', defaultDistance: '5.00' },
                { id: '10K', label: '10K', defaultDistance: '10.00' },
                { id: '15K', label: '15K', defaultDistance: '15.00' },
                { id: '20K', label: '20K', defaultDistance: '20.00' },
                { id: 'Half-Marathon', label: 'Half Marathon', defaultDistance: '21.10' },
                { id: '30K', label: '30K', defaultDistance: '30.00' },
                { id: 'Marathon', label: 'Full Marathon', defaultDistance: '42.20' }
              ].map((cat) => {
                const prData = summary?.prs?.find(pr => pr.name === cat.id);
                return (
                  <div key={cat.id} className="flex items-center justify-between py-3 group">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors">{cat.label}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{prData ? prData.date : 'No record'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{prData ? prData.timeFormatted : '--:--'}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{prData ? prData.distance : cat.defaultDistance} km</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Recent Distance Trend (km)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-distance)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-distance)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-sans)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-sans)' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'var(--font-sans)', fontSize: 14, backgroundColor: 'var(--tw-prose-body)' }}
                  wrapperClassName="dark:!bg-zinc-900 dark:!border-zinc-800 dark:!text-zinc-100"
                />
                <Area type="monotone" dataKey="distance" stroke="var(--chart-distance)" strokeWidth={3} fillOpacity={1} fill="url(#colorDistance)" dot={{ r: 4, fill: 'var(--chart-distance)', strokeWidth: 2, stroke: 'var(--bg-card)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Recent Pace Trend (min/km)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPace" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-pace)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-pace)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-sans)' }} dy={10} />
                <YAxis reversed axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-sans)' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'var(--font-sans)', fontSize: 14 }}
                  wrapperClassName="dark:!bg-zinc-900 dark:!border-zinc-800 dark:!text-zinc-100"
                  formatter={(value: any) => [`${Number(value).toFixed(2)} min/km`, 'Pace']}
                />
                <Area type="monotone" dataKey="pace" stroke="var(--chart-pace)" strokeWidth={3} fillOpacity={1} fill="url(#colorPace)" dot={{ r: 4, fill: 'var(--chart-pace)', strokeWidth: 2, stroke: 'var(--bg-card)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, valueText, unit, icon: Icon, decimals = 0, trend }: { title: string, value?: number, valueText?: string, unit: string, icon: any, decimals?: number, trend?: number }) {
  const animatedValue = useNumberCounter(value || 0);

  const renderTrend = () => {
    if (trend === undefined) return null;
    
    const isPositive = trend > 0;
    const isNegative = trend < 0;
    const isNeutral = trend === 0;

    let color = 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400';
    let IconComponent = null;

    if (isPositive) {
      color = 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10';
      IconComponent = ChevronUp;
    } else if (isNegative) {
      color = 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10';
      IconComponent = ChevronDown;
    }

    return (
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium px-2 py-1 rounded-md inline-flex ${color}`}>
        {IconComponent && <IconComponent className="w-3 h-3" />}
        <span>{isNeutral ? 'No change' : `${Math.abs(trend)}%`}</span>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-start justify-between transition-transform hover:-translate-y-1 hover:shadow-md duration-200 group">
      <div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-1">
          {valueText ? valueText : animatedValue.toFixed(decimals)} 
          <span className="text-lg text-zinc-500 dark:text-zinc-400 ml-1">{unit}</span>
        </p>
        {renderTrend()}
      </div>
      <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}
