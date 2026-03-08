import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Clock, MapPin, Activity as ActivityIcon, HeartPulse, Mountain, TrendingUp, Award } from 'lucide-react';
import api from '../services/api';
import { decodePolyline } from '../utils/polyline';

// Mapping
import { MapContainer, TileLayer, Polyline as LeafletPolyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Charting
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PREffort {
  name: string;
  distance: number;
  elapsed_time: number;
}

interface Split {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_grade_adjusted_speed: number;
  average_heartrate: number;
  pace_zone: number;
}

interface StreamData {
  data: any[];
  series_type: string;
  original_size: number;
  resolution: string;
}

interface ActivityDetailData {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_pace: string;
  average_speed: number;
  max_speed: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  elevation_gain: number;
  start_date: string;
  map_polyline: string | null;
  achieved_prs: PREffort[];
  splits: Split[] | null;
  streams: Record<string, StreamData> | null;
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<ActivityDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const response = await api.get(`/activities/${id}`);
        setActivity(response.data);
      } catch (error) {
        console.error('Failed to fetch activity details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [id]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const formatPace = (speed: number) => {
    if (!speed) return '--';
    const paceSeconds = 1000 / speed;
    const mins = Math.floor(paceSeconds / 60);
    const secs = Math.floor(paceSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getHrColor = (hr: number | null) => {
    if (!hr) return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    if (hr < 130) return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800'; // Recovery
    if (hr < 150) return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800'; // Aerobic
    if (hr < 170) return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800'; // Threshold
    return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800'; // Anaerobic/Max
  };

  const getHrZoneText = (hr: number | null) => {
    if (!hr) return 'No HR Data';
    if (hr < 130) return 'Recovery / Light';
    if (hr < 150) return 'Aerobic / Base';
    if (hr < 170) return 'Threshold / Tempo';
    return 'Anaerobic / Max';
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto -mt-4 animate-pulse">
        <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-b-3xl -mx-4 sm:-mx-6 lg:-mx-8"></div>
        <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mx-2"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
           <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"></div>
           <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"></div>
           <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"></div>
           <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Activity not found</h2>
        <Link to="/activities" className="text-orange-500 hover:text-orange-600 mt-4 inline-block">
          Return to Activities
        </Link>
      </div>
    );
  }

  // --- MAP PREP ---
  let mapPositions: [number, number][] = [];
  if (activity.map_polyline) {
      mapPositions = decodePolyline(activity.map_polyline);
  }
  // Try to use stream latlng if available as it's more accurate
  let streamLatlng = activity.streams?.latlng?.data;
  if (streamLatlng && streamLatlng.length > 0) {
      mapPositions = streamLatlng as [number, number][];
  }

  // Calculate Map Bounds
  let mapCenter: [number, number] = [0, 0];
  let mapBounds: [[number, number], [number, number]] | null = null;
  if (mapPositions.length > 0) {
      mapCenter = mapPositions[0];
      const lats = mapPositions.map(p => p[0]);
      const lngs = mapPositions.map(p => p[1]);
      mapBounds = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)]
      ];
  }

  // --- CHART PREP ---
  const chartData = [];
  if (activity.streams) {
      const distStream = activity.streams.distance?.data;
      const hrStream = activity.streams.heartrate?.data;
      const altStream = activity.streams.altitude?.data;
      const paceStream = activity.streams.velocity_smooth?.data;

      if (distStream) {
          for (let i = 0; i < distStream.length; i++) {
              // Transform pace to seconds per km for charting (to reverse Y axis later or format it)
              // Handle infinity or zero pace
              let paceSecs = 0;
              if (paceStream && paceStream[i] > 0.5) { // filter out completely stopped or crazy data
                  paceSecs = 1000 / paceStream[i]; 
              }

              chartData.push({
                  distance: (distStream[i] / 1000).toFixed(2), // km
                  hr: hrStream ? hrStream[i] : null,
                  altitude: altStream ? altStream[i] : null,
                  pace: paceSecs > 0 ? paceSecs : null, // Store in seconds
                  paceFormatted: paceStream && paceStream[i] > 0 ? formatPace(paceStream[i]) : '--'
              });
          }
      }
  }

  // Pace Chart Tooltip Formatter
  const paceTooltipFormatter = (value: number | undefined) => {
    const mins = Math.floor((value ?? 0) / 60);
    const secs = Math.floor((value ?? 0) % 60);
    return [`${mins}:${secs.toString().padStart(2, '0')} /km`, 'Pace'];
  };

  return (
    <div className="pb-8">
      {/* Back Button */}
      <div className="mb-4">
         <Link to="/activities" className="inline-flex items-center text-sm text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to History
         </Link>
      </div>

      {/* Hero Map Section (Interactive) */}
      <div className="relative h-64 sm:h-80 md:h-96 -mx-4 sm:-mx-6 lg:-mx-8 bg-zinc-100 dark:bg-zinc-900 mb-8 border-b border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-inner isolate z-0">
        {mapBounds ? (
             <MapContainer
                 bounds={mapBounds}
                 className="w-full h-full z-0"
                 zoomControl={true}
                 scrollWheelZoom={false}
             >
                 <TileLayer
                     attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 />
                 <LeafletPolyline positions={mapPositions} pathOptions={{ color: '#f97316', weight: 4 }} />
             </MapContainer>
        ) : (
           <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
             <MapPin className="w-12 h-12 mb-2 opacity-50" />
             <p>No GPS Data Available</p>
           </div>
        )}
        
        {/* Header Content overlay on Map (pointer-events-none so we can click the map underneath) */}
        <div className="absolute bottom-6 left-0 right-0 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pointer-events-none">
           {/* Semi-transparent backdrop for text readability over the interactive map */}
           <div className="inline-block p-4 rounded-xl bg-white/80 dark:bg-black/80 backdrop-blur-md shadow-lg pointer-events-auto border border-zinc-200/50 dark:border-zinc-800/50">
               <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">{activity.name}</h1>
               <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-1">
                 {format(new Date(activity.start_date), 'EEEE, MMMM d, yyyy • h:mm a')}
               </p>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Trophy / PR Banner */}
        {activity.achieved_prs && activity.achieved_prs.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm">
             <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-inner shrink-0 mt-0.5">
               <Award className="w-6 h-6 text-white" />
             </div>
             <div>
               <h3 className="font-bold text-yellow-900 dark:text-yellow-500 text-lg mb-1">Personal Record Achieved!</h3>
               <p className="text-sm text-yellow-800 dark:text-yellow-200/80 leading-relaxed">
                 You set an all-time record during this run.
               </p>
               <div className="flex flex-wrap gap-2 mt-3">
                  {activity.achieved_prs.map(pr => (
                    <span key={pr.name} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/60 dark:bg-black/20 text-yellow-900 dark:text-yellow-500 text-xs font-bold rounded-lg border border-yellow-200/50 dark:border-yellow-700/30">
                      {pr.name} in {formatDuration(pr.elapsed_time)}
                    </span>
                  ))}
               </div>
             </div>
          </div>
        )}

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center text-zinc-500 dark:text-zinc-400 mb-3">
                 <MapPin className="w-4 h-4 mr-2" />
                 <span className="text-sm font-medium">Distance</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                 {(activity.distance / 1000).toFixed(2)} <span className="text-base font-normal text-zinc-500">km</span>
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center text-zinc-500 dark:text-zinc-400 mb-3">
                 <ActivityIcon className="w-4 h-4 mr-2" />
                 <span className="text-sm font-medium">Avg Pace</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                 {activity.average_pace || '--'} <span className="text-base font-normal text-zinc-500">/km</span>
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center text-zinc-500 dark:text-zinc-400 mb-3">
                 <Clock className="w-4 h-4 mr-2" />
                 <span className="text-sm font-medium">Moving Time</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                 {formatDuration(activity.moving_time)}
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center text-zinc-500 dark:text-zinc-400 mb-3">
                 <Mountain className="w-4 h-4 mr-2" />
                 <span className="text-sm font-medium">Elevation</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                 {Math.round(activity.elevation_gain || 0)} <span className="text-base font-normal text-zinc-500">m</span>
              </div>
           </div>
        </div>

        {/* Charts & Splits Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Charts */}
            <div className="lg:col-span-2 space-y-6">
               {/* Elevation Chart */}
               {chartData.length > 0 && chartData.some(d => d.altitude !== null) && (
                   <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                       <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center mb-6">
                           <Mountain className="w-4 h-4 text-emerald-500 mr-2" /> Elevation
                       </h3>
                       <div className="h-48 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                               <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                   <defs>
                                       <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                                           <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                           <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                       </linearGradient>
                                   </defs>
                                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                                   <XAxis dataKey="distance" minTickGap={30} tick={{fontSize: 12, fill: '#71717a'}} tickFormatter={(val) => `${val}km`} />
                                   <YAxis tick={{fontSize: 12, fill: '#71717a'}} width={40} domain={['dataMin', 'dataMax']} tickFormatter={(val) => `${Math.round(val)}m`} />
                                   <Tooltip 
                                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                      labelFormatter={(val) => `${val} km`}
                                       formatter={(val: any) => [`${Math.round(val ?? 0)} m`, 'Elevation'] as any}
                                   />
                                   <Area type="monotone" dataKey="altitude" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAlt)" isAnimationActive={false} />
                               </AreaChart>
                           </ResponsiveContainer>
                       </div>
                   </div>
               )}

               {/* Pace Chart */}
               {chartData.length > 0 && chartData.some(d => d.pace !== null) && (
                   <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                       <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center mb-6">
                           <TrendingUp className="w-4 h-4 text-blue-500 mr-2" /> Pace
                       </h3>
                       <div className="h-48 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                               <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                                   <XAxis dataKey="distance" minTickGap={30} tick={{fontSize: 12, fill: '#71717a'}} tickFormatter={(val) => `${val}km`} />
                                   {/* Pace is inverted so faster pace (lower seconds) is higher on the chart */}
                                   <YAxis tick={{fontSize: 12, fill: '#71717a'}} width={50} domain={['dataMin', 'dataMax']} reversed={true} tickFormatter={(val) => {
                                       const m = Math.floor(val/60);
                                       return `${m}:${Math.floor(val%60).toString().padStart(2, '0')}`;
                                   }} />
                                   <Tooltip 
                                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                      labelFormatter={(val) => `${val} km`}
                                       formatter={paceTooltipFormatter as any}
                                   />
                                   <Line type="monotone" dataKey="pace" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                               </LineChart>
                           </ResponsiveContainer>
                       </div>
                   </div>
               )}

               {/* HR Chart */}
               {chartData.length > 0 && chartData.some(d => d.hr !== null) && (
                   <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                       <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center mb-6">
                           <HeartPulse className="w-4 h-4 text-rose-500 mr-2" /> Heart Rate
                       </h3>
                       <div className="h-48 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                               <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                                   <XAxis dataKey="distance" minTickGap={30} tick={{fontSize: 12, fill: '#71717a'}} tickFormatter={(val) => `${val}km`} />
                                   <YAxis tick={{fontSize: 12, fill: '#71717a'}} width={40} domain={['dataMin', 'dataMax']} />
                                   <Tooltip 
                                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                      labelFormatter={(val) => `${val} km`}
                                       formatter={(val: any) => [`${Math.round(val ?? 0)} bpm`, 'Heart Rate'] as any}
                                   />
                                   <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                               </LineChart>
                           </ResponsiveContainer>
                       </div>
                   </div>
               )}
            </div>

            {/* Right Column: Splits Table */}
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                   <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center">
                          <ActivityIcon className="w-4 h-4 text-orange-500 mr-2" /> Kilometre Splits
                      </h3>
                   </div>
                   {activity.splits && activity.splits.length > 0 ? (
                       <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left">
                               <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 uppercase">
                                   <tr>
                                       <th className="px-4 py-3 font-medium">KM</th>
                                       <th className="px-4 py-3 font-medium">Pace</th>
                                       <th className="px-4 py-3 font-medium text-right">HR</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {activity.splits.map((split, i) => (
                                       <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                           <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                                               {split.split}
                                           </td>
                                           <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                                               {formatPace(split.average_speed)}
                                           </td>
                                           <td className="px-4 py-3 text-right">
                                               {split.average_heartrate ? (
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getHrColor(split.average_heartrate)} bg-transparent border-0`}>
                                                      {Math.round(split.average_heartrate)}
                                                  </span>
                                               ) : '--'}
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                   ) : (
                       <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                           No splits data available.
                       </div>
                   )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
