import { Router } from 'express';
import { query } from '../db';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const result = await query(
    'SELECT * FROM races WHERE user_id = $1 ORDER BY race_date ASC',
    [req.user?.id]
  );
  res.json(result.rows);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
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
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
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
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const result = await query(
    'DELETE FROM races WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user?.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found or unauthorized' });
  }

  res.json({ success: true });
});

export default router;
