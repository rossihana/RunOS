import { Router, Response } from 'express';
import { query } from '@/db.js';
import { AuthRequest, authenticate } from '@/middleware/auth.js';
import { catchAsync } from '@/utils/catchAsync.js';

const router = Router();

router.get('/', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    SELECT 
      r.*,
      a.name as activity_name,
      a.distance as activity_distance,
      a.moving_time as activity_moving_time,
      a.average_pace as activity_average_pace,
      a.start_date as activity_start_date,
      a.strava_activity_id as activity_strava_id
    FROM races r
    LEFT JOIN activities a ON r.linked_activity_id = a.id
    WHERE r.user_id = $1 
    ORDER BY r.race_date ASC
  `, [req.user?.id]);
  res.json(result.rows);
}));

router.post('/', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { race_name, distance, race_date, target_time, target_pace } = req.body;

  if (!race_name || !distance || !race_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = await query(`
    INSERT INTO races (user_id, race_name, distance, race_date, target_time, target_pace)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [req.user?.id, race_name, distance, race_date, target_time, target_pace]);

  res.status(201).json(result.rows[0]);
}));

router.post('/:id/link-activity', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { activity_id } = req.body;

  if (!activity_id) {
    return res.status(400).json({ error: 'Missing activity_id' });
  }

  const result = await query(`
    UPDATE races
    SET linked_activity_id = $1
    WHERE id = $2 AND user_id = $3
    RETURNING *
  `, [activity_id, id, req.user?.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found or unauthorized' });
  }

  res.json(result.rows[0]);
}));

router.put('/:id', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { race_name, distance, race_date, target_time, target_pace } = req.body;

  const result = await query(`
    UPDATE races
    SET race_name = $1, distance = $2, race_date = $3, target_time = $4, target_pace = $5
    WHERE id = $6 AND user_id = $7
    RETURNING *
  `, [race_name, distance, race_date, target_time, target_pace, id, req.user?.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found or unauthorized' });
  }

  res.json(result.rows[0]);
}));

router.delete('/:id', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const result = await query(
    'DELETE FROM races WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user?.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found or unauthorized' });
  }

  res.json({ success: true });
}));

export default router;
