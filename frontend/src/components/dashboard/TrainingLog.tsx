import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Flame, Check} from 'lucide-react';

interface DailyLog {
  date: string;
  distance: number;
  moving_time: number;
  count: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface WeekData {
  weekId: string;
  days: DailyLog[];
  isPartOfActiveStreak: boolean;
  hasRunThisWeek: boolean;
  isCurrentWeek: boolean;
}

interface TrainingLogData {
  title: string;
  totalStreak: number;
  totalStreakActivities: number;
  weeks: WeekData[];
}

interface TrainingLogProps {
  data: TrainingLogData | null;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TrainingLog({ data }: TrainingLogProps) {
  const [hoveredDay, setHoveredDay] = useState<DailyLog | null>(null);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (!data || !data.weeks || data.weeks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 flex flex-col shadow-sm border border-zinc-200 dark:border-zinc-800/0 h-full text-zinc-900 dark:text-white font-sans overflow-hidden transition-colors">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-wide">{data.title}</h2>
      </div>

      {/* Streak Stats */}
      <div className="flex items-center gap-12 mb-8">
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Your Streak</div>
          <div className="text-2xl font-bold">{data.totalStreak} Weeks</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Streak Activities</div>
          <div className="text-2xl font-bold">{data.totalStreakActivities}</div>
        </div>
      </div>

      {/* Grid */}
      <div className="relative flex-1 flex flex-col">
        {/* Day Headers */}
        <div className="grid grid-cols-8 gap-2 mb-4">
          {WEEKDAYS.map((day, i) => (
            <div key={i} className="flex justify-center text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
              {day}
            </div>
          ))}
          {/* 8th column is empty in header */}
          <div></div> 
        </div>

        {/* Calendar Rows */}
        <div className="flex flex-col gap-4 relative">
          


          {data.weeks.map((week, weekIdx) => {
            const isPillStart = week.isPartOfActiveStreak && (weekIdx === 0 || !data.weeks[weekIdx - 1]?.isPartOfActiveStreak);
            let pillHeight = 0;
            if (isPillStart) {
                let totalPillRows = 1;
                for (let j = weekIdx + 1; j < data.weeks.length; j++) {
                    if (data.weeks[j].isPartOfActiveStreak) totalPillRows++;
                    else break;
                }
                const ROW_HEIGHT = 40;
                const ROW_GAP = 16;
                const PAD_TOP = 10;
                const PAD_BOTTOM = 10;
                pillHeight = (totalPillRows * ROW_HEIGHT) + ((totalPillRows - 1) * ROW_GAP) + PAD_TOP + PAD_BOTTOM;
            }

            return (
            <div key={week.weekId} className="grid grid-cols-8 gap-2 relative z-10">
              
              {/* 7 Days of the week */}
              {week.days.map((day) => {
                const hasRun = day.distance > 0;
                const dateNum = format(parseISO(day.date), 'd');
                const isFaded = !day.isCurrentMonth;
                
                return (
                  <div 
                    key={day.date} 
                    className="flex justify-center"
                    onMouseEnter={() => hasRun && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {hasRun ? (
                      <div className={`w-10 h-10 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center relative cursor-default transition-colors ${isFaded ? 'opacity-50' : ''}`}>
                         {/* Minimal Check Icon */}
                         <Check className="w-5 h-5 text-white dark:text-[#1C1C1E]" strokeWidth={4} />
                         {/* Top indicator dot */}
                         <div className="absolute -top-[3px] -right-[3px] w-[13px] h-[13px] bg-white dark:bg-[#1C1C1E] rounded-full flex items-center justify-center transition-colors">
                            <div className="w-[9px] h-[9px] bg-zinc-900 dark:bg-white rounded-full transition-colors"></div>
                         </div>
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors ${day.isToday ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800/50' : ''}`}>
                        <span className={`text-zinc-400 dark:text-[#A0A0A5] text-[15px] ${isFaded ? 'opacity-30' : ''}`}>{dateNum}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 8th Column: Streak Indicator */}
              <div className="flex justify-center items-center h-10 relative">
                  {/* Streak background pill now safely anchored to column center */}
                  {isPillStart && (
                      <div 
                        className="absolute w-[42px] bg-orange-100 dark:bg-[#61240D] rounded-full z-0 pointer-events-none left-1/2 -translate-x-1/2 transition-colors" 
                        style={{ top: `-10px`, height: `${pillHeight}px` }}
                      />
                  )}

                  <div className="relative z-10">
                      {week.isPartOfActiveStreak ? (
                          // Orange checkmark for all active weeks in streak
                          <div className="w-[22px] h-[22px] rounded-full bg-[#FC5200] flex items-center justify-center shadow-[0_4px_10px_rgba(252,82,0,0.3)] dark:shadow-[0_4px_10px_rgba(252,82,0,0.4)]">
                              <Check className="w-3.5 h-3.5 text-white dark:text-[#1C1C1E]" strokeWidth={4} />
                          </div>
                      ) : (
                          // Empty outlined circle for weeks without active streak
                          <div className="w-[18px] h-[18px] rounded-full border-2 border-zinc-300 dark:border-zinc-800 transition-colors"></div>
                      )}
                  </div>
              </div>
            </div>
          )})}
        </div>

        {/* Global Tooltip */}
        {hoveredDay && (
          <div className="fixed z-50 pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="bg-zinc-900 dark:bg-white text-zinc-100 dark:text-[#1C1C1E] rounded-xl px-4 py-3 shadow-2xl border border-zinc-800 dark:border-zinc-200 transition-colors">
              <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mb-1 border-b border-zinc-700 dark:border-zinc-200 pb-1">
                {format(parseISO(hoveredDay.date), 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold mb-0.5">Distance</div>
                  <div className="font-bold text-lg">{(hoveredDay.distance / 1000).toFixed(2)} <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">km</span></div>
                </div>
                <div className="w-px h-8 bg-zinc-700 dark:bg-zinc-200"></div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold mb-0.5">Time</div>
                  <div className="font-bold text-lg">{formatTime(hoveredDay.moving_time)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
