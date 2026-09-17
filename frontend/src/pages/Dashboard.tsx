import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Activity, 
  Calendar, 
  Target, 
  Award, 
  RefreshCw, 
  Play,
  ArrowUpRight,
  TrendingUp,
  Zap,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import TrainingLog from '@/components/dashboard/TrainingLog';
import DistanceTrend from '@/components/charts/DistanceTrend';
import MapThumbnail from '@/components/dashboard/MapThumbnail';
import AICoachWidget from '@/components/dashboard/AICoachWidget';
import RacePredictionCard from '@/components/dashboard/RacePredictionCard';
import ReadinessChart from '@/components/charts/ReadinessChart';

interface Activity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  map_polyline: string | null;
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
  prs: Array<{
    name: string;
    distance: string;
    timeFormatted: string;
    date: string;
  }>;
}

interface Race {
  id: number;
  race_name: string;
  distance: number;
  race_date: string;
  target_time: string;
  target_pace: string;
  prediction?: any;
}

export default function Dashboard() {
  const queryClient = useQueryClient();

  const results = useQueries({
    queries: [
      { queryKey: ['dashboard', 'summary'], queryFn: async () => (await api.get('/analytics/summary')).data },
      { queryKey: ['dashboard', 'races'], queryFn: async () => (await api.get('/races')).data },
      { queryKey: ['dashboard', 'trainingLog'], queryFn: async () => (await api.get('/analytics/training-log')).data },
      { queryKey: ['dashboard', 'recentTrend'], queryFn: async () => (await api.get('/analytics/recent-trend')).data },
      { queryKey: ['dashboard', 'activities'], queryFn: async () => (await api.get('/activities?limit=5')).data },
      { queryKey: ['dashboard', 'readiness'], queryFn: async () => (await api.get('/activities/analytics/readiness')).data }
    ]
  });

  const isLoading = results.some(q => q.isLoading);
  const [summaryRes, racesRes, logRes, trendRes, activitiesRes, readinessRes] = results;

  const summary = summaryRes.data as Summary | undefined;
  const races = (racesRes.data as Race[]) || [];
  const trainingLog = logRes.data;
  const recentTrend = trendRes.data;
  const activities = (activitiesRes.data as Activity[]) || [];
  const readinessData = readinessRes.data || [];

  const syncMutation = useMutation({
    mutationFn: async () => {
      // S7: kalau Garmin sudah terhubung di akun → jalur per-user (JWT, tanpa secret)
      try {
        const st = await api.get('/activities/garmin/status');
        if (st.data?.connected) {
          const res = await api.post('/activities/garmin/sync', { days: 14, details: true });
          return res.data;
        }
      } catch { /* fallback ke jalur owner */ }
      // Jalur owner (SYNC_SECRET) — untuk akun pemilik & cron
      let secret = localStorage.getItem('runos_sync_secret') || '';
      if (!secret) {
        secret = prompt('Masukkan Sync Secret (lihat backend/.env SYNC_SECRET):') || '';
        if (!secret) throw new Error('Sync dibatalkan — secret dibutuhkan');
        localStorage.setItem('runos_sync_secret', secret);
      }
      const res = await api.post('/activities/sync', {}, { headers: { 'X-Sync-Secret': secret } });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Sync dimulai — menunggu sampai selesai…');
      // Polling status sync tiap 5 dtk sampai done/failed (bukan delay tebakan).
      // Jalur per-user: GET /garmin/status → { status: { status, detail }, connected }
      let polls = 0;
      const MAX_POLLS = 60; // 5 menit maksimum
      const tick = setInterval(async () => {
        polls++;
        try {
          const st = await api.get('/activities/garmin/status');
          const jobStatus = st.data?.status?.status;
          if (jobStatus === 'done') {
            clearInterval(tick);
            toast.success('✅ Sync selesai — data terbaru dimuat!');
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          } else if (jobStatus === 'failed') {
            clearInterval(tick);
            const detail = String(st.data?.status?.detail || '').slice(-160);
            toast.error(`Sync gagal: ${detail}`);
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          } else if (polls >= MAX_POLLS) {
            clearInterval(tick);
            toast.error('Sync timeout — cek status di halaman Garmin Sync.');
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          }
        } catch {
          if (polls >= MAX_POLLS) { clearInterval(tick); toast.error('Sync status tak terjangkau.'); }
        }
      }, 5000);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Sync gagal';
      toast.error(msg);
      if (String(msg).includes('secret')) localStorage.removeItem('runos_sync_secret');
      console.error('Error syncing activities:', err);
    }
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, 
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const upcomingRaces = races.filter(race => new Date(race.race_date).getTime() >= new Date().setHours(0,0,0,0));
  const nextRace = upcomingRaces.length > 0 ? upcomingRaces[0] : null;

  // Helper for pace difference
  const getPaceDiff = (avgPace: string, targetPace: string) => {
    if (!avgPace || !targetPace) return null;
    const toS = (p: string) => {
      const [m, s] = p.split(':').map(Number);
      return m * 60 + (s || 0);
    };
    const diff = toS(avgPace) - toS(targetPace);
    const absDiff = Math.abs(diff);
    const mins = Math.floor(absDiff / 60);
    const secs = absDiff % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    if (diff <= 0) return { text: `-${timeStr} Ahead`, color: 'text-emerald-500' };
    return { text: `+${timeStr} Behind`, color: 'text-red-500' };
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Welcome back! Here's your training progress.</p>
        </div>
        <button 
           onClick={handleSync}
           disabled={syncMutation.isPending}
           className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync & Refresh'}
        </button>
      </div>

      {/* Stats Overview */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { label: 'Weekly Mileage', value: summary?.weeklyMileage || '0.00', unit: 'km', icon: Activity, color: 'orange', trend: summary?.trends?.weeklyMileage },
          { label: 'Monthly Mileage', value: summary?.monthlyMileage || '0.00', unit: 'km', icon: Calendar, color: 'blue', trend: summary?.trends?.monthlyMileage },
          { label: 'Avg Pace', value: summary?.averagePace || '0:00', unit: '/km', icon: Zap, color: 'purple' },
          { label: 'Avg Heart Rate', value: summary?.averageHeartRate || '0', unit: 'bpm', icon: Activity, color: 'rose' },
        ].map((stat, idx) => (
          <motion.div 
            key={idx}
            variants={itemVariants}
            className="group relative bg-white dark:bg-[#1C1C1E] p-6 rounded-[2rem] border border-zinc-200/50 dark:border-white/5 shadow-xl shadow-zinc-200/40 dark:shadow-black/20 transition-all hover:shadow-2xl hover:shadow-zinc-300/50 dark:hover:shadow-black/40 hover:-translate-y-1 overflow-hidden"
          >
            {/* Subtle Gradient Background */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${stat.color}-500/5 rounded-full blur-2xl group-hover:bg-${stat.color}-500/10 transition-all duration-500`}></div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-600/10 flex items-center justify-center transition-transform group-hover:scale-110`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{stat.label}</span>
            </div>
            
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">
                {stat.label.includes('Avg') ? stat.value : <AnimatedNumber value={parseFloat(stat.value as string)} />}
              </span>
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{stat.unit}</span>
            </div>

            {stat.trend !== undefined && (
              <div className={`mt-4 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${stat.trend >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'text-red-500 bg-red-50 dark:bg-red-500/10'}`}>
                {stat.trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5 rotate-180" />}
                {Math.abs(stat.trend)}% <span className="opacity-60 font-medium">vs last {stat.label.includes('Weekly') ? 'week' : 'month'}</span>
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Upcoming Races & AI Coach Widget */}
        <div className="lg:col-span-2 xl:col-span-2 h-full flex flex-col gap-4">
          {upcomingRaces.length > 0 ? (
            <div className="flex flex-col gap-6">
              {upcomingRaces.map((race) => (
                <div key={race.id} className="flex flex-col gap-0">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-orange-600/20 transition-all duration-700"></div>
                    
                    <div className="relative flex flex-col sm:flex-row justify-between h-full gap-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-600/20 rotate-3 group-hover:rotate-0 transition-transform shrink-0">
                          <Target className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Upcoming Race</div>
                          <h3 className="text-2xl font-black text-white">{race.race_name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-zinc-400 font-medium">
                            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(new Date(race.race_date), 'MMMM d, yyyy')}</span>
                            <span className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> {race.distance} km</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Target Time</div>
                          <div className="text-lg font-black text-white">{race.target_time}</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Target Pace</div>
                          <div className="text-lg font-black text-white">{race.target_pace || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* AI Prediction Card - Now a distinct card */}
                  <RacePredictionCard race={race} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
               <Target className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
               <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No Upcoming Races</h3>
               <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">Set a target in the Races tab to track your training pace.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 xl:col-span-1">
          <AICoachWidget />
        </div>

        {/* Training Log Section */}
        <div className="lg:col-span-1 xl:col-span-2">
           <TrainingLog data={trainingLog} />
        </div>

        {/* Best Efforts List */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col h-full lg:col-span-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center shrink-0">
            <Award className="w-5 h-5 text-yellow-500 mr-2" />
            Best Efforts
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                  <div key={cat.id} className="flex items-center justify-between py-2.5 group">
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

        {/* Readiness Chart */}
        <div className="lg:col-span-2 xl:col-span-3">
          <ReadinessChart data={readinessData} />
        </div>

        {/* Distance Trend Chart */}
        <div className="lg:col-span-2 xl:col-span-2">
           <DistanceTrend data={recentTrend} />
        </div>

        {/* Recent Activities Feed */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 lg:col-span-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center">
            <Activity className="w-5 h-5 text-orange-600 mr-2" />
            Recent Runs
          </h3>
          <div className="space-y-4">
            {activities.slice(0, 5).length > 0 ? activities.slice(0, 5).map((activity) => (
              <Link 
                key={activity.id} 
                to={`/activities/${activity.id}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group cursor-pointer border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
              >
                <div className="w-14 h-14 md:w-16 md:h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors overflow-hidden border border-zinc-200 dark:border-zinc-700">
                  <MapThumbnail polyline={activity.map_polyline} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors">{activity.name}</div>
                  <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{format(parseISO(activity.start_date_local || activity.start_date), 'MMM d, yyyy')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-zinc-900 dark:text-white">{(activity.distance / 1000).toFixed(1)} km</div>
                  <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">{Math.floor(activity.moving_time / 60)}m</div>
                </div>
              </Link>
            )) : (
              <div className="text-center py-6 text-zinc-500 text-sm">No recent activities found</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// Sub-component for animated numbers
function AnimatedNumber({ value }: { value: number }) {
  const animatedValue = useNumberCounter(value);
  // Check if it should be float or int
  const displayValue = Number.isInteger(value) 
    ? Math.floor(animatedValue) 
    : animatedValue.toFixed(2);
  
  return <>{displayValue}</>;
}

// Custom Counter Hook
function useNumberCounter(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);



  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
}
