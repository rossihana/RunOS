import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Sparkles, 
  Flag, 
  ChevronRight, 
  Calendar, 
  Activity,
  ArrowRight,
  TrendingUp,
  Award,
  Loader2
} from 'lucide-react';
import api from '../services/api';
import TrainingPlanView from '../components/training/TrainingPlanView';
import MasterPlanView from '../components/training/MasterPlanView';
import { motion, AnimatePresence } from 'motion/react';

interface Race {
  id: number;
  race_name: string;
  distance: number;
  race_date: string;
  training_plan?: any;
}

export default function TrainingPlan() {
  const [activeTab, setActiveTab] = useState<'master' | 'individual'>('master');
  const [masterPlan, setMasterPlan] = useState<any>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndividualRace, setSelectedIndividualRace] = useState<Race | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [masterRes, racesRes] = await Promise.all([
        api.get('/ai/master-plan'),
        api.get('/races')
      ]);
      
      if (masterRes.data) setMasterPlan(masterRes.data);
      
      const racesWithPlans = racesRes.data.filter((r: Race) => r.training_plan);
      setRaces(racesWithPlans);
      
      // If no master plan, default to individual
      if (!masterRes.data) {
        setActiveTab('individual');
        if (racesWithPlans.length > 0) setSelectedIndividualRace(racesWithPlans[0]);
      } else {
        setActiveTab('master');
      }
    } catch (error) {
      console.error('Failed to fetch training plans', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-zinc-500 font-medium animate-pulse">Loading your training schedules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded-full mb-3 border border-indigo-100 dark:border-indigo-500/20">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Training Vault</span>
          </div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">Your Training Plans</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium max-w-xl">
            View your master schedule or dive into specific requirements for each race target.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('master')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'master' 
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === 'master' ? 'text-indigo-600' : ''}`} />
            Master Plan
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'individual' 
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Flag className={`w-4 h-4 ${activeTab === 'individual' ? 'text-rose-500' : ''}`} />
            Individual Races
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'master' ? (
          <motion.div
            key="master-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {masterPlan ? (
              <MasterPlanView plan={masterPlan.plan} />
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-12 border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-3">No Master Plan Yet</h3>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-sm mx-auto mb-8 leading-relaxed">
                  Generate a "Smart Merge" from the Races page to see your comprehensive multi-race strategy here.
                </p>
                <a 
                  href="/races" 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Go to Races <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="individual-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-8"
          >
            {/* Sidebar for Race Selection */}
            <div className="lg:col-span-1 space-y-4">
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-2 mb-4">Select Race</h4>
              {races.length > 0 ? (
                races.map((race) => (
                  <button
                    key={race.id}
                    onClick={() => setSelectedIndividualRace(race)}
                    className={`w-full text-left p-5 rounded-3xl border transition-all flex items-center justify-between group ${
                      selectedIndividualRace?.id === race.id
                        ? 'bg-zinc-900 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-700 shadow-xl'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                        selectedIndividualRace?.id === race.id ? 'text-rose-400' : 'text-zinc-500'
                      }`}>
                         {race.distance}km Goal
                      </p>
                      <h5 className={`font-black truncate ${
                        selectedIndividualRace?.id === race.id ? 'text-white' : 'text-zinc-900 dark:text-white'
                      }`}>
                        {race.race_name}
                      </h5>
                    </div>
                    <div className={`p-2 rounded-xl transition-colors ${
                      selectedIndividualRace?.id === race.id 
                        ? 'bg-white/10 text-white' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200'
                    }`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
                   <p className="text-xs text-zinc-400 font-bold uppercase leading-relaxed">No race plans<br/>generated yet</p>
                </div>
              )}
            </div>

            {/* Plan Display Area */}
            <div className="lg:col-span-3">
              {selectedIndividualRace ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 mb-8">
                     <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                           <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                              <Flag className="w-5 h-5 text-rose-600" />
                           </div>
                           <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Selected Goal</p>
                              <p className="text-lg font-black text-zinc-900 dark:text-white">{selectedIndividualRace.race_name}</p>
                           </div>
                        </div>
                        <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>
                        <div className="flex items-center gap-3">
                           <Calendar className="w-5 h-5 text-zinc-400" />
                           <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                              {new Date(selectedIndividualRace.race_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                           </span>
                        </div>
                     </div>
                  </div>
                  <TrainingPlanView plan={selectedIndividualRace.training_plan} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40">
                  <ClipboardList className="w-16 h-16 text-zinc-400" />
                  <p className="text-zinc-500 font-bold uppercase tracking-widest">Select a race to view details</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
