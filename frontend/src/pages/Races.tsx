import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Target,
  Clock,
  MapPin,
  Calculator,
  Sparkles,
  X,
  FileText,
  Split,
  Award,
  CheckCircle,  ChevronRight,
  Search,
  RefreshCw,
  History,
  Activity
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import api from "../services/api";
import toast from 'react-hot-toast';
import TrainingPlanView from "../components/training/TrainingPlanView";
import MasterPlanView from "../components/training/MasterPlanView";

interface Race {
  id: number;
  race_name: string;
  distance: number;
  race_date: string;
  target_time: string;
  target_pace: string;
  training_plan?: any;
  linked_activity_id?: number | null;
  activity_name?: string;
  activity_distance?: number;
  activity_moving_time?: number;
  activity_average_pace?: string;
  activity_start_date?: string;
  activity_garmin_id?: string;
}

export default function Races() {
  const [races, setRaces] = useState<Race[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedRaceForLink, setSelectedRaceForLink] = useState<Race | null>(null);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [formData, setFormData] = useState({
    race_name: "",
    distance: "",
    race_date: "",
    target_time: "",
    target_pace: "",
  });
  
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  const [masterPlan, setMasterPlan] = useState<any>(null);
  const [isMasterPlanModalOpen, setIsMasterPlanModalOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  const [generatingId, setGeneratingId] = useState<number | null>(null);

  useEffect(() => {
    fetchRaces();
    fetchMasterPlan();
  }, []);

  const fetchRaces = async () => {
    try {
      const response = await api.get("/races");
      setRaces(response.data);
    } catch (error) {
      console.error("Failed to fetch races", error);
    }
  };

  const fetchMasterPlan = async () => {
    try {
      const response = await api.get("/ai/master-plan");
      if (response.data) {
        setMasterPlan(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch master plan", error);
    }
  };

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      // Ambil SEMUA aktivitas (bukan 20 terakhir) — bug: race lama (mis. Mei) tak pernah muncul di picker
      const response = await api.get("/activities");
      setActivities(response.data);
    } catch (error) {
      console.error("Failed to fetch activities", error);
      toast.error("Failed to load activities");
    } finally {
      setLoadingActivities(false);
    }
  };

  const upcomingRaces = races.filter(race => new Date(race.race_date).getTime() >= new Date().setHours(0,0,0,0));
  const pastRaces = races.filter(race => new Date(race.race_date).getTime() < new Date().setHours(0,0,0,0));

  const timeToSeconds = (timeStr: string) => {
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const secondsToTime = (totalSeconds: number) => {
    if (!totalSeconds || isNaN(totalSeconds)) return "";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCalculate = (changedField: 'time' | 'pace') => {
    const dist = parseFloat(formData.distance);
    if (!dist || isNaN(dist)) {
      if (formData.distance === '') toast.error('Please enter distance first to calculate');
      return;
    }

    if (changedField === 'time' && formData.target_time) {
      const timeSecs = timeToSeconds(formData.target_time);
      if (timeSecs > 0) {
        const paceSecs = timeSecs / dist;
        setFormData(prev => ({ ...prev, target_pace: secondsToTime(paceSecs) }));
        toast.success('Pace auto-calculated!');
      }
    } else if (changedField === 'pace' && formData.target_pace) {
      const paceSecs = timeToSeconds(formData.target_pace);
      if (paceSecs > 0) {
        const timeSecs = paceSecs * dist;
        setFormData(prev => ({ ...prev, target_time: secondsToTime(timeSecs) }));
        toast.success('Time auto-calculated!');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = toast.loading('Saving race target...');
    try {
      const payload = {
        ...formData,
        distance: parseFloat(formData.distance),
      };

      if (editingRace) {
        await api.put(`/races/${editingRace.id}`, payload);
        toast.success('Race updated successfully', { id });
      } else {
        await api.post("/races", payload);
        toast.success('Race added successfully', { id });
      }

      setIsModalOpen(false);
      setEditingRace(null);
      setFormData({
        race_name: "",
        distance: "",
        race_date: "",
        target_time: "",
        target_pace: "",
      });
      fetchRaces();
    } catch (error) {
      console.error("Failed to save race", error);
      toast.error('Failed to save race target.', { id });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this race target?")) return;
    try {
      await api.delete(`/races/${id}`);
      toast.success('Race target deleted');
      fetchRaces();
    } catch (error) {
      console.error("Failed to delete race", error);
      toast.error('Failed to delete race target');
    }
  };

  const openEditModal = (race: Race) => {
    setEditingRace(race);
    setFormData({
      race_name: race.race_name,
      distance: race.distance.toString(),
      race_date: race.race_date ? new Date(race.race_date).toISOString().split('T')[0] : "",
      target_time: race.target_time || "",
      target_pace: race.target_pace || "",
    });
    setIsModalOpen(true);
  };

  const handleGeneratePlan = async (raceId: number) => {
    setGeneratingId(raceId);
    const toastId = toast.loading('AI is crafting your personal training plan...');
    try {
      const response = await api.post(`/ai/training-plan/${raceId}`);
      toast.success('Training Plan Generated!', { id: toastId });
      fetchRaces(); 
      setSelectedPlan(response.data);
      setIsPlanModalOpen(true);
    } catch (err) {
      console.error('Failed to generate training plan:', err);
      toast.error('Failed to generate plan. Try again.', { id: toastId });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleMergePlans = async () => {
    const racesWithPlans = races.filter(r => r.training_plan);
    if (racesWithPlans.length < 2) {
      toast.error('You need at least 2 races with generated plans to merge.');
      return;
    }

    setMerging(true);
    const toastId = toast.loading('Master Coach is weaving your races into one master plan...');
    try {
      const raceIds = racesWithPlans.map(r => r.id);
      const response = await api.post('/ai/merge-plans', { raceIds });
      setMasterPlan(response.data);
      setIsMasterPlanModalOpen(true);
      toast.success('Master Plan Generated!', { id: toastId });
    } catch (error) {
      console.error('Failed to merge plans:', error);
      toast.error('Failed to merge plans. Please try again.', { id: toastId });
    } finally {
      setMerging(false);
    }
  };

  const openPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsPlanModalOpen(true);
  };

  const handleLinkActivity = async (activityId: number) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    if (selectedRaceForLink) {
      // Logic for linking existing race
      const toastId = toast.loading('Linking race to activity...');
      try {
        await api.post(`/races/${selectedRaceForLink.id}/link-activity`, { activity_id: activityId });
        toast.success('Race linked successfully!', { id: toastId });
        setIsPickerOpen(false);
        fetchRaces();
      } catch (error) {
        console.error('Failed to link activity:', error);
        toast.error('Failed to link activity', { id: toastId });
      }
    } else {
      // Logic for creating NEW race from activity
      const toastId = toast.loading('Creating race from activity...');
      try {
        const payload = {
          race_name: activity.name,
          distance: parseFloat((activity.distance / 1000).toFixed(2)),
          race_date: activity.start_date.split('T')[0],
          target_time: activity.average_pace ? secondsToTime(Math.floor((activity.distance / 1000) * timeToSeconds('00:' + activity.average_pace))) : "", // Placeholder or use moving_time
        };
        
        // Let's use moving_time for target_time as a default for past races
        payload.target_time = secondsToTime(activity.moving_time);
        
        const response = await api.post("/races", payload);
        const newRaceId = response.data.id;
        
        // Now link it
        await api.post(`/races/${newRaceId}/link-activity`, { activity_id: activityId });
        
        toast.success('Past race added to gallery!', { id: toastId });
        setIsPickerOpen(false);
        fetchRaces();
      } catch (error) {
        console.error('Failed to create race from activity:', error);
        toast.error('Failed to create race from activity', { id: toastId });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Race Targets
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your upcoming races and goals.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {masterPlan && (
            <button
              onClick={() => setIsMasterPlanModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all active:scale-95 shadow-sm"
            >
              <FileText className="mr-2 h-4 w-4 text-indigo-500" />
              View Master Plan
            </button>
          )}
          {races.filter(r => r.training_plan).length >= 2 && (
            <button
              onClick={handleMergePlans}
              disabled={merging}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:shadow-lg hover:shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {merging ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              ) : masterPlan ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : (
                <Split className="mr-2 h-4 w-4" />
              )}
              {masterPlan ? 'Regen Master Plan' : 'Merge AI Plans'}
            </button>
          )}
          <button
            onClick={() => {
              setSelectedRaceForLink(null);
              setIsPickerOpen(true);
              fetchActivities();
            }}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95 shadow-sm"
          >
            <History className="mr-2 h-4 w-4" />
            Add from Activity
          </button>
          <button
            onClick={() => {
              setEditingRace(null);
              setFormData({
                race_name: "",
                distance: "",
                race_date: "",
                target_time: "",
                target_pace: "",
              });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-800 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Race Target
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Upcoming Races Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Upcoming Races</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingRaces.length === 0 ? (
              <div className="col-span-full bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center py-12 text-center shadow-sm">
                <Target className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No upcoming races</h3>
                <p className="text-xs text-zinc-500 max-w-xs mt-1">Add a race target to start your AI training journey.</p>
              </div>
            ) : (
              upcomingRaces.map((race) => (
                <RaceCard key={race.id} race={race} isPast={false} />
              ))
            )}
          </div>
        </section>

        {/* Race Gallery (Past Races) Section */}
        {pastRaces.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Race Gallery</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastRaces.map((race) => (
                <RaceCard key={race.id} race={race} isPast={true} />
              ))}
            </div>
          </section>
        )}
      </div>

      {races.length === 0 && (
        <div className="col-span-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center min-h-[400px] text-center p-12 shadow-sm">
          <div className="w-24 h-24 mb-6 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-red-100 dark:bg-red-500/20 rounded-full animate-ping opacity-20"></div>
              <Target className="h-10 w-10 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Race Targets Set</h3>
          <p className="max-w-sm mx-auto text-zinc-500 dark:text-zinc-400">
            Set your next race, distance, and target time. We'll help you track your progress against your goal.
          </p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden transition-colors">
            <div className={`px-6 py-4 border-b ${editingRace && new Date(editingRace.race_date).getTime() < new Date().setHours(0,0,0,0) ? 'border-yellow-100 dark:border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-500/5' : 'border-zinc-200 dark:border-zinc-800'} flex justify-between items-center`}>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                {editingRace ? (
                  new Date(editingRace.race_date).getTime() < new Date().setHours(0,0,0,0) ? (
                    <><Award className="w-5 h-5 text-yellow-500" /> Edit Gallery Entry</>
                  ) : (
                    <><Target className="w-5 h-5 text-zinc-900 dark:text-white" /> Edit Race Target</>
                  )
                ) : (
                  <><Plus className="w-5 h-5" /> New Race Target</>
                )}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Race Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.race_name}
                  onChange={(e) =>
                    setFormData({ ...formData, race_name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-colors"
                  placeholder="e.g. Berlin Marathon"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Distance (km)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { v: '5', l: '5K' }, { v: '10', l: '10K' }, { v: '15', l: '15K' },
                      { v: '21.0975', l: 'HM' }, { v: '30', l: '30K' }, { v: '42.195', l: 'FM' },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setFormData({ ...formData, distance: opt.v })}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                          formData.distance === opt.v
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.distance}
                    onChange={(e) =>
                      setFormData({ ...formData, distance: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-colors"
                    placeholder="42.2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.race_date}
                    onChange={(e) =>
                      setFormData({ ...formData, race_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {editingRace && new Date(editingRace.race_date).getTime() < new Date().setHours(0,0,0,0) ? "Goal Time" : "Target Time"} <span className="font-normal text-zinc-400 text-xs text-right ml-1">(auto-calc)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.target_time}
                    onBlur={() => handleCalculate('time')}
                    onChange={(e) =>
                      setFormData({ ...formData, target_time: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-colors"
                    placeholder="hh:mm:ss"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {((): { l: string; t: string }[] => {
                      const d = parseFloat(formData.distance);
                      // ponytail: preset statis per jarak umum — custom distance tidak punya chip (tetap bisa ketik manual)
                      if (d === 5) return [{ l: 'Sub 20', t: '0:20:00' }, { l: 'Sub 25', t: '0:25:00' }, { l: 'Sub 30', t: '0:30:00' }, { l: 'Sub 35', t: '0:35:00' }];
                      if (d === 10) return [{ l: 'Sub 40', t: '0:40:00' }, { l: 'Sub 45', t: '0:45:00' }, { l: 'Sub 50', t: '0:50:00' }, { l: 'Sub 55', t: '0:55:00' }, { l: 'Sub 60', t: '1:00:00' }];
                      if (d === 15) return [{ l: 'Sub 1:15', t: '1:15:00' }, { l: 'Sub 1:20', t: '1:20:00' }, { l: 'Sub 1:30', t: '1:30:00' }];
                      if (d === 21.0975) return [{ l: 'Sub 1:30', t: '1:30:00' }, { l: 'Sub 1:45', t: '1:45:00' }, { l: 'Sub 2:00', t: '2:00:00' }, { l: 'Sub 2:15', t: '2:15:00' }];
                      if (d === 30) return [{ l: 'Sub 2:30', t: '2:30:00' }, { l: 'Sub 3:00', t: '3:00:00' }, { l: 'Sub 3:30', t: '3:30:00' }];
                      if (d === 42.195) return [{ l: 'Sub 3:30', t: '3:30:00' }, { l: 'Sub 4:00', t: '4:00:00' }, { l: 'Sub 4:30', t: '4:30:00' }, { l: 'Sub 5:00', t: '5:00:00' }];
                      return [];
                    })().map(opt => (
                      <button
                        key={opt.t}
                        type="button"
                        onClick={() => setFormData({ ...formData, target_time: opt.t })}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                          formData.target_time === opt.t
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {editingRace && new Date(editingRace.race_date).getTime() < new Date().setHours(0,0,0,0) ? "Goal Pace" : "Target Pace"} <span className="font-normal text-zinc-400 text-xs text-right ml-1">(auto-calc)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.target_pace}
                    onBlur={() => handleCalculate('pace')}
                    onChange={(e) =>
                      setFormData({ ...formData, target_pace: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-colors"
                    placeholder="mm:ss"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-all shadow-sm active:scale-95 ${
                    editingRace && new Date(editingRace.race_date).getTime() < new Date().setHours(0,0,0,0)
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                  }`}
                >
                  {editingRace ? "Update Entry" : "Save Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Training Plan Modal */}
      {isPlanModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col relative">
            <button 
              onClick={() => setIsPlanModalOpen(false)}
              className="absolute top-6 right-6 z-[70] p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
              <TrainingPlanView plan={selectedPlan} />
            </div>
            <div className="px-10 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
               <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">RunOS AI Coaching Engine v2.5</p>
               <button 
                 onClick={() => setIsPlanModalOpen(false)}
                 className="text-sm font-bold text-zinc-900 dark:text-white hover:underline"
               >
                 Close Plan
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Master Training Plan Modal */}
      {isMasterPlanModalOpen && masterPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col relative">
            <button 
              onClick={() => setIsMasterPlanModalOpen(false)}
              className="absolute top-6 right-6 z-[70] p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
              <MasterPlanView plan={masterPlan.plan} />
            </div>
            <div className="px-10 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
               <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">RunOS AI Master Coach v1.0</p>
               <button 
                 onClick={() => setIsMasterPlanModalOpen(false)}
                 className="text-sm font-bold text-zinc-900 dark:text-white hover:underline"
               >
                 Close Master Plan
               </button>
            </div>
          </div>
        </div>
      )}
      {isPickerOpen && <ActivityPickerModal />}
    </div>
  );

  // --- Sub-components ---

  function RaceCard({ race, isPast }: { race: Race, isPast: boolean }) {
    const isLinked = !!race.linked_activity_id;
    
    // Result calculation
    const getResultStyles = () => {
      if (!isLinked || !race.target_time || !race.activity_moving_time) return null;
      const targetSecs = timeToSeconds(race.target_time);
      const actualSecs = race.activity_moving_time;
      const diff = actualSecs - targetSecs;
      const isFaster = diff <= 0;
      
      return {
        isFaster,
        diffStr: secondsToTime(Math.abs(diff)),
        actualTime: secondsToTime(actualSecs),
        actualPace: race.activity_average_pace
      };
    };

    const result = getResultStyles();

    return (
      <div className={`bg-white dark:bg-zinc-900 rounded-2xl border ${isPast ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800'} shadow-sm overflow-hidden flex flex-col transition-all group hover:shadow-md`}>
        <div className="p-6 flex-1">
          <div className="flex justify-between items-start mb-4">
            <h3 className={`text-lg font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 transition-colors ${!isPast && 'group-hover:text-orange-600 dark:group-hover:text-orange-500'}`}>
              {race.race_name}
            </h3>
            <div className="flex space-x-2 ml-4">
              <button onClick={() => openEditModal(race)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(race.id)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-500 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
              {format(new Date(race.race_date), "MMMM d, yyyy")}
            </div>
            {!isPast && (
              <>
                <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                  <MapPin className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
                  {race.distance} km
                </div>
                <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                  <Clock className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
                  Target: <span className="font-semibold text-zinc-900 dark:text-zinc-100 ml-1">{race.target_time || "--"}</span>
                </div>
              </>
            )}

            {isPast && isLinked && result && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Race Result</span>
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-zinc-900 dark:text-white">{result.actualTime}</span>
                  <span className={`text-xs font-bold ${result.isFaster ? 'text-emerald-500' : 'text-red-500'}`}>
                    {result.isFaster ? '-' : '+'}{result.diffStr} {result.isFaster ? 'Ahead' : 'Behind'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-medium mt-1">
                   Avg Pace: {result.actualPace} /km • Total: {race.activity_distance ? (race.activity_distance / 1000).toFixed(2) : '--'} km
                </div>
              </div>
            )}

            {isPast && !isLinked && (
              <div className="mt-4 p-4 rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-dashed border-orange-200 dark:border-orange-500/20 text-center">
                 <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-2">Did you finish this race?</p>
                 <button 
                   onClick={() => { setSelectedRaceForLink(race); setIsPickerOpen(true); fetchActivities(); }}
                   className="text-xs font-bold text-white bg-orange-600 px-4 py-1.5 rounded-lg hover:bg-orange-700 transition-colors"
                 >
                   Link Activity
                 </button>
              </div>
            )}
          </div>
        </div>
        
        {!isPast && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between items-center">
            <span>
              {Math.max(0, Math.ceil(
                (new Date(race.race_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
              ))} days remaining
            </span>
            {race.training_plan && <Sparkles className="w-3 h-3 text-orange-500" />}
          </div>
        )}

        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/20 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
          {race.training_plan ? (
            <>
              <button
                onClick={() => openPlan(race.training_plan)}
                className="flex-[4] bg-zinc-900 dark:bg-white text-white dark:text-black py-2 rounded-xl text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" /> View AI Plan
              </button>
              <button
                onClick={() => handleGeneratePlan(race.id)}
                disabled={generatingId === race.id}
                title="Regenerate Plan"
                className="flex-[1] bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 py-2 rounded-xl text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingId === race.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin"></div>
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          ) : !isPast && (
            <button
              onClick={() => handleGeneratePlan(race.id)}
              disabled={generatingId === race.id}
              className="flex-1 bg-gradient-to-r from-orange-600 to-rose-600 text-white py-2 rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-orange-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingId === race.id ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Sparkles className="w-3.5 h-3.5 fill-white" />
              )}
              Generate AI Plan
            </button>
          )}
          {isPast && race.linked_activity_id && (
            <Link 
              to={`/activities/${race.linked_activity_id}`}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <Activity className="w-3.5 h-3.5" /> View Details
            </Link>
          )}
        </div>
      </div>
    );
  }

  function ActivityPickerModal() {
    // Tanggal LOKAL (bukan UTC) — bug: run subuh tersimpan UTC H-1, tampil salah hari
    const actDate = (a: any) => new Date(a.start_date_local || a.start_date);
    // Filter: nama ATAU tanggal (mis. "mei" / "3 mei") DAN filter tanggal eksplisit (kalau dipilih)
    const filteredActivities = activities.filter(activity => {
      const q = searchQuery.toLowerCase();
      const nameMatch = !q || activity.name.toLowerCase().includes(q);
      const dateMatch = !q || format(actDate(activity), 'MMM d, yyyy').toLowerCase().includes(q);
      const dayMatch = !dateFilter || format(actDate(activity), 'yyyy-MM-dd') === dateFilter;
      return nameMatch && dayMatch;
    }).sort((a, b) => {
      // Kalau linking race: urutkan yang TERDEKAT dengan tanggal race dulu (deteksi otomatis)
      if (selectedRaceForLink) {
        const rd = new Date(selectedRaceForLink.race_date).getTime();
        const da = Math.abs(actDate(a).getTime() - rd);
        const db = Math.abs(actDate(b).getTime() - rd);
        return da - db;
      }
      return actDate(b).getTime() - actDate(a).getTime(); // default: terbaru
    });

    // Estimasi kandidat terbaik: sehari dengan race & jarak paling mendekati
    const raceDateStr = selectedRaceForLink ? new Date(selectedRaceForLink.race_date).toDateString() : null;
    const isSameDay = (a: any) => raceDateStr && actDate(a).toDateString() === raceDateStr;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden transition-colors flex flex-col max-h-[80vh]">
          <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
             <div className="flex-1">
               <h2 className="text-xl font-black text-zinc-900 dark:text-white">Select Activity</h2>
               <p className="text-xs text-zinc-500 font-medium">{selectedRaceForLink ? `Which run is your ${selectedRaceForLink.race_name}?` : "Select a run to add to your gallery"}</p>
             </div>
             <button onClick={() => { setIsPickerOpen(false); setSearchQuery(""); setDateFilter(""); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
               <X className="w-5 h-5 text-zinc-400" />
             </button>
          </div>
          
          <div className="px-8 py-4 border-b border-zinc-50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-800/10 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder={selectedRaceForLink ? "Cari nama / tanggal (mis. 'mei')..." : "Search activities by name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm dark:[color-scheme:dark]"
                title="Filter by date"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="px-3 py-2 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors shrink-0"
                >
                  ✕ Clear
                </button>
              )}
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
                {dateFilter ? `${filteredActivities.length} run` : `${activities.length} run`}
              </span>
            </div>
            {dateFilter && (
              <div className="mt-1.5 text-[10px] text-orange-600 dark:text-orange-400">
                Filter aktif: {new Date(dateFilter + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} — hasil diperbarui otomatis
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {loadingActivities ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                 <div className="w-8 h-8 border-4 border-zinc-200 border-t-orange-600 rounded-full animate-spin"></div>
                 <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading Activities...</span>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-12">
                 <p className="text-sm text-zinc-500">
                   {searchQuery ? `No activities found matching "${searchQuery}"` : "No activities found. Jalankan sync Garmin dulu."}
                 </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredActivities.map((activity) => (
                  <button
                    key={activity.id}
                    onClick={() => { handleLinkActivity(activity.id); setSearchQuery(""); }}
                    className="w-full text-left p-4 rounded-2xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all flex justify-between items-center group"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-zinc-900 dark:text-white truncate flex items-center gap-2">
                        {activity.name}
                        {isSameDay(activity) && (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full px-2 py-0.5">
                            Race day
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {format(actDate(activity), 'MMM d, yyyy')} • {(activity.distance/1000).toFixed(2)} km
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
             <button 
               onClick={() => setIsPickerOpen(false)}
               className="w-full py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
             >
               Dismiss
             </button>
          </div>
        </div>
      </div>
    );
  }
}
