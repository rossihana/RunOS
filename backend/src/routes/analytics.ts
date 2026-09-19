import { Router, Response } from 'express';
import { query } from '../db.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subWeeks, subMonths, eachDayOfInterval, parseISO } from 'date-fns';
import { catchAsync } from '../utils/catchAsync.js';
const router = Router();

const getLocalNow = async (userId: number) => {
  const res = await query('SELECT timezone FROM users WHERE id = $1', [userId]);
  const timezone = res.rows[0]?.timezone;
  const now = new Date();
  if (!timezone) return now;
  try {
    // This creates a date object that represents the 'wall clock' time in the target timezone
    return new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  } catch (e) {
    return now;
  }
};

router.get('/summary', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as number;
  const now = await getLocalNow(userId);

  // Current periods
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  // Previous periods for trends
  const prevWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

  const [
    totalRunsRes, 
    weeklyRes, 
    monthlyRes, 
    averagesRes,
    prevWeeklyRes,
    prevMonthlyRes,
    prsRes
  ] = await Promise.all([
    query('SELECT COUNT(*) as count FROM activities WHERE user_id = $1', [userId]),
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2 AND COALESCE(start_date_local::date, start_date::date) <= $3`,
      [userId, weekStart, weekEnd]
    ),
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2 AND COALESCE(start_date_local::date, start_date::date) <= $3`,
      [userId, monthStart, monthEnd]
    ),
    query(
      `SELECT AVG(average_speed) as avg_speed, AVG(average_heartrate) as avg_hr
       FROM activities WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2`,
      [userId, thirtyDaysAgo]
    ),
    // Trend Queries
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2 AND COALESCE(start_date_local::date, start_date::date) <= $3`,
      [userId, prevWeekStart, prevWeekEnd]
    ),
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2 AND COALESCE(start_date_local::date, start_date::date) <= $3`,
      [userId, prevMonthStart, prevMonthEnd]
    ),
    // PR Queries (Max distance, max speed)
    query(
      `SELECT name, distance, elapsed_time, moving_time, COALESCE(start_date_local, start_date::date::text) as start_date
       FROM best_efforts 
       WHERE user_id = $1
       ORDER BY distance ASC`,
      [userId]
    )
  ]);

  const calculateMileage = (res: any) => (Number(res.rows[0].total_distance) || 0) / 1000;

  const weeklyMileage = calculateMileage(weeklyRes);
  const monthlyMileage = calculateMileage(monthlyRes);
  const prevWeeklyMileage = calculateMileage(prevWeeklyRes);
  const prevMonthlyMileage = calculateMileage(prevMonthlyRes);
  
  const avgSpeed = averagesRes.rows[0].avg_speed;
  const avgHr = averagesRes.rows[0].avg_hr;

  // Calculate trends (%)
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const weeklyTrend = calcTrend(weeklyMileage, prevWeeklyMileage);
  const monthlyTrend = calcTrend(monthlyMileage, prevMonthlyMileage);

  // Format Average Pace
  const formatPace = (speed: number | null) => {
    if (!speed) return '0:00';
    const paceSeconds = 1000 / speed;
    const mins = Math.floor(paceSeconds / 60);
    const secs = Math.floor(paceSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const avgPace = formatPace(avgSpeed);

  // Format PRs (Best Efforts)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formattedPrs = prsRes.rows.map(effort => ({
    name: effort.name,
    distance: (Number(effort.distance) / 1000).toFixed(2),
    timeFormatted: formatTime(effort.elapsed_time),
    date: format(new Date(effort.start_date), 'MMM d, yyyy')
  }));

  res.json({
    totalRuns: Number(totalRunsRes.rows[0].count),
    weeklyMileage: weeklyMileage.toFixed(2),
    monthlyMileage: monthlyMileage.toFixed(2),
    averagePace: avgPace,
    averageHeartRate: avgHr ? Math.round(avgHr) : 0,
    trends: {
      weeklyMileage: weeklyTrend,
      monthlyMileage: monthlyTrend
    },
    prs: formattedPrs
  });
}));

router.get('/charts', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  const result = await query(`
    SELECT COALESCE(start_date_local, start_date::date::text) as start_date, distance, average_speed, average_heartrate
    FROM activities
    WHERE user_id = $1
    ORDER BY start_date ASC
    LIMIT 10
  `, [userId]);

  const chartData = result.rows.map((act) => {
    let pace = 0;
    if (act.average_speed) {
      pace = 1000 / act.average_speed / 60;
    }
    return {
      date: format(parseISO(act.start_date), 'MMM dd'),
      distance: (Number(act.distance) / 1000).toFixed(2),
      pace: pace.toFixed(2),
      heartRate: act.average_heartrate ? Math.round(act.average_heartrate) : 0,
    };
  });

  res.json(chartData);
}));

router.get('/training-log', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as number;
  const now = await getLocalNow(userId);
  
  // We need the full month, padded to the first Monday and last Sunday to form a complete grid
  const startOfCurrentMonth = startOfMonth(now);
  const endOfCurrentMonth = endOfMonth(now);
  
  const gridStart = startOfWeek(startOfCurrentMonth, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfCurrentMonth, { weekStartsOn: 1 });

  // 1. Get daily aggregates for the *entire grid*
  const monthActivitiesRes = await query(
    `SELECT COALESCE(start_date_local, start_date::date::text) as start_date, distance, moving_time 
     FROM activities 
     WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2 AND COALESCE(start_date_local::date, start_date::date) <= $3
     ORDER BY start_date ASC`,
    [userId, format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd')]
  );

  // Group by day
  const dailyData = new Map();
  for (const act of monthActivitiesRes.rows) {
    const dateStr = act.start_date.includes('T') ? act.start_date.split('T')[0] : act.start_date.split(' ')[0];
    const existing = dailyData.get(dateStr) || { distance: 0, moving_time: 0, count: 0 };
    dailyData.set(dateStr, {
      distance: existing.distance + Number(act.distance),
      moving_time: existing.moving_time + Number(act.moving_time),
      count: existing.count + 1
    });
  }

  // 2. Calculate Week Streak
  // Get all activities sorted by date descending to calculate the global active streak
  const allRunsRes = await query(
    `SELECT COALESCE(start_date_local, start_date::date::text) as start_date FROM activities WHERE user_id = $1 ORDER BY start_date DESC`,
    [userId]
  );

  let currentStreakCount = 0;
  
  // Group all runs by "year-week" string (Monday start)
  const runWeeks = new Set<string>();
  for (const row of allRunsRes.rows) {
    const weekStart = startOfWeek(parseISO(row.start_date), { weekStartsOn: 1 });
    runWeeks.add(format(weekStart, 'yyyy-MM-dd'));
  }

  // Check backwards from the current week
  let currentCheckWeek = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekStr = format(currentCheckWeek, 'yyyy-MM-dd');
  
  let isStreakActive = false;

  if (runWeeks.has(currentWeekStr)) {
    isStreakActive = true;
    currentStreakCount = 1;
    currentCheckWeek = subWeeks(currentCheckWeek, 1);
  } else {
    // Check last week (streak is still alive if they haven't run *yet* this week, but did last week)
    currentCheckWeek = subWeeks(currentCheckWeek, 1);
    if (runWeeks.has(format(currentCheckWeek, 'yyyy-MM-dd'))) {
      isStreakActive = true;
      currentStreakCount = 1; 
      currentCheckWeek = subWeeks(currentCheckWeek, 1);
    }
  }

  // Build the set of weeks that are part of the *active* streak
  const activeStreakWeeks = new Set<string>();
  if (isStreakActive) {
    // Re-add the weeks we already counted
    if (currentStreakCount > 0) {
      if (runWeeks.has(currentWeekStr)) activeStreakWeeks.add(currentWeekStr);
      else activeStreakWeeks.add(format(subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1), 'yyyy-MM-dd'));
    }
    
    while (runWeeks.has(format(currentCheckWeek, 'yyyy-MM-dd'))) {
      activeStreakWeeks.add(format(currentCheckWeek, 'yyyy-MM-dd'));
      currentStreakCount++;
      currentCheckWeek = subWeeks(currentCheckWeek, 1);
    }
  }

  // Calculate total activities during this specific active streak
  let currentStreakActivitiesCount = 0;
  if (isStreakActive) {
      for (const act of allRunsRes.rows) {
          const actWeekStr = format(startOfWeek(parseISO(act.start_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
          if (activeStreakWeeks.has(actWeekStr)) {
              currentStreakActivitiesCount++;
          }
      }
  }

  // 3. Generate array of days organized into weeks (rows)
  const daysInGrid = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeksData = [];
  let currentWeekDays = [];
  let currentWeekId = '';

  for (let i = 0; i < daysInGrid.length; i++) {
      const day = daysInGrid[i];
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = dailyData.get(dateStr) || { distance: 0, moving_time: 0, count: 0 };
      
      if (i % 7 === 0) {
          currentWeekId = dateStr; // Monday's date string identifies the week
      }

      currentWeekDays.push({
          date: dateStr,
          distance: data.distance,
          moving_time: data.moving_time,
          count: data.count,
          isCurrentMonth: day >= startOfCurrentMonth && day <= endOfCurrentMonth,
          isToday: dateStr === format(now, 'yyyy-MM-dd')
      });

      // End of week (Sunday)
      if (i % 7 === 6) {
          // Check if this specific week in the grid is part of the active, unbroken streak
          const isPartOfActiveStreak = activeStreakWeeks.has(currentWeekId);
          
          // Check if this specific week had *any* run at all (regardless of streak)
          const hasRunThisWeek = runWeeks.has(currentWeekId);
          
          // This is the current calendar week the user is living in
          const isCurrentWeek = currentWeekId === currentWeekStr;

          weeksData.push({
              weekId: currentWeekId,
              days: currentWeekDays,
              isPartOfActiveStreak,
              hasRunThisWeek,
              isCurrentWeek
          });
          currentWeekDays = [];
      }
  }

  res.json({
    title: format(startOfCurrentMonth, 'MMMM yyyy'),
    totalStreak: currentStreakCount,
    totalStreakActivities: currentStreakActivitiesCount,
    weeks: weeksData
  });
}));

router.get('/recent-trend', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as number;
  const now = await getLocalNow(userId);
  
  // 1. This Week Metrics (Monday-Sunday)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  const thisWeekRes = await query(
    `SELECT SUM(distance) as distance, SUM(moving_time) as time, SUM(elevation_gain) as elevation
     FROM activities 
     WHERE user_id = $1 AND COALESCE(start_date_local::date, start_date::date) >= $2 AND COALESCE(start_date_local::date, start_date::date) <= $3`,
    [userId, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')]
  );

  const thisWeek = {
    distance: (Number(thisWeekRes.rows[0].distance) || 0) / 1000,
    time: Number(thisWeekRes.rows[0].time) || 0,
    elevation: Math.round(Number(thisWeekRes.rows[0].elevation) || 0)
  };

  // 2. Past 12 Weeks Trend — one GROUP BY query instead of 12 sequential queries
  const trendRes = await query(
    `SELECT date_trunc('week', COALESCE(start_date_local::date, start_date::date))::date AS wk,
            SUM(distance) AS distance
     FROM activities
     WHERE user_id = $1
       AND COALESCE(start_date_local::date, start_date::date) >= $2
       AND COALESCE(start_date_local::date, start_date::date) < $3
     GROUP BY 1`,
    [userId, format(startOfWeek(subWeeks(now, 11), { weekStartsOn: 1 }), 'yyyy-MM-dd'), format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')]
  );
  const byWeek = new Map(trendRes.rows.map(r => [Number(r.wk), Number(r.distance) || 0]));

  const trendData = [];
  let maxDistance = 0;

  for (let i = 11; i >= 0; i--) {
    const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const we = endOfWeek(now, { weekStartsOn: 1 });

    const distanceKm = (byWeek.get(Number(ws)) || 0) / 1000;
    if (distanceKm > maxDistance) maxDistance = distanceKm;

    trendData.push({
      weekStart: ws.toISOString(),
      weekEnd: we.toISOString(),
      weekLabel: format(ws, 'd'),
      monthLabel: format(ws, 'MMM').toUpperCase(),
      distance: distanceKm
    });
  }

  res.json({
    thisWeek,
    trendData,
    maxDistance: Math.ceil(maxDistance / 10) * 10 || 10
  });
}));

export default router;
