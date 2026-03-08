import axios from 'axios';
import { query } from '../db';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

interface UserTokens {
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
}

/**
 * Returns a valid Strava access token for the given user.
 * If the current token is expired (or about to expire in 5 minutes),
 * it automatically refreshes using the refresh token and updates the DB.
 */
export async function getValidAccessToken(userId: number): Promise<string | null> {
  const result = await query(
    'SELECT access_token, refresh_token, token_expires_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) return null;

  const user = result.rows[0] as UserTokens;

  if (!user.access_token) {
    return null; // mock user or no token
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;

  // Token still valid (with 5-minute buffer)
  if (user.token_expires_at > nowInSeconds + fiveMinutes) {
    return user.access_token;
  }

  // Token expired — refresh it
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !user.refresh_token) {
    console.warn(`[Strava] Cannot refresh token for user ${userId}: missing credentials or refresh token`);
    return user.access_token;
  }

  try {
    console.log(`[Strava] Refreshing access token for user ${userId}...`);

    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: user.refresh_token,
      grant_type: 'refresh_token',
    });

    const { access_token, refresh_token, expires_at } = response.data;

    await query(
      'UPDATE users SET access_token = $1, refresh_token = $2, token_expires_at = $3 WHERE id = $4',
      [access_token, refresh_token, expires_at, userId]
    );

    console.log(`[Strava] Token refreshed for user ${userId}, expires at ${new Date(expires_at * 1000).toISOString()}`);

    return access_token;
  } catch (error) {
    console.error(`[Strava] Failed to refresh token for user ${userId}:`, error);
    return null;
  }
}
