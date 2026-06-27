import { Router, Response } from 'express';
import { query } from '../db.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import axios from 'axios';
import { getValidAccessToken } from '../services/strava.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

router.get('/', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const result = await query(
    `SELECT 
      id, strava_activity_id, name, distance, moving_time, elapsed_time,
      average_speed, average_pace, max_speed, average_heartrate, max_heartrate,
      elevation_gain, start_date, start_date_local, map_polyline, details_fetched
     FROM activities 
     WHERE user_id = $1 
     ORDER BY start_date DESC`,
    [req.user?.id]
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
    console.error('Error saving lab config:', error);
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
    id: z.string().min(1)
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
    'SELECT name, distance, elapsed_time FROM best_efforts WHERE user_id = $1 AND strava_activity_id = $2',
    [userId, activity.strava_activity_id]
  );

  res.json({
    ...activity,
    achieved_prs: prsResult.rows
  });
}));

router.post('/sync', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id!;

  const accessToken = await getValidAccessToken(userId);

  if (!accessToken) {
    // For mock users, generate some fake activities
    const mockActivities = [
      {
        strava_activity_id: Date.now() + 1,
        name: 'Morning Run',
        distance: 5200,
        moving_time: 1500,
        elapsed_time: 1600,
        average_speed: 3.46,
        average_pace: '04:48',
        average_heartrate: 145,
        start_date: new Date().toISOString(),
      },
      {
        strava_activity_id: Date.now() + 2,
        name: 'Long Run',
        distance: 15000,
        moving_time: 4500,
        elapsed_time: 4600,
        average_speed: 3.33,
        average_pace: '05:00',
        average_heartrate: 155,
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    for (const act of mockActivities) {
      await query(`
        INSERT INTO activities (
          user_id, strava_activity_id, name, distance, moving_time, elapsed_time,
          average_speed, average_pace, average_heartrate, start_date, start_date_local
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (strava_activity_id) DO NOTHING
      `, [userId, act.strava_activity_id, act.name, act.distance, act.moving_time,
          act.elapsed_time, act.average_speed, act.average_pace, act.average_heartrate, act.start_date, act.start_date]); // Mock uses same for simplicity
    }

    return res.json({ success: true, message: 'Mock activities synced' });
  }

  // Real Strava Sync - Paginated to fetch history
  let page = 1;
  const perPage = 50;
  let hasMore = true;
  let synced = 0;

  while (hasMore && page <= 5) { // Cap at 5 pages (250 activities) for safety per sync click
    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: perPage, page: page }
    });

    const activities = response.data;
    if (activities.length === 0) {
      hasMore = false;
      break;
    }

    for (const act of activities) {
      // Only sync runs
      if (act.type !== 'Run') continue;

      // Calculate average pace (mm:ss) from m/s
      let avgPace = null;
      if (act.average_speed) {
        const paceSeconds = 1000 / act.average_speed;
        const mins = Math.floor(paceSeconds / 60);
        const secs = Math.floor(paceSeconds % 60);
        avgPace = `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      await query(`
        INSERT INTO activities (
          user_id, strava_activity_id, name, distance, moving_time, elapsed_time,
          average_speed, average_pace, max_speed, average_heartrate, max_heartrate,
          elevation_gain, start_date, start_date_local, map_polyline, cadence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (strava_activity_id) DO UPDATE SET 
          name = EXCLUDED.name,
          distance = EXCLUDED.distance,
          moving_time = EXCLUDED.moving_time,
          elapsed_time = EXCLUDED.elapsed_time,
          average_speed = EXCLUDED.average_speed,
          average_pace = EXCLUDED.average_pace,
          max_speed = EXCLUDED.max_speed,
          average_heartrate = EXCLUDED.average_heartrate,
          max_heartrate = EXCLUDED.max_heartrate,
          elevation_gain = EXCLUDED.elevation_gain,
          start_date = EXCLUDED.start_date,
          start_date_local = EXCLUDED.start_date_local,
          cadence = COALESCE(EXCLUDED.cadence, activities.cadence),
          map_polyline = CASE 
            WHEN EXCLUDED.map_polyline IS NOT NULL AND EXCLUDED.map_polyline <> '' 
            THEN EXCLUDED.map_polyline 
            ELSE activities.map_polyline 
          END
      `, [
        userId, act.id, act.name, act.distance, act.moving_time, act.elapsed_time,
        act.average_speed, avgPace, act.max_speed, act.average_heartrate,
        act.max_heartrate, act.total_elevation_gain, act.start_date, act.start_date_local,
        act.map?.summary_polyline,
        // Strava returns average_cadence as steps per minute (SPM) for runs
        // multiply by 2 to get full cadence (both feet) — standard running metric
        act.average_cadence ? Math.round(act.average_cadence * 2) : null
      ]);
      synced++;
    }
    
    if (activities.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // --- 2. Smart Sync for Best Efforts ---
  // Fetch details for up to 10 activities that we haven't checked for Best Efforts yet.
  // This avoids hitting the Strava API rate limit (100 req / 15 min).
  const activitiesNeedingDetails = await query(`
    SELECT strava_activity_id FROM activities 
    WHERE user_id = $1 AND details_fetched = FALSE
    ORDER BY start_date DESC 
    LIMIT 50
  `, [userId]);

  const targetCategories = ['5K', '10K', '15K', '20K', 'Half-Marathon', '30K', 'Marathon', '50K'];

  console.log(`Need details for ${activitiesNeedingDetails.rows.length} activities`);

  for (const row of activitiesNeedingDetails.rows) {
    try {
      console.log(`Fetching details for activity ${row.strava_activity_id}`);
      const detailRes = await axios.get(`https://www.strava.com/api/v3/activities/${row.strava_activity_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const bestEfforts = detailRes.data.best_efforts || [];
      const splits = JSON.stringify(detailRes.data.splits_metric || []);
      
      // Fetch streams for charts and map (latlng, time, distance, heartrate, altitude, velocity_smooth)
      let streams = null;
      try {
        const streamsRes = await axios.get(`https://www.strava.com/api/v3/activities/${row.strava_activity_id}/streams?keys=latlng,time,distance,heartrate,altitude,velocity_smooth&key_by_type=true`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        streams = JSON.stringify(streamsRes.data);
      } catch (streamError: any) {
        console.error(`Error fetching streams for activity ${row.strava_activity_id}:`, streamError.message);
      }

      for (const effort of bestEfforts) {
        if (targetCategories.includes(effort.name)) {
          // Upsert best effort: only update if the new elapsed_time is faster (smaller) than the existing one
          await query(`
            INSERT INTO best_efforts (
              user_id, name, distance, elapsed_time, moving_time, start_date, start_date_local, strava_activity_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, name) 
            DO UPDATE SET 
              distance = EXCLUDED.distance,
              elapsed_time = EXCLUDED.elapsed_time,
              moving_time = EXCLUDED.moving_time,
              start_date = EXCLUDED.start_date,
              start_date_local = EXCLUDED.start_date_local,
              strava_activity_id = EXCLUDED.strava_activity_id
            WHERE EXCLUDED.elapsed_time < best_efforts.elapsed_time
          `, [
            userId, effort.name, effort.distance, effort.elapsed_time, 
            effort.moving_time, effort.start_date, effort.start_date_local, row.strava_activity_id
          ]);
        }
      }

      // Mark as fetched and save splits and streams
      // Also update map_polyline if it was missing from the summary
      const polyline = detailRes.data.map?.polyline || detailRes.data.map?.summary_polyline;
      // average_cadence from Strava = steps per minute (one foot). ×2 = full SPM.
      const cadenceFromDetail = detailRes.data.average_cadence
        ? Math.round(detailRes.data.average_cadence * 2)
        : null;

      await query(`
        UPDATE activities 
        SET 
          details_fetched = TRUE, 
          splits = $2, 
          streams = $3,
          cadence = COALESCE($5, cadence),
          map_polyline = CASE 
            WHEN map_polyline IS NULL OR map_polyline = '' THEN $4 
            ELSE map_polyline 
          END
        WHERE strava_activity_id = $1
      `, [row.strava_activity_id, splits, streams, polyline, cadenceFromDetail]);
    } catch (detailError: any) {
      console.error(`Error fetching details for activity ${row.strava_activity_id}:`, detailError.response?.data || detailError.message);
      // Continue to the next one even if this one fails
    }
  }

  res.json({ success: true, count: synced });
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
