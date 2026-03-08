import { Router } from 'express';
import { query } from '../db';
import { AuthRequest, authenticate } from '../middleware/auth';
import axios from 'axios';
import { getValidAccessToken } from '../services/strava';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const result = await query(
    'SELECT * FROM activities WHERE user_id = $1 ORDER BY start_date DESC',
    [req.user?.id]
  );
  res.json(result.rows);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const activityId = req.params.id;
  const userId = req.user?.id;

  try {
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
  } catch (error) {
    console.error('Error fetching activity details:', error);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
});

router.post('/sync', authenticate, async (req: AuthRequest, res) => {
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
          average_speed, average_pace, average_heartrate, start_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (strava_activity_id) DO NOTHING
      `, [userId, act.strava_activity_id, act.name, act.distance, act.moving_time,
          act.elapsed_time, act.average_speed, act.average_pace, act.average_heartrate, act.start_date]);
    }

    return res.json({ success: true, message: 'Mock activities synced' });
  }

  try {
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
            elevation_gain, start_date, map_polyline
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (strava_activity_id) DO UPDATE SET name = EXCLUDED.name
        `, [
          userId, act.id, act.name, act.distance, act.moving_time, act.elapsed_time,
          act.average_speed, avgPace, act.max_speed, act.average_heartrate,
          act.max_heartrate, act.total_elevation_gain, act.start_date,
          act.map?.summary_polyline
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
                user_id, name, distance, elapsed_time, moving_time, start_date, strava_activity_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (user_id, name) 
              DO UPDATE SET 
                distance = EXCLUDED.distance,
                elapsed_time = EXCLUDED.elapsed_time,
                moving_time = EXCLUDED.moving_time,
                start_date = EXCLUDED.start_date,
                strava_activity_id = EXCLUDED.strava_activity_id
              WHERE EXCLUDED.elapsed_time < best_efforts.elapsed_time
            `, [
              userId, effort.name, effort.distance, effort.elapsed_time, 
              effort.moving_time, effort.start_date, row.strava_activity_id
            ]);
          }
        }

        // Mark as fetched and save splits and streams
        await query('UPDATE activities SET details_fetched = TRUE, splits = $2, streams = $3 WHERE strava_activity_id = $1', [row.strava_activity_id, splits, streams]);
      } catch (detailError: any) {
        console.error(`Error fetching details for activity ${row.strava_activity_id}:`, detailError.response?.data || detailError.message);
        // Continue to the next one even if this one fails
      }
    }

    res.json({ success: true, count: synced });
  } catch (error: any) {
    console.error('Error syncing activities:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to sync activities' });
  }
});

export default router;
