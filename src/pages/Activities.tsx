import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity as ActivityIcon, Clock, MapPin, HeartPulse, Search, SearchX, ArrowDownUp, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import MapThumbnail from '../components/MapThumbnail';

interface Activity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  average_pace: string;
  average_heartrate: number;
  start_date: string;
  map_polyline: string | null;
}

type SortOption = 'date_desc' | 'date_asc' | 'distance_desc' | 'pace_asc';

const PAGE_SIZE = 10;

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await api.get('/activities');
        setActivities(response.data);
      } catch (error) {
        console.error('Failed to fetch activities', error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const getHrColor = (hr: number | null) => {
    if (!hr) return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    if (hr < 130) return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800';
    if (hr < 150) return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800';
    if (hr < 170) return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800';
    return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800';
  };

  // Convert pace string MM:SS to seconds for reliable sorting
  const paceToSeconds = (pace: string | null) => {
    if (!pace || pace === '0:00') return 999999;
    const [m, s] = pace.split(':').map(Number);
    return (m * 60) + s;
  };

  const filteredAndSortedActivities = useMemo(() => {
    // Reset to page 1 whenever filters change
    setCurrentPage(1);

    // 1. Filter by search term
    let filtered = activities;
    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(act => 
        act.name.toLowerCase().includes(lowerSearch)
      );
    }

    // 2. Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        case 'date_asc':
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case 'distance_desc':
          return b.distance - a.distance;
        case 'pace_asc':
          return paceToSeconds(a.average_pace) - paceToSeconds(b.average_pace);
        default:
          return 0;
      }
    });
  }, [activities, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedActivities.length / PAGE_SIZE));
  const paginatedActivities = filteredAndSortedActivities.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto mt-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Activity History</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {activities.length > 0 ? `${filteredAndSortedActivities.length} of ${activities.length} runs` : 'All your imported runs from Strava.'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder="Search runs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl leading-5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ArrowDownUp className="h-4 w-4 text-zinc-400" />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="block w-full pl-10 pr-8 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm appearance-none cursor-pointer"
            >
              <option value="date_desc">Latest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="distance_desc">Longest Distance</option>
              <option value="pace_asc">Fastest Pace</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {activities.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 mb-6 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center relative">
               <div className="absolute inset-0 bg-orange-100 dark:bg-orange-500/20 rounded-full animate-ping opacity-20"></div>
               <ActivityIcon className="h-10 w-10 text-orange-500 dark:text-orange-400" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Runs Analyzed Yet</h3>
            <p className="max-w-sm mx-auto text-zinc-500 dark:text-zinc-400">
              Connect your Strava account and head to the dashboard to sync your recent activities. Your journey starts here.
            </p>
          </div>
        ) : filteredAndSortedActivities.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
               <SearchX className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">No matches found</h3>
            <p className="text-sm">We couldn't find any runs matching "{searchTerm}".</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedActivities.map((activity) => (
                <li key={activity.id} className="group border-b border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 last:border-0 transition-colors">
                  <Link to={`/activities/${activity.id}`} className="block p-4 sm:p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex flex-col md:flex-row gap-6">
                      
                      {/* Left: Map Thumbnail */}
                      <div className="w-full md:w-32 h-32 md:h-24 shrink-0 transition-transform group-hover:scale-[1.02] bg-zinc-50 dark:bg-zinc-800 rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-700">
                        <MapThumbnail polyline={activity.map_polyline} className="w-full h-full" />
                      </div>

                      {/* Right: Data */}
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors">{activity.name}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              {format(new Date(activity.start_date), 'EEEE, MMMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {(activity.distance / 1000).toFixed(2)} km
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatDuration(activity.moving_time)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <ActivityIcon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {activity.average_pace || '--'} <span className="text-zinc-500 dark:text-zinc-400 font-normal">/km</span>
                            </span>
                          </div>
                          
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getHrColor(activity.average_heartrate)}`}>
                            <HeartPulse className="h-3.5 w-3.5" />
                            <span>
                              {activity.average_heartrate ? Math.round(activity.average_heartrate) : '--'} bpm
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Showing <span className="font-medium text-zinc-900 dark:text-white">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAndSortedActivities.length)}</span> of <span className="font-medium text-zinc-900 dark:text-white">{filteredAndSortedActivities.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>

                  {/* Page number pills */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === 'ellipsis' ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-zinc-400 dark:text-zinc-600 select-none">…</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setCurrentPage(item as number)}
                            className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                              currentPage === item
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

