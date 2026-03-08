import { Router } from 'express';
import { query } from '../db.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subWeeks, subMonths } from 'date-fns';

const router = Router();

router.get('/summary', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const now = new Date();

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
       WHERE user_id = $1 AND start_date >= $2 AND start_date <= $3`,
      [userId, weekStart, weekEnd]
    ),
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND start_date >= $2 AND start_date <= $3`,
      [userId, monthStart, monthEnd]
    ),
    query(
      `SELECT AVG(average_speed) as avg_speed, AVG(average_heartrate) as avg_hr
       FROM activities WHERE user_id = $1 AND start_date >= $2`,
      [userId, thirtyDaysAgo]
    ),
    // Trend Queries
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND start_date >= $2 AND start_date <= $3`,
      [userId, prevWeekStart, prevWeekEnd]
    ),
    query(
      `SELECT SUM(distance) as total_distance FROM activities
       WHERE user_id = $1 AND start_date >= $2 AND start_date <= $3`,
      [userId, prevMonthStart, prevMonthEnd]
    ),
    // PR Queries (Max distance, max speed)
    query(
      `SELECT name, distance, elapsed_time, moving_time, start_date 
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
});

router.get('/charts', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  const result = await query(`
    SELECT start_date, distance, average_speed, average_heartrate
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
      date: format(new Date(act.start_date), 'MMM dd'),
      distance: (Number(act.distance) / 1000).toFixed(2),
      pace: pace.toFixed(2),
      heartRate: act.average_heartrate ? Math.round(act.average_heartrate) : 0,
    };
  });

  res.json(chartData);
});

export default router;
