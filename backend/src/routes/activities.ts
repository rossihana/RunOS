import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

router.get('/', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  // ponytail: list endpoint strips map_polyline (heavy); detail page fetches it via /:id
  const limit = Math.min(Number(req.query.limit) || 200, 200);
  const result = await query(
    `SELECT 
      id, garmin_activity_id, name, distance, moving_time, elapsed_time,
      average_speed, average_pace, max_speed, average_heartrate, max_heartrate,
      elevation_gain, start_date, start_date_local, details_fetched
     FROM activities 
     WHERE user_id = $1 
     ORDER BY start_date DESC
     LIMIT $2`,
    [req.user?.id, limit]
  );
  res.json(result.rows);
}));

// ─── Performance Lab (MUST be before /:id to avoid Express wildcard capture) ─

import { computeZones, computeZoneDistribution, estimateVO2Max, calculateReadiness, predictRaceTimes, calculateBiomechanicalTrend, calculateAerobicDecoupling } from '../services/analytics.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';

const labConfigSchema = z.object({
  body: z.object({
    method: z.string().optional(),
    maxHr: z.number().int().positive().optional().nullable(),
    restingHr: z.number().int().positive().optional().nullable(),
    lthr: z.number().int().positive().optional().nullable(),
    age: z.number().int().positive().optional().nullable(),
    preview: z.boolean().optional()
  })
});

router.post('/lab/config', authenticate, validateRequest(labConfigSchema), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { method, maxHr, restingHr, lthr, age } = req.body;
    try { await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS lab_config JSONB'); } catch (_) { /* ignore */ }
    const effectiveMaxHr = maxHr || (age ? 220 - age : 190);
    const effectiveRestingHr = restingHr || 60;
    const effectiveLthr = lthr || Math.round(effectiveMaxHr * 0.88);
    const config = {
      method: method || 'hrmax',
      maxHr: effectiveMaxHr,
      restingHr: effectiveRestingHr,
      lthr: effectiveLthr,
      age: age || null,
      updatedAt: new Date().toISOString()
    };
    await query('UPDATE users SET lab_config = $1 WHERE id = $2', [config, userId]);
    const zones = computeZones(config);
    res.json({ config, zones });
  } catch (error) {
    console.error('Error saving lab config: ', error);
    res.status(500).json({ error: 'Failed to save lab config' });
  }
});

router.get('/lab', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    try { await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS lab_config JSONB'); } catch (_) { /* ignore */ }

    const userResult = await query('SELECT lab_config FROM users WHERE id = $1', [userId]);
    const labConfig = userResult.rows[0]?.lab_config || null;

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const activitiesResult = await query(
      `SELECT start_date, moving_time, average_heartrate, distance, cadence, average_speed, streams, splits
       FROM activities WHERE user_id = $1 AND start_date >= $2 ORDER BY start_date DESC`,
      [userId, since30.toISOString()]
    );
    const activities = activitiesResult.rows;

    let zoneDistribution = [] as any[];
    let zones = [] as any[];
    if (labConfig) {
      zones = computeZones(labConfig);
      zoneDistribution = computeZoneDistribution(activities, zones);
    }

    const vo2max = estimateVO2Max(activities, labConfig?.maxHr);

    const cadenceActivities = activities.filter(a => a.cadence && a.cadence > 0);
    const avgCadence = cadenceActivities.length > 0
      ? Math.round(cadenceActivities.reduce((sum, a) => sum + a.cadence, 0) / cadenceActivities.length)
      : null;

    const allActivities = await query(
      `SELECT COALESCE(start_date_local, start_date::date::text) as start_date, moving_time, average_heartrate, distance, cadence, average_speed FROM activities WHERE user_id = $1 ORDER BY start_date ASC`,
      [userId]
    );

    const readiness = calculateReadiness(allActivities.rows);
    const readinessSeries = readiness.series;

    // 1. Race Predictor (Based on VO2Max -> vVO2Max -> fatigue curve)
    const racePredictions = predictRaceTimes(vo2max);

    // 2. Biomechanical Trend (Last 12 weeks of cadence and stride)
    const biomechanicalTrend = calculateBiomechanicalTrend(allActivities.rows);

    // 3. Aerobic Decoupling (HR Drift)
    // Find recent long steady runs (> 45 min, Zone 2/3)
    const driftRes = await query(`
      SELECT start_date, moving_time, splits 
      FROM activities 
      WHERE user_id = $1 AND moving_time > 2700 AND splits IS NOT NULL
      ORDER BY start_date DESC LIMIT 3
    `, [userId]);

    let hrDrift = null;
    if (driftRes.rows.length > 0) {
      hrDrift = calculateAerobicDecoupling(driftRes.rows[0].splits);
    }

    res.json({
      labConfig, zones, zoneDistribution,
      fitnessMetrics: { vo2max, fitness: readiness.fitness, fatigue: readiness.fatigue, form: readiness.form },
      performanceMetrics: { avgCadence, totalActivities30d: activities.length, totalKm30d: Math.round(activities.reduce((sum, a) => sum + (a.distance / 1000), 0)) },
      racePredictions,
      readinessSeries,
      biomechanicalTrend,
      hrDrift
    });
  } catch (error) {
    console.error('Error fetching lab data:', error);
    res.status(500).json({ error: 'Failed to fetch lab data' });
  }
});

const activityIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID harus numerik').min(1)
  })
});

router.get('/:id', authenticate, validateRequest(activityIdSchema), catchAsync(async (req: AuthRequest, res: Response) => {
  const activityId = req.params.id;
  const userId = req.user?.id;

  // 1. Fetch Activity Details
  const actResult = await query(
    'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
    [activityId, userId]
  );

  if (actResult.rows.length === 0) {
    return res.status(404).json({ error: 'Activity not found' });
  }

  const activity = actResult.rows[0];

  // 2. Fetch PRs achieved during this specific activity
  const prsResult = await query(
    'SELECT name, distance, elapsed_time FROM best_efforts WHERE user_id = $1 AND garmin_activity_id = $2',
    [userId, activity.garmin_activity_id]
  );

  res.json({
    ...activity,
    achieved_prs: prsResult.rows
  });
}));

// ─── S7: Garmin per user ───
// Endpoint lama /sync (SYNC_SECRET) tetap dipertahankan untuk cron owner.
// Endpoint baru berbasis JWT: /garmin/connect, /garmin/sync, /garmin/status.

router.post('/garmin/connect', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const m = await import('../services/garminPerUser.js');
  return m.connectHandler(req, res);
}));

router.post('/garmin/sync', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const m = await import('../services/garminPerUser.js');
  const userId = req.user?.id!;
  if (!(await m.garminConnected(userId))) {
    return res.status(400).json({ error: 'Hubungkan Garmin dulu di Pengaturan.' });
  }
  const { days, details } = req.body || {};
  m.queueSync(userId, days ? Number(days) : undefined, Boolean(details));
  res.json({ success: true, message: 'Sync Garmin dimulai — menunggu sampai selesai…' });
}));

router.get('/garmin/status', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const m = await import('../services/garminPerUser.js');
  return m.statusHandler(req, res);
}));

// ─── Legacy owner sync (SYNC_SECRET) — dipakai cron harian owner ───
// Sekarang cron memicu sync SEMUA user terhubung (S7), bukan hanya owner.

router.post('/sync', catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { syncAuthorized } = await import('../services/garminTrigger.js');
  if (!syncAuthorized(req)) {
    return res.status(403).json({ error: 'Sync secret tidak valid / tidak diset' });
  }
  const { days, details } = req.body || {};
  const m = await import('../services/garminPerUser.js');
  const queued = await m.queueAllConnected(days ? Number(days) : undefined, Boolean(details));
  res.json({ success: true, message: `Sync dimulai untuk ${queued} user terhubung (antrean).` });
}));

router.get('/analytics/readiness', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const result = await query(
    `SELECT name, COALESCE(start_date_local, start_date::date::text) as start_date, moving_time, average_heartrate, distance
     FROM activities 
     WHERE user_id = $1
     ORDER BY start_date ASC`,
    [userId]
  );

  const readinessData = calculateReadiness(result.rows as any);
  res.json(readinessData.series);
}));

export default router;
