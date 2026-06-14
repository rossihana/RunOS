import React from 'react';
import { Timer, Trophy, Medal, Goal } from 'lucide-react';

interface RacePrediction {
  name: string;
  distance: number; // in meters
  time: number; // in seconds
}

interface Props {
  predictions: RacePrediction[];
}

export default function RacePredictorCards({ predictions }: Props) {
  if (!predictions || predictions.length === 0) return null;

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getIcon = (name: string) => {
    switch (name) {
      case '5K': return <Timer className="w-5 h-5 text-blue-500" />;
      case '10K': return <Goal className="w-5 h-5 text-emerald-500" />;
      case 'Half Marathon': return <Medal className="w-5 h-5 text-amber-500" />;
      case 'Marathon': return <Trophy className="w-5 h-5 text-rose-500" />;
      default: return <Timer className="w-5 h-5 text-zinc-500" />;
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Race Predictor</h3>
          <p className="text-[10px] text-zinc-500">Estimasi berbasis VO2Max & VDOT</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {predictions.map((p) => (
          <div key={p.name} className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50 flex flex-col items-center text-center">
            <div className="mb-2 bg-zinc-800 p-2 rounded-xl">
              {getIcon(p.name)}
            </div>
            <div className="text-zinc-400 text-xs font-bold mb-1">{p.name}</div>
            <div className="text-xl font-black text-white tracking-tight">
              {formatTime(p.time)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
