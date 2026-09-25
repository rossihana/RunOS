import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

router.get('/', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  // ponytail: list endpoint strips map_polyline (heavy); detail page fetches it via /:id
  const limit = Math.min(Number(req.query.limit) || 200, 200);
  // ponytail: polyline heavy — hanya dikirim kalau diminta (?withPolyline=1, dipakai halaman Activities)
  const wantPolyline = req.query.withPolyline === '1';
  const result = await query(
    `SELECT 
      id, garmin_activity_id, name, distance, moving_time, elapsed_time,
      average_speed, average_pace, max_speed, average_heartrate, max_heartrate,
      elevation_gain, start_date, start_date_local, details_fetched
      ${wantPolyline ? ', map_polyline' : ''}
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

    // Health Garmin (Fase 2): HRV/sleep/VO2max resmi dari health_daily (sync --health)
    let garminHealth: { hrv: number | null; sleep: number | null; readiness: number | null; vo2max: number | null } | null = null;
    let healthRow: any = null;
    let garminHealthSeries: Array<{ date: string; hrv: number | null; sleep: number | null; vo2max: number | null; rhr: number | null; stress: number | null }> = [];
    try {
      const hRes = await query(
        `SELECT hrv_ms, sleep_score, readiness_score, vo2max_garmin, pred_5k_s, pred_10k_s, pred_hm_s, pred_fm_s FROM health_daily WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
        [userId]
      );
      if (hRes.rows.length > 0) {
        const h = hRes.rows[0];
        healthRow = h;
        garminHealth = { hrv: h.hrv_ms, sleep: h.sleep_score, readiness: h.readiness_score, vo2max: h.vo2max_garmin };
      }
      // Trend 30 hari terakhir untuk chart HRV/Sleep/VO2max
      const sRes = await query(
        `SELECT date, hrv_ms, sleep_score, vo2max_garmin, rhr, (raw->>'stress')::float AS stress FROM health_daily WHERE user_id = $1 ORDER BY date DESC LIMIT 30`,
        [userId]
      );
      garminHealthSeries = sRes.rows.reverse().map((r: any) => {
        // pg mengembalikan DATE sebagai objek Date — format manual ke YYYY-MM-DD
        const dt: Date = r.date instanceof Date ? r.date : new Date(r.date);
        const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        return { date, hrv: r.hrv_ms, sleep: r.sleep_score, vo2max: r.vo2max_garmin, rhr: r.rhr, stress: r.stress };
      });
    } catch (_) { /* tabel belum ada (belum pernah --health) */ }

    // Race predictor: jangkar VO2max resmi Garmin kalau ada (lebih akurat dari rumus), fallback rumus
    const vo2maxAnchor = garminHealth?.vo2max || vo2max;

    // Fix cadence: Garmin simpan per-kaki x2 di sebagian data — nilai >220 dibagi 2
    const normCadence = (c: number) => (c > 220 ? c / 2 : c);

    const cadenceActivities = activities.filter(a => a.cadence && a.cadence > 0);
    // Median (bukan mean): tahan outlier — lari recovery/walk-break (132-146) narik mean ~7 spm
    let avgCadence: number | null = null;
    if (cadenceActivities.length > 0) {
      const vals = cadenceActivities.map(a => normCadence(a.cadence)).sort((x, y) => x - y);
      const mid = Math.floor(vals.length / 2);
      avgCadence = vals.length % 2 ? Math.round(vals[mid]) : Math.round((vals[mid - 1] + vals[mid]) / 2);
    }

    const allActivities = await query(
      `SELECT COALESCE(start_date_local, start_date::date::text) as start_date, moving_time, average_heartrate, distance, cadence, average_speed FROM activities WHERE user_id = $1 ORDER BY start_date ASC`,
      [userId]
    );

    const readiness = calculateReadiness(allActivities.rows);
    const readinessSeries = readiness.series;

    // 1. Race Predictor: prediksi resmi Garmin per-hari (sumber sama persis dengan jam)
    //    — fallback estimasi VO2max kalau belum pernah sync --health
    let racePredictions: Array<{ name: string; distance: number; time: number }> = [];
    let racePredictionsSource = 'estimate';
    if (healthRow?.pred_5k_s) {
      racePredictions = [
        { name: '5K', distance: 5000, time: healthRow.pred_5k_s },
        { name: '10K', distance: 10000, time: healthRow.pred_10k_s },
        { name: 'Half Marathon', distance: 21097, time: healthRow.pred_hm_s },
        { name: 'Marathon', distance: 42195, time: healthRow.pred_fm_s },
      ].filter(p => p.time != null);
      racePredictionsSource = 'garmin';
    } else {
      racePredictions = predictRaceTimes(vo2maxAnchor);
    }

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

    // Training Readiness ala FirstBeat/Garmin — komponen & band mengikuti metode Garmin
    // (tidur, HRV, stress, recovery, beban); bobot aproksimasi (bobot asli propietar).
    // Compute on-read: tanpa kolom DB — ubah rumus → semua riwayat ikut.
    // ponytail: recovery proxied dari durasi (EPOC tak tersedia via API) → upgrade: pakai endpoint resmi kalau muncul.
    const trainingReadiness = (() => {
      const hrvs = garminHealthSeries.map(s => s.hrv).filter((v): v is number => v != null);
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const hrv7 = hrvs.slice(-7);
      const hrvBase = hrvs.slice(0, Math.max(1, hrvs.length - 7));
      const hrvComp = hrv7.length >= 3 && hrvBase.length >= 7
        ? Math.max(0, Math.min(100, 50 + ((avg(hrv7) - avg(hrvBase)) / avg(hrvBase)) * 200))
        : null;
      const latest = garminHealthSeries[garminHealthSeries.length - 1];
      const sleepComp = latest?.sleep ?? null;
      const stressComp = latest?.stress != null ? Math.max(0, Math.min(100, 100 - latest.stress)) : null;
      // Recovery: jam sejak akhir aktivitas terakhir vs kebutuhan pulih (12 + 6×jam_lari, cap 48 jam)
      let lastEnd = 0, lastMovingH = 0;
      for (const a of activities) {
        if (!a.start_date) continue;
        const sd = a.start_date instanceof Date ? a.start_date : new Date(a.start_date);
        const end = sd.getTime() + (a.moving_time || 0) * 1000;
        if (end > lastEnd) { lastEnd = end; lastMovingH = (a.moving_time || 0) / 3600; }
      }
      const recoveryComp = lastEnd
        ? Math.max(0, Math.min(100, ((Date.now() - lastEnd) / 3600000) / Math.min(48, 12 + lastMovingH * 6) * 100))
        : null;
      // Beban: rasio ATL/CTL — sweet spot 0.8–1.3 (mirip acute:chronic ratio)
      const lastRs = readinessSeries[readinessSeries.length - 1];
      let loadComp: number | null = null;
      if (lastRs && lastRs.fitness > 0) {
        const ratio = lastRs.fatigue / lastRs.fitness;
        loadComp = ratio >= 0.8 && ratio <= 1.3 ? 100
          : ratio < 0.8 ? Math.max(50, 100 - (0.8 - ratio) * 150)
          : Math.max(0, 100 - (ratio - 1.3) * 200);
      }
      const parts = [
        { key: 'sleep', label: 'Tidur', value: sleepComp, weight: 0.30 },
        { key: 'hrv', label: 'HRV', value: hrvComp, weight: 0.20 },
        { key: 'stress', label: 'Stress', value: stressComp, weight: 0.20 },
        { key: 'recovery', label: 'Recovery', value: recoveryComp, weight: 0.15 },
        { key: 'load', label: 'Beban', value: loadComp, weight: 0.15 },
      ].filter((p): p is { key: string; label: string; value: number; weight: number } => p.value != null);
      if (parts.length === 0) return null;
      const wsum = parts.reduce((s, p) => s + p.weight, 0);
      const score = Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / wsum);
      const band = score < 25 ? 'Sangat Rendah' : score < 50 ? 'Rendah' : score < 75 ? 'Sedang' : 'Tinggi';
      return {
        score, band,
        components: parts.map(p => ({ ...p, weight: Math.round((p.weight / wsum) * 100) })),
        source: 'runos-firstbeat',
      };
    })();

    res.json({
      labConfig, zones, zoneDistribution,
      fitnessMetrics: { vo2max: vo2maxAnchor, fitness: readiness.fitness, fatigue: readiness.fatigue, form: readiness.form },
      performanceMetrics: { avgCadence, totalActivities30d: activities.length, totalKm30d: Math.round(activities.reduce((sum, a) => sum + (a.distance / 1000), 0)) },
      garminHealth,
      garminHealthSeries,
      trainingReadiness,
      racePredictions,
      racePredictionsSource,
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
  const { days, details, health } = req.body || {};
  m.queueSync(userId, m.clampDays(days ? Number(days) : undefined), Boolean(details), Boolean(health));
  res.json({ success: true, message: 'Sync Garmin dimulai — menunggu sampai selesai…' });
}));

router.get('/garmin/status', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const m = await import('../services/garminPerUser.js');
  return m.statusHandler(req, res);
}));

// ─── Internal: DIPAKAI GitHub Actions mode=verify (auth: X-Sync-Secret, timing-safe) ───
// /internal-creds        → workflow ambil kredensial terdekripsi (password TIDAK PERNAH
//                          jadi input Actions / muncul di log — repo ini publik).
// /internal-verify-result → callback hasil login: ok → tandai terverifikasi; gagal → hapus.
router.post('/garmin/internal-creds', catchAsync(async (req: Request, res: Response) => {
  const { syncAuthorized } = await import('../services/garminTrigger.js');
  if (!syncAuthorized(req)) return res.status(403).json({ error: 'forbidden' });
  const m = await import('../services/garminPerUser.js');
  const creds = await m.loadCredentials(Number(req.body?.user_id));
  if (!creds) return res.status(404).json({ error: 'kredensial tidak ada' });
  res.set('Cache-Control', 'no-store');
  res.json(creds);
}));

router.post('/garmin/internal-verify-result', catchAsync(async (req: Request, res: Response) => {
  const { syncAuthorized } = await import('../services/garminTrigger.js');
  if (!syncAuthorized(req)) return res.status(403).json({ error: 'forbidden' });
  const userId = Number(req.body?.user_id);
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'user_id tidak valid' });
  const ok = req.body?.ok === true || req.body?.ok === 'true';
  const m = await import('../services/garminPerUser.js');
  await m.applyVerifyResult(userId, ok);
  res.json({ ok: true });
}));

// ─── Legacy owner sync (SYNC_SECRET) — dipakai cron harian owner ───
// Sekarang cron memicu sync SEMUA user terhubung (S7), bukan hanya owner.

router.post('/sync', catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { syncAuthorized } = await import('../services/garminTrigger.js');
  if (!syncAuthorized(req)) {
    return res.status(403).json({ error: 'Sync secret tidak valid / tidak diset' });
  }
  const { days, details, health } = req.body || {};
  const m = await import('../services/garminPerUser.js');
  const queued = await m.queueAllConnected(m.clampDays(days ? Number(days) : undefined), Boolean(details), Boolean(health));
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
