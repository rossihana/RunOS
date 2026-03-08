import { Router } from 'express';
import { query } from '../db.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AuthRequest, authenticate } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const isProduction = process.env.NODE_ENV === 'production';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

router.get('/url', (req, res) => {
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!STRAVA_CLIENT_ID) {
    return res.json({ url: `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/mock-callback` });
  }

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
  });

  res.json({ url: `https://www.strava.com/oauth/authorize?${params.toString()}` });
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing code');
  }

  try {
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;

    // Upsert user
    await query(`
      INSERT INTO users (strava_athlete_id, access_token, refresh_token, token_expires_at, first_name, last_name, profile_picture)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (strava_athlete_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        profile_picture = EXCLUDED.profile_picture
    `, [athlete.id, access_token, refresh_token, expires_at, athlete.firstname, athlete.lastname, athlete.profile]);

    const userResult = await query('SELECT id FROM users WHERE strava_athlete_id = $1', [athlete.id]);
    const userRow = userResult.rows[0];

    const token = jwt.sign({ id: userRow.id, strava_athlete_id: athlete.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Strava OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Mock callback for dev without Strava credentials
router.get('/mock-callback', async (req, res) => {
  const mockAthleteId = 12345;

  await query(`
    INSERT INTO users (strava_athlete_id, first_name, last_name, profile_picture)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (strava_athlete_id) DO UPDATE SET
      first_name = EXCLUDED.first_name
  `, [mockAthleteId, 'Mock', 'Runner', 'https://picsum.photos/seed/runner/200/200']);

  const userResult = await query('SELECT id FROM users WHERE strava_athlete_id = $1', [mockAthleteId]);
  const userRow = userResult.rows[0];

  const token = jwt.sign({ id: userRow.id, strava_athlete_id: mockAthleteId }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Mock Authentication successful. This window should close automatically.</p>
      </body>
    </html>
  `);
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const result = await query(
    'SELECT id, strava_athlete_id, first_name, last_name, profile_picture FROM users WHERE id = $1',
    [req.user?.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(result.rows[0]);
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
