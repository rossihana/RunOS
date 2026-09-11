import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { encrypt, decrypt } from '../services/crypto.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { aiRateLimit } from '../middleware/rateLimit.js';
import { aiIdempotency } from '../middleware/idempotency.js';
import {
  generateAIJson,
  generateAIText,
  generateAIChat,
  generateAIChatStream,
  listAIModels,
  getAISettings,
  featureModel,
  clientFor,
  bareModel,
  DEFAULT_MODEL,
  FREE_MODELS,
  FREE_DEFAULT_MODEL,
  OWNER_EMAILS,
  AIResponseError,
  AI_COACH_SYSTEM_PROMPT,
  RACE_PREDICTION_SYSTEM_PROMPT,
  TRAINING_PLAN_SYSTEM_PROMPT,
  SMART_MERGE_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT
} from '../services/ai.js';
import { estimateVO2Max } from '../services/analytics.js';
import { z } from 'zod';
import { format } from 'date-fns';
import { catchAsync } from '../utils/catchAsync.js';

const router = Router();

// ─── Rate limit persisten per endpoint AI (DB-based — akurat di balik LB) ───
const RL = {
  chat: aiRateLimit('chat', 20, 60),
  dashboard: aiRateLimit('dashboard-analysis', 6, 60),
  activity: aiRateLimit('activity-analysis', 10, 60),
  prediction: aiRateLimit('race-prediction', 4, 60),
  plan: aiRateLimit('training-plan', 4, 60),
  merge: aiRateLimit('merge-plans', 2, 60),
};

// ─── Model & provider per user ───
// defaultModel + per-feature override + custom provider (BYOK, OpenAI-compatible).
// Model custom berformat "provider:model". API key provider TIDAK pernah dikirim balik ke klien.

const MODEL_RE = /^[a-zA-Z0-9._\-\/:]{1,150}$/;
const PROVIDER_NAME_RE = /^[a-zA-Z0-9_-]{1,30}$/;
const AI_FEATURES = ['chat', 'dashboard', 'activity', 'prediction', 'plan', 'merge'] as const;

// ─── S2: user biasa hanya boleh model GRATIS + provider sendiri (BYOK).
// Owner (OWNER_EMAILS) bebas pakai semua model di 9router (termasuk glm-5.3-flash).
async function emailOf(userId: number): Promise<string> {
  const r = await query('SELECT email FROM users WHERE id = $1', [userId]);
  return String(r.rows[0]?.email || '').toLowerCase();
}
function isOwner(email: string): boolean {
  return OWNER_EMAILS.includes(email);
}
function modelAllowed(email: string, model: string, hasCustomProvider: boolean): boolean {
  if (isOwner(email)) return true;
  if (model.includes(':')) return hasCustomProvider; // BYOK: provider harus milik user
  return FREE_MODELS.includes(model);
}
async function assertModelsAllowed(userId: number, models: (string | null | undefined)[]): Promise<string | null> {
  const email = await emailOf(userId);
  if (isOwner(email)) return null;
  const settings = await getAISettings(userId);
  for (const m of models) {
    if (!m) continue;
    if (!modelAllowed(email, m, !!settings.customProviders?.[m.split(':')[0]])) {
      return `Model "${m}" tidak tersedia untuk akunmu. Pilih model gratis (${FREE_MODELS.join(', ')}) atau tambahkan provider sendiri di Pengaturan AI.`;
    }
  }
  return null;
}

router.get('/models', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const settings = await getAISettings(req.user?.id!);
  const catalog = await listAIModels();
  // Katalog provider custom (best-effort — provider mati tidak boleh merusak endpoint)
  const custom: { name: string; models: string[]; error?: string }[] = [];
  for (const [name, p] of Object.entries(settings.customProviders || {})) {
    try {
      const c = clientFor(`${name}:x`, settings);
      const list = await c.models.list();
      custom.push({ name, models: (list.data || []).map(m => m.id).filter(Boolean).slice(0, 100) });
    } catch (e: any) {
      custom.push({ name, models: [], error: String(e?.message || e).slice(0, 120) });
    }
  }
  res.json({
    models: isOwner(await emailOf(req.user?.id!)) ? catalog : FREE_MODELS,
    freeModels: FREE_MODELS,
    custom,
    default: settings.defaultModel || (isOwner(await emailOf(req.user?.id!)) ? DEFAULT_MODEL : FREE_DEFAULT_MODEL),
    features: settings.features || {}
  });
}));

router.get('/settings', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const s = await getAISettings(req.user?.id!);
  res.json({
    defaultModel: s.defaultModel || null,
    features: s.features || {},
    providers: Object.entries(s.customProviders || {}).map(([name, p]) => ({ name, baseUrl: p.baseUrl }))
  });
}));

router.put('/settings', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { defaultModel, features } = req.body || {};
  const s = await getAISettings(req.user?.id!);

  // Kumpulkan semua model yang akan aktif untuk validasi S2
  const pending: (string | null | undefined)[] = [];
  if (defaultModel !== undefined) pending.push(defaultModel);
  if (features !== undefined && typeof features === 'object' && features) {
    pending.push(...Object.values(features as Record<string, unknown>).map(v => (typeof v === 'string' ? v : null)));
  }
  const denied = await assertModelsAllowed(req.user?.id!, pending);
  if (denied) return res.status(403).json({ error: denied });

  if (defaultModel !== undefined) {
    if (defaultModel !== null && (typeof defaultModel !== 'string' || !MODEL_RE.test(defaultModel))) {
      return res.status(400).json({ error: 'Model tidak valid' });
    }
    s.defaultModel = defaultModel;
  }
  if (features !== undefined) {
    if (typeof features !== 'object' || features === null) {
      return res.status(400).json({ error: 'features tidak valid' });
    }
    for (const [k, v] of Object.entries(features as Record<string, unknown>)) {
      if (!(AI_FEATURES as readonly string[]).includes(k)) {
        return res.status(400).json({ error: `Fitur tidak dikenal: ${k}` });
      }
      if (v !== null && (typeof v !== 'string' || !MODEL_RE.test(v))) {
        return res.status(400).json({ error: `Model tidak valid untuk fitur ${k}` });
      }
      s.features = s.features || {};
      if (v === null) delete s.features[k];
      else s.features[k] = v as string;
    }
  }
  await query('UPDATE users SET ai_settings = $1 WHERE id = $2', [JSON.stringify(s), req.user?.id]);
  res.json({ success: true, defaultModel: s.defaultModel || null, features: s.features || {} });
}));

// Provider custom: tambah/update (BYOK — key disimpan di server, tak pernah dikirim balik)
router.put('/providers', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { name, baseUrl, apiKey } = req.body || {};
  if (typeof name !== 'string' || !PROVIDER_NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Nama provider tidak valid (huruf/angka/-/_ , maks 30)' });
  }
  if (typeof baseUrl !== 'string' || !/^https?:\/\/.+/.test(baseUrl) || baseUrl.length > 300) {
    return res.status(400).json({ error: 'Base URL tidak valid (harus http/https)' });
  }
  if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 300) {
    return res.status(400).json({ error: 'API key tidak valid' });
  }
  const s = await getAISettings(req.user?.id!);
  s.customProviders = s.customProviders || {};
  // S3: API key disimpan TERENKRIPSI (AES-256-GCM) — tidak pernah plaintext di DB
  s.customProviders[name] = { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey: encrypt(apiKey) };
  await query('UPDATE users SET ai_settings = $1 WHERE id = $2', [JSON.stringify(s), req.user?.id]);
  res.json({ success: true, name, baseUrl: s.customProviders[name].baseUrl });
}));

router.delete('/providers/:name', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  const s = await getAISettings(req.user?.id!);
  if (s.customProviders?.[name]) {
    delete s.customProviders[name];
    // Bersihkan juga referensi model yang memakai provider ini
    if (s.defaultModel?.startsWith(`${name}:`)) s.defaultModel = null;
    for (const k of Object.keys(s.features || {})) {
      if (s.features![k]?.startsWith(`${name}:`)) delete s.features![k];
    }
    await query('UPDATE users SET ai_settings = $1 WHERE id = $2', [JSON.stringify(s), req.user?.id]);
  }
  res.json({ success: true });
}));

// Test provider: coba list models
router.post('/providers/:name/test', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  const s = await getAISettings(req.user?.id!);
  const p = s.customProviders?.[name];
  if (!p) return res.status(404).json({ error: 'Provider tidak ditemukan' });
  try {
    const client = clientFor(`${name}:x`, s);
    const list = await client.models.list();
    const models = (list.data || []).map(m => m.id).filter(Boolean);
    res.json({ ok: true, count: models.length, sample: models.slice(0, 8) });
  } catch (e: any) {
    res.json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
}));

// Helper to compute today's Form/Readiness score
async function getReadinessScore(userId: number) {
  try {
    const parseLocalDate = (dateStr: string | Date): Date => {
      if (dateStr instanceof Date) {
        return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
      }
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      }
      return new Date(dateStr);
    };

    const formatLocalDate = (d: Date): string => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const result = await query(
      `SELECT COALESCE(start_date_local, start_date::date::text) as start_date, moving_time, average_heartrate, distance, average_speed
       FROM activities 
       WHERE user_id = $1
       ORDER BY start_date ASC`,
      [userId]
    );

    const activities = result.rows;
    if (activities.length === 0) return { form: 0, status: 'Fresh' };

    const dailyLoad = new Map<string, number>();

    activities.forEach(act => {
      const dateStr = typeof act.start_date === 'string'
        ? act.start_date
        : (act.start_date as Date).toISOString();
      const day = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
      const minutes = act.moving_time / 60;
      let load = 0;
      if (act.average_heartrate) {
        const intensity = act.average_heartrate / 190;
        load = minutes * intensity * 1.5;
      } else {
        // S4: tanpa HR → estimasi intensitas dari pace aktual (bukan flat km*6):
        // pace 5:00/km ≈ intensitas 1.0; makin lambat makin ringan.
        const km = act.distance / 1000;
        const speed = act.average_speed || (km > 0 ? act.distance / act.moving_time : 0);
        const secPerKm = speed > 0 ? 1000 / speed : 360; // default 6:00/km
        const intensity = Math.min(Math.max(300 / secPerKm, 0.5), 1.3);
        load = minutes * intensity;
      }
      dailyLoad.set(day, (dailyLoad.get(day) || 0) + load);
    });

    const ctlConst = Math.exp(-1 / 42); 
    const atlConst = Math.exp(-1 / 7);  
    let ctl = 0;
    let atl = 0;

    let firstDate = new Date();
    firstDate.setDate(firstDate.getDate() - 90); 
    const actDate = parseLocalDate(activities[0].start_date);
    actDate.setHours(0,0,0,0);
    if (actDate < firstDate) firstDate = actDate;

    const today = new Date();
    today.setHours(0,0,0,0);
    const cursorDate = new Date(firstDate);

    while (cursorDate <= today) {
      const dateStr = formatLocalDate(cursorDate);
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

// Tanggal & hari ini (WIB) — model butuh ini agar tidak menebak dari aktivitas terakhir
function nowJakarta(): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date()) + ' (WIB)';
}

// Identitas model — supaya model tidak mengaku-ngaku produk lain
export function modelIdentity(model: string): string {
  const bare = model.includes(':') ? model.split(':').slice(1).join(':') : model;
  const provider = model.includes(':') ? model.split(':')[0] : '9router';
  const pretty = bare
    .replace(/^[a-z]+\//, '')            // prefix vendor
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return `${pretty} (via ${provider})`;
}

// Helper: konteks kaya untuk semua fitur AI
async function getFullUserContext(userId: number) {
  const [summary, trend, activities, prs, readiness, userRow, planRow] = await Promise.all([
    query(`
      SELECT 
        SUM(distance) as total_distance,
        SUM(moving_time) as total_time,
        SUM(elevation_gain) as total_elevation
      FROM activities 
      WHERE user_id = $1 AND start_date >= NOW() - INTERVAL '7 days'
    `, [userId]),
    query(`
      SELECT COALESCE(start_date_local, start_date::date::text) as start_date, distance, average_heartrate
      FROM activities 
      WHERE user_id = $1 AND start_date >= NOW() - INTERVAL '1 week'
      ORDER BY start_date DESC
    `, [userId]),
    query(`
      SELECT id, name, distance, moving_time, average_speed, average_heartrate, elevation_gain, cadence, splits,
             COALESCE(start_date_local, start_date::date::text) as start_date
      FROM activities 
      WHERE user_id = $1 
      ORDER BY start_date DESC 
      LIMIT 10
    `, [userId]),
    query(`
      SELECT name, distance, elapsed_time, COALESCE(start_date_local, start_date::date::text) as start_date
      FROM best_efforts
      WHERE user_id = $1
      ORDER BY distance ASC
    `, [userId]),
    getReadinessScore(userId),
    query('SELECT lab_config FROM users WHERE id = $1', [userId]),
    query(`
      SELECT id, workout_date, workout_type, details FROM coach_suggestions
      WHERE user_id = $1 AND status = 'pending' AND workout_date >= CURRENT_DATE
      ORDER BY workout_date LIMIT 1
    `, [userId])
  ]);

  const pendingPlan = planRow.rows[0] || null;
  return JSON.stringify({
    current_date: nowJakarta(),
    last_7_days: summary.rows[0],
    past_1_week_trend: trend.rows,
    recent_activities: activities.rows,
    personal_records: prs.rows,
    hr_zones_config: userRow.rows[0]?.lab_config || null,
    pending_coach_plan: pendingPlan
      ? { suggestion_id: pendingPlan.id, date: pendingPlan.workout_date, type: pendingPlan.workout_type, details: pendingPlan.details }
      : null,
    readiness: {
      todays_form_score: readiness.form,
      status: readiness.status,
      coach_instruction: readiness.form < -20 ? "User is highly fatigued, warn against intense intervals or long runs today!" : "User is in normal/good shape."
    }
  });
}

// 1. Dashboard Analysis & Next Workout Suggestion
// conditionDiagnosis/forwardOutlook: model baru kadang mengirim object — dinormalisasi ke string
const dashboardSchema = z.object({
  conditionDiagnosis: z.any(),
  tomorrowRecommendation: z.record(z.string(), z.any()),
  forwardOutlook: z.any()
}).catchall(z.unknown());

function coerceText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .filter(x => typeof x === 'string' || typeof x === 'number')
      .join(' — ') || JSON.stringify(v);
  }
  return String(v ?? '');
}

router.post('/dashboard-analysis', authenticate, RL.dashboard, aiIdempotency('dashboard-analysis'), catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id!;
  const { model, settings } = featureModel('dashboard', await getAISettings(userId));
  const deniedModel = await assertModelsAllowed(userId, [model]);
  if (deniedModel) return res.status(403).json({ error: deniedModel });
  const context = await getFullUserContext(userId);
  const prompt = `Lakukan analisis mendalam berdasarkan data aktivitas lari saya minggu ini vs rencana.`;

  const analysis = await generateAIJson(prompt, context, AI_COACH_SYSTEM_PROMPT, model,
    (d) => dashboardSchema.parse(d), settings);

  // Simpan saran workout untuk feedback loop (saran pending lama ditandai superseded)
  const rec = analysis.tomorrowRecommendation || {};
  try {
    await query(
      `UPDATE coach_suggestions SET status = 'superseded' WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );
    await query(
      `INSERT INTO coach_suggestions (user_id, workout_date, workout_type, details, source)
       VALUES ($1, CURRENT_DATE + 1, $2, $3, 'dashboard-analysis')`,
      [userId, String(rec.sessionType || 'Run'), JSON.stringify(rec)]
    );
  } catch (e) { /* logging saran tidak boleh gagalkan analisis */ }

  res.json({
    ...analysis,
    conditionDiagnosis: coerceText(analysis.conditionDiagnosis),
    forwardOutlook: coerceText(analysis.forwardOutlook),
    suggestion_saved: true
  });
}));

// 2. Individual Activity Analysis
router.post('/activity-analysis/:id', authenticate, RL.activity, aiIdempotency('activity-analysis'), catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const activityResult = await query(
    'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
    [id, req.user?.id]
  );

  if (activityResult.rows.length === 0) {
    return res.status(404).json({ error: 'Activity not found' });
  }

  const activity = activityResult.rows[0];
  const { model, settings } = featureModel('activity', await getAISettings(req.user?.id!));
  const deniedModel = await assertModelsAllowed(req.user?.id!, [model]);
  if (deniedModel) return res.status(403).json({ error: deniedModel });
  const context = JSON.stringify(activity);
  const prompt = `
    Analisa lari saya yang berjudul "${activity.name}" pada tanggal ${format(new Date(activity.start_date), 'dd MMM yyyy')}.
    Berikan feedback mendalam tentang pace, heart rate (jika ada), dan konsistensi saya.
    Apa yang bagus dari lari ini dan apa yang bisa diperbaiki?
  `;

  const analysis = await generateAIText(prompt, context, CHAT_SYSTEM_PROMPT, model, settings);
  res.json({ analysis });
}));

// 3. AI Chat — dengan memori percakapan + function calling ringan
type ToolCall = { id: string; function: { name: string; arguments: string } };

const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_best_efforts',
      description: 'Ambil semua personal records (best efforts) user: kategori, waktu, tanggal.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_activity_detail',
      description: 'Ambil detail satu aktivitas lari (pace, HR, splits per km). Tanpa argumen = aktivitas terbaru.',
      parameters: { type: 'object', properties: { activity_id: { type: 'number', description: 'ID aktivitas (opsional)' } } }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_cadence_trend',
      description: 'Tren kadence mingguan user (rata-rata spm per minggu, 12 minggu terakhir).',
      parameters: { type: 'object', properties: {} }
    }
  }
] as any;

async function executeTool(name: string, argsJson: string, userId: number): Promise<string> {
  let args: any = {};
  try { args = JSON.parse(argsJson || '{}'); } catch { /* ignore */ }
  if (name === 'get_best_efforts') {
    const r = await query(
      'SELECT name, distance, elapsed_time, COALESCE(start_date_local, start_date::date::text) as date FROM best_efforts WHERE user_id = $1 ORDER BY distance',
      [userId]);
    return JSON.stringify(r.rows);
  }
  if (name === 'get_activity_detail') {
    const r = args.activity_id
      ? await query('SELECT name, distance, moving_time, average_speed, average_heartrate, cadence, splits, COALESCE(start_date_local, start_date::date::text) as date FROM activities WHERE id = $1 AND user_id = $2', [args.activity_id, userId])
      : await query('SELECT name, distance, moving_time, average_speed, average_heartrate, cadence, splits, COALESCE(start_date_local, start_date::date::text) as date FROM activities WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1', [userId]);
    return JSON.stringify(r.rows[0] || { error: 'tidak ada aktivitas' });
  }
  if (name === 'get_cadence_trend') {
    const r = await query(`
      SELECT date_trunc('week', COALESCE(start_date_local::timestamp, start_date)) as week,
             ROUND(AVG(cadence)::numeric, 1) as avg_cadence, COUNT(*) as runs
      FROM activities WHERE user_id = $1 AND cadence IS NOT NULL
        AND start_date >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1`, [userId]);
    return JSON.stringify(r.rows);
  }
  return JSON.stringify({ error: `tool tidak dikenal: ${name}` });
}

router.post('/chat', authenticate, RL.chat, aiIdempotency('chat'), catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id!;
  const { message, stream } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });
  if (message.length > 4000) return res.status(400).json({ error: 'Pesan terlalu panjang' });

  const { model, settings } = featureModel('chat', await getAISettings(userId));
  const deniedModel = await assertModelsAllowed(userId, [model]);
  if (deniedModel) return res.status(403).json({ error: deniedModel });
  const context = await getFullUserContext(userId);

  // Muat riwayat percakapan (16 pesan terakhir)
  const history = await query(
    'SELECT role, content FROM ai_chat_messages WHERE user_id = $1 ORDER BY id DESC LIMIT 16',
    [userId]
  );
  const historyMsgs = history.rows.reverse().map((h: any) => ({ role: h.role, content: h.content }));

  const messages: any[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: `Hari ini: ${nowJakarta()}.\nKamu menjawab sebagai model: ${modelIdentity(model)}. Jika ditanya model/brand AI apa yang kamu pakai, jawab persis itu — jangan mengaku brand lain.\nContext data (stats kamu):\n${context}\n\nGunakan data ini untuk menjawab. Selalu pakai tanggal hari ini di atas sebagai acuan "hari ini", "kemarin", dan "besok".` },
    ...historyMsgs,
    { role: 'user', content: message }
  ];

  // ── Mode streaming (SSE): jawaban dikirim bertahap ──
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      // Tahap 1: deteksi tool call (non-stream — tools dihitung dulu)
      const first = await openaiWithTools(messages, model, settings);
      if (first.toolCalls && first.toolCalls.length > 0) {
        send('tool', { tools: first.toolCalls.map(t => t.function.name) });
        messages.push({ role: 'assistant', content: first.content || null, tool_calls: first.raw.tool_calls });
        for (const tc of first.toolCalls) {
          const result = await executeTool(tc.function.name, tc.function.arguments, userId);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
      }
      // Tahap 2: stream jawaban final
      const reply = await generateAIChatStream(messages, model, (delta) => send('delta', { text: delta }), settings);
      send('done', { model });
      res.end();

      await query('INSERT INTO ai_chat_messages (user_id, role, content, model) VALUES ($1, $2, $3, $4)',
        [userId, 'user', message, model]);
      await query('INSERT INTO ai_chat_messages (user_id, role, content, model) VALUES ($1, $2, $3, $4)',
        [userId, 'assistant', reply, model]);
    } catch (err: any) {
      send('error', { message: err?.message || 'AI gagal merespons' });
      res.end();
    }
    return;
  }

  // ── Mode biasa (non-stream) ──
  let reply = '';
  try {
    // Coba dengan tools (function calling); kalau provider tidak dukung, plain call
    const first = await openaiWithTools(messages, model, settings);
    if (first.toolCalls && first.toolCalls.length > 0) {
      messages.push({ role: 'assistant', content: first.content || null, tool_calls: first.raw.tool_calls });
      for (const tc of first.toolCalls) {
        const result = await executeTool(tc.function.name, tc.function.arguments, userId);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
      const second = await generateAIChat(messages, model, settings);
      reply = second;
    } else {
      reply = first.content || '';
    }
  } catch (err) {
    if (err instanceof AIResponseError) throw err;
    throw err;
  }

  // Simpan percakapan
  await query('INSERT INTO ai_chat_messages (user_id, role, content, model) VALUES ($1, $2, $3, $4)',
    [userId, 'user', message, model]);
  await query('INSERT INTO ai_chat_messages (user_id, role, content, model) VALUES ($1, $2, $3, $4)',
    [userId, 'assistant', reply, model]);

  res.json({ response: reply, model });
}));

async function openaiWithTools(messages: any[], model: string, settings = { } as any): Promise<{ content: string | null; toolCalls?: ToolCall[]; raw?: any }> {
  const client = clientFor(model, settings);
  try {
    const response = await client.chat.completions.create({
      model: bareModel(model),
      messages,
      tools: AI_TOOLS,
    });
    const msg = response.choices[0].message as any;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      return { content: msg.content, toolCalls: msg.tool_calls, raw: msg };
    }
    return { content: msg.content || '' };
  } catch (err) {
    // Provider tidak mendukung tools → panggilan biasa
    const reply = await generateAIChat(messages, model, settings);
    return { content: reply };
  }
}

// 3b. Riwayat chat untuk frontend
router.get('/chat/history', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  const r = await query(
    'SELECT role, content, model, created_at FROM ai_chat_messages WHERE user_id = $1 ORDER BY id DESC LIMIT 30',
    [req.user?.id]
  );
  res.json(r.rows.reverse());
}));

router.delete('/chat/history', authenticate, catchAsync(async (req: AuthRequest, res: Response) => {
  await query('DELETE FROM ai_chat_messages WHERE user_id = $1', [req.user?.id]);
  res.json({ success: true });
}));

// 4. Generate & Save Race Prediction — hybrid: formula baseline + AI narasi
const predictionSchema = z.object({
  prediction: z.record(z.string(), z.any()),
  readinessLevel: z.record(z.string(), z.any()).optional()
}).catchall(z.unknown());

router.post('/race-prediction/:id', authenticate, RL.prediction, aiIdempotency('race-prediction'), catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const raceResult = await query('SELECT * FROM races WHERE id = $1 AND user_id = $2', [id, req.user?.id]);
  
  if (raceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const race = raceResult.rows[0];
  const { model, settings } = featureModel('prediction', await getAISettings(req.user?.id!));
  const deniedModel = await assertModelsAllowed(req.user?.id!, [model]);
  if (deniedModel) return res.status(403).json({ error: deniedModel });

  // Baseline formula (VO2max → Riegel) sebagai jangkar objektif
  const acts = await query(
    `SELECT start_date, moving_time, average_heartrate, distance, average_speed, splits
     FROM activities WHERE user_id = $1 AND start_date >= NOW() - INTERVAL '60 days'
     ORDER BY start_date DESC`, [req.user?.id]);
  const lab = await query('SELECT lab_config FROM users WHERE id = $1', [req.user?.id]);
  const vo2max = estimateVO2Max(acts.rows, lab.rows[0]?.lab_config?.maxHr);
  const { predictRaceTimes } = await import('../services/analytics.js');
  const baseline = predictRaceTimes(vo2max);

  const contextStr = await getFullUserContext(req.user?.id!);
  const raceContext = `Target Race: ${race.race_name}\nDistance: ${race.distance} km\nTarget Time: ${race.target_time}\n\nBaseline prediksi dari formula VO2max (${vo2max?.toFixed?.(1) ?? vo2max}): ${JSON.stringify(baseline)}\nGunakan baseline ini sebagai jangkar — kalau analisis kamu berbeda jauh, jelaskan kenapa.\n\nPast Activity Data:\n${contextStr}`;
  
  const prompt = `Minta prediksi realistis untuk race saya berdasarkan data aktivitas ini.`;
  const prediction = await generateAIJson(prompt, raceContext, RACE_PREDICTION_SYSTEM_PROMPT, model,
    (d) => predictionSchema.parse(d), settings);

  // Cache the prediction in DB
  await query(
    'UPDATE races SET prediction = $1 WHERE id = $2 AND user_id = $3',
    [prediction, id, req.user?.id]
  );

  res.json(prediction);
}));

// 5. Generate & Save Training Plan
const planSchema = z.object({
  summary: z.string().optional(),
  phases: z.array(z.any()).min(1),
  raceDay: z.any().optional(),
  coachTips: z.any().optional()
}).catchall(z.unknown());

router.post('/training-plan/:id', authenticate, RL.plan, aiIdempotency('training-plan'), catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const raceResult = await query('SELECT * FROM races WHERE id = $1 AND user_id = $2', [id, req.user?.id]);
  
  if (raceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Race not found' });
  }
  
  const race = raceResult.rows[0];
  const { model, settings } = featureModel('plan', await getAISettings(req.user?.id!));
  const deniedModel = await assertModelsAllowed(req.user?.id!, [model]);
  if (deniedModel) return res.status(403).json({ error: deniedModel });
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
  const trainingPlan = await generateAIJson(prompt, raceContext, TRAINING_PLAN_SYSTEM_PROMPT, model,
    (d) => planSchema.parse(d), settings);

  // Cache the training plan in DB
  await query(
    'UPDATE races SET training_plan = $1 WHERE id = $2 AND user_id = $3',
    [trainingPlan, id, req.user?.id]
  );

  res.json(trainingPlan);
}));

// 6. Merge Multiple Training Plans
router.post('/merge-plans', authenticate, RL.merge, aiIdempotency('merge-plans'), catchAsync(async (req: AuthRequest, res: Response) => {
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

  const { model, settings } = featureModel('merge', await getAISettings(req.user?.id!));
  const deniedModel = await assertModelsAllowed(req.user?.id!, [model]);
  if (deniedModel) return res.status(403).json({ error: deniedModel });
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
  const masterPlan = await generateAIJson(prompt, context, SMART_MERGE_SYSTEM_PROMPT, model,
    (d) => z.object({
      ringkasanStrategi: z.any(),
      masterPlan: z.array(z.any()).min(1)
    }).catchall(z.unknown()).parse(d), settings);

  const persistenceData = {
    raceIds: raceIds,
    plan: masterPlan,
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
