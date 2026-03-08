import axios from 'axios';
import { query } from './db';
import { getValidAccessToken } from './services/strava';

async function testStravaBestEfforts() {
  const userId = 1; // Assuming the user ID is 1 (we can get it from DB if needed)
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    console.error('No access token');
    return;
  }
  
  try {
    // Let's get athlete ID first
    const athleteRes = await axios.get('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const athleteId = athleteRes.data.id;
    console.log('Athlete ID:', athleteId);
    
    // Test stats endpoint
    const statsRes = await axios.get(`https://www.strava.com/api/v3/athletes/${athleteId}/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('Stats Response Keys:', Object.keys(statsRes.data));
    console.log('Stats preview:', JSON.stringify(statsRes.data, null, 2).substring(0, 500));
    
    // Test a recent activity details just to see best efforts
    const actsRes = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 5 }
    });
    
    for (const act of actsRes.data) {
      if (act.type === 'Run') {
        const detailRes = await axios.get(`https://www.strava.com/api/v3/activities/${act.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log(`\nActivity ${act.id} Best Efforts:`);
        console.log(JSON.stringify(detailRes.data.best_efforts || [], null, 2));
        break;
      }
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
  process.exit(0);
}

testStravaBestEfforts();
