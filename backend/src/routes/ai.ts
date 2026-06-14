import { Router, Response, Request } from 'express';
import { query } from '@/db.js';
import { AuthRequest, authenticate } from '@/middleware/auth.js';
import { 
  generateAIResponse, 
  AI_COACH_SYSTEM_PROMPT, 
  RACE_PREDICTION_SYSTEM_PROMPT, 
  TRAINING_PLAN_SYSTEM_PROMPT,
  SMART_MERGE_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT
} from '@/services/ai.js';
import { format } from 'date-fns';
import { catchAsync } from '@/utils/catchAsync.js';

const router = Router();

// Helper to compute today's Form/Readiness score
async function getReadinessScore(userId: number) {
  try {
    const result = await query(
      `SELECT start_date, moving_time, average_heartrate, distance
       FROM activities 
       WHERE user_id = $1
       ORDER BY start_date ASC`,
      [userId]
    );

    const activities = result.rows;
    if (activities.length === 0) return { form: 0, status: 'Fresh' };

    const dailyLoad = new Map<string, number>();

    activities.forEach(act => {
      const day = new Date(act.start_date).toISOString().split('T')[0];
      const minutes = act.moving_time / 60;
      let load = 0;
      if (act.average_heartrate) {
        const intensity = act.average_heartrate / 190;
        load = minutes * intensity * 1.5;
      } else {
        const km = act.distance / 1000;
        load = km * 6;
      }
      dailyLoad.set(day, (dailyLoad.get(day) || 0) + load);
    });

    const ctlConst = Math.exp(-1 / 42); 
    const atlConst = Math.exp(-1 / 7);  
    let ctl = 0;
    let atl = 0;

    let firstDate = new Date();
    firstDate.setDate(firstDate.getDate() - 90); 
    const actDate = new Date(activities[0].start_date);
    actDate.setHours(0,0,0,0);
    if (actDate < firstDate) firstDate = actDate;

    const today = new Date();
    today.setHours(0,0,0,0);
    const cursorDate = new Date(firstDate);

    while (cursorDate <= today) {
      const dateStr = cursorDate.toISOString().split('T')[0];
      const load = dailyLoad.get(dateStr) || 0;
      ctl = ctl * ctlConst + load * (1 - ctlConst);
      atl = atl * atlConst + load * (1 - atlConst);
      cursorDate.setDate(cursorDate.getDate() + 1);
    }

    const form = Math.round(ctl - atl);
    let status = 'Productive (Normal)';
    if (form > 5) status = 'Fresh / Race Ready';
    if (form < -20) status = 'Overreaching / Fatigued / Warning';

    return { form, status };
  } catch (e) {
    return { form: 0, status: 'Unknown' };
  }
}

// Helper to get comprehensive user context for AI
async function getFullUserContext(userId: number) {
  const [summary, trend, activities, prs, readiness] = await Promise.all([
    query(`
      SELECT 
        SUM(distance) as total_distance,
        SUM(moving_time) as total_time,
        SUM(elevation_gain) as total_elevation
      FROM activities 
      WHERE user_id = $1 AND start_date >= NOW() - INTERVAL '7 days'
    `, [userId]),
    query(`
      SELECT start_date, distance, average_heartrate
      FROM activities 
      WHERE user_id = $1 AND start_date >= NOW() - INTERVAL '1 week'
      ORDER BY start_date DESC
    `, [userId]),
    query(`
      SELECT id, name, distance, moving_time, average_speed, average_heartrate, elevation_gain, start_date
      FROM activities 
      WHERE user_id = $1 
      ORDER BY start_date DESC 
      LIMIT 10
    `, [userId]),
    query(`
      SELECT name, distance, elapsed_time, start_date
      FROM best_efforts
      WHERE user_id = $1
      ORDER BY distance ASC
    `, [userId]),
    getReadinessScore(userId)
  ]);

  return JSON.stringify({
    last_7_days: summary.rows[0],
    past_1_week_trend: trend.rows,
    recent_activities: activities.rows,
    personal_records: prs.rows,
    readiness: {
      todays_form_score: readiness.form,
      status: readiness.status,
      coach_instruction: readiness.form < -20 ? "User is highly fatigued, warn against intense intervals or long runs today!" : "User is in normal/good shape."
    }
  });
}

// 1. Dashboard Analysis & Next Workout Suggestion
router.post('/dashboard-analysis', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const context = await getFullUserContext(req.user?.id!);
  const prompt = `Lakukan analisis mendalam berdasarkan data aktivitas lari saya minggu ini vs rencana.`;
  
  // Pass the specific system prompt. Gemini is configured to output JSON.
  const responseText = await generateAIResponse(prompt, context, AI_COACH_SYSTEM_PROMPT);
  const analysisJson = JSON.parse(responseText);
  
  res.json(analysisJson);
}));

// 2. Individual Activity Analysis
router.post('/activity-analysis/:id', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const activityResult = await query(
    'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
    [id, req.user?.id]
  );

  if (activityResult.rows.length === 0) {
    return res.status(404).json({ error: 'Activity not found' });
  }

  const activity = activityResult.rows[0];
  const context = JSON.stringify(activity);
  const prompt = `
    Analisa lari saya yang berjudul "${activity.name}" pada tanggal ${format(new Date(activity.start_date), 'dd MMM yyyy')}.
    Berikan feedback mendalam tentang pace, heart rate (jika ada), dan konsistensi saya.
    Apa yang bagus dari lari ini dan apa yang bisa diperbaiki?
  `;

  const response = await generateAIResponse(prompt, context, CHAT_SYSTEM_PROMPT, false);
  res.json({ analysis: response });
}));

// 3. Manual AI Chat
router.post('/chat', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const context = await getFullUserContext(req.user?.id!);
  // For manual chat, use conversational prompt and request plain text (not JSON)
  const response = await generateAIResponse(message, context, CHAT_SYSTEM_PROMPT, false);
  res.json({ response });
}));

// 4. Generate & Save Race Prediction
router.post('/race-prediction/:id', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const raceResult = await query('SELECT * FROM races WHERE id = $1 AND user_id = $2', [id, req.user?.id]);
  
  if (raceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const race = raceResult.rows[0];
  const contextStr = await getFullUserContext(req.user?.id!);
  const raceContext = `Target Race: ${race.race_name}\\nDistance: ${race.distance} km\\nTarget Time: ${race.target_time}\\n\\nPast Activity Data:\\n${contextStr}`;
  
  const prompt = `Minta prediksi realistis untuk race saya berdasarkan data aktivitas ini.`;
  const responseText = await generateAIResponse(prompt, raceContext, RACE_PREDICTION_SYSTEM_PROMPT);
  const predictionJson = JSON.parse(responseText);

  // Cache the prediction in DB
  await query(
    'UPDATE races SET prediction = $1 WHERE id = $2 AND user_id = $3',
    [predictionJson, id, req.user?.id]
  );

  res.json(predictionJson);
}));

// 5. Generate & Save Training Plan
router.post('/training-plan/:id', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const raceResult = await query('SELECT * FROM races WHERE id = $1 AND user_id = $2', [id, req.user?.id]);
  
  if (raceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const race = raceResult.rows[0];
  const daysToRace = Math.ceil((new Date(race.race_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
  
  const raceContext = `
    Race Name: ${race.race_name}
    Distance: ${race.distance} km
    Race Date: ${format(new Date(race.race_date), 'yyyy-MM-dd')}
    Target Time: ${race.target_time}
    Target Pace: ${race.target_pace}
    Days to race: ${daysToRace}
  `;
  
  const prompt = `Tolong buatkan training plan terstruktur untuk race saya.`;
  const responseText = await generateAIResponse(prompt, raceContext, TRAINING_PLAN_SYSTEM_PROMPT);
  const trainingPlanJson = JSON.parse(responseText);

  // Cache the training plan in DB
  await query(
    'UPDATE races SET training_plan = $1 WHERE id = $2 AND user_id = $3',
    [trainingPlanJson, id, req.user?.id]
  );

  res.json(trainingPlanJson);
}));

// 6. Merge Multiple Training Plans
router.post('/merge-plans', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { raceIds } = req.body;
  if (!raceIds || !Array.isArray(raceIds) || raceIds.length < 2) {
    return res.status(400).json({ error: 'At least two race IDs are required to merge plans' });
  }

  const racesResult = await query(
    'SELECT id, race_name, distance, race_date, target_time, target_pace, training_plan FROM races WHERE id = ANY($1) AND user_id = $2',
    [raceIds, req.user?.id]
  );

  if (racesResult.rows.length !== raceIds.length) {
    return res.status(404).json({ error: 'One or more races not found' });
  }

  const races = racesResult.rows;
  const plansWithContext = races.map(r => ({
    id: r.id,
    name: r.race_name,
    distance: r.distance,
    date: format(new Date(r.race_date), 'yyyy-MM-dd'),
    targetTime: r.target_time,
    targetPace: r.target_pace,
    plan: r.training_plan
  }));

  const context = JSON.stringify({
    races: plansWithContext,
    currentDate: format(new Date(), 'yyyy-MM-dd')
  });

  const prompt = `Gabungkan training plan untuk ${races.length} race ini menjadi satu master plan yang kohesif.`;
  const responseText = await generateAIResponse(prompt, context, SMART_MERGE_SYSTEM_PROMPT);
  const masterPlanJson = JSON.parse(responseText);

  const persistenceData = {
    raceIds: raceIds,
    plan: masterPlanJson,
    generatedAt: new Date().toISOString()
  };

  // Persist into user table
  await query(
    'UPDATE users SET master_training_plan = $1 WHERE id = $2',
    [persistenceData, req.user?.id]
  );

  res.json(persistenceData);
}));

// 7. Get Saved Master Plan
router.get('/master-plan', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const userResult = await query('SELECT master_training_plan FROM users WHERE id = $1', [req.user?.id]);
  if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  
  res.json(userResult.rows[0].master_training_plan || null);
}));

export default router;
