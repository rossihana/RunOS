import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Target,
  Clock,
  MapPin,
  Calculator
} from "lucide-react";
import { format } from "date-fns";
import api from "../services/api";
import toast from 'react-hot-toast';

interface Race {
  id: number;
  race_name: string;
  distance: number;
  race_date: string;
  target_time: string;
  target_pace: string;
}

export default function Races() {
  const [races, setRaces] = useState<Race[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [formData, setFormData] = useState({
    race_name: "",
    distance: "",
    race_date: "",
    target_time: "",
    target_pace: "",
  });

  useEffect(() => {
    fetchRaces();
  }, []);

  const fetchRaces = async () => {
    try {
      const response = await api.get("/races");
      setRaces(response.data);
    } catch (error) {
      console.error("Failed to fetch races", error);
    }
  };

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
      race_date: race.race_date,
      target_time: race.target_time || "",
      target_pace: race.target_pace || "",
    });
    setIsModalOpen(true);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {races.length === 0 ? (
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
        ) : (
          races.map((race) => (
            <div
              key={race.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col transition-colors group"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 transition-colors group-hover:text-orange-600 dark:group-hover:text-orange-500">
                    {race.race_name}
                  </h3>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => openEditModal(race)}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(race.id)}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <Calendar className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
                    {format(new Date(race.race_date), "MMMM d, yyyy")}
                  </div>
                  <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <MapPin className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
                    {race.distance} km
                  </div>
                  <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <Clock className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
                    Target Time:{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 ml-1">
                      {race.target_time || "--"}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <Target className="h-4 w-4 mr-3 text-zinc-400 dark:text-zinc-500" />
                    Target Pace:{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 ml-1">
                      {race.target_pace || "--"} /km
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {Math.ceil(
                  (new Date(race.race_date).getTime() - new Date().getTime()) /
                    (1000 * 3600 * 24),
                )}{" "}
                days remaining
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingRace ? "Edit Race Target" : "New Race Target"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
              >
                &times;
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
                    Target Time <span className="font-normal text-zinc-400 text-xs text-right ml-1">(auto-calc)</span>
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
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Target Pace <span className="font-normal text-zinc-400 text-xs text-right ml-1">(auto-calc)</span>
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
                  className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
