export interface LabConfig {
  method: string;
  maxHr: number;
  restingHr: number;
  lthr: number;
  age: number | null;
  updatedAt: string;
}

export interface ActivityData {
  start_date: string;
  moving_time: number;
  average_heartrate: number | null;
  distance: number;
  cadence: number | null;
  average_speed: number | null;
  splits?: any;
  streams?: any;
}

/** Compute zone ranges from a saved config */
export function computeZones(config: LabConfig): Array<{ zone: number; label: string; min: number; max: number; color: string }> {
  const { method, maxHr, restingHr, lthr } = config;
  const hrr = maxHr - restingHr;
  const zones: Array<{ zone: number; label: string; min: number; max: number; color: string }> = [];

  const mkZone = (z: number, lo: number, hi: number, label: string, color: string) => ({
    zone: z, label, min: Math.round(lo), max: Math.round(hi), color,
  });

  if (method === 'lthr') {
    zones.push(mkZone(1, lthr * 0,    lthr * 0.81,  'Active Recovery',    '#6366f1'));
    zones.push(mkZone(2, lthr * 0.81, lthr * 0.89,  'Aerobic Endurance',  '#22c55e'));
    zones.push(mkZone(3, lthr * 0.89, lthr * 0.93,  'Tempo',              '#eab308'));
    zones.push(mkZone(4, lthr * 0.93, lthr * 1.01,  'Lactate Threshold',  '#f97316'));
    zones.push(mkZone(5, lthr * 1.01, maxHr,         'VO2Max / Anaerobic', '#ef4444'));
  } else if (method === 'hrr') {
    zones.push(mkZone(1, restingHr + hrr * 0.50, restingHr + hrr * 0.60, 'Active Recovery',    '#6366f1'));
    zones.push(mkZone(2, restingHr + hrr * 0.60, restingHr + hrr * 0.70, 'Aerobic Endurance',  '#22c55e'));
    zones.push(mkZone(3, restingHr + hrr * 0.70, restingHr + hrr * 0.80, 'Tempo',              '#eab308'));
    zones.push(mkZone(4, restingHr + hrr * 0.80, restingHr + hrr * 0.90, 'Lactate Threshold',  '#f97316'));
    zones.push(mkZone(5, restingHr + hrr * 0.90, maxHr,                   'VO2Max / Anaerobic', '#ef4444'));
  } else {
    zones.push(mkZone(1, maxHr * 0.50, maxHr * 0.60, 'Active Recovery',    '#6366f1'));
    zones.push(mkZone(2, maxHr * 0.60, maxHr * 0.70, 'Aerobic Endurance',  '#22c55e'));
    zones.push(mkZone(3, maxHr * 0.70, maxHr * 0.80, 'Tempo',              '#eab308'));
    zones.push(mkZone(4, maxHr * 0.80, maxHr * 0.90, 'Lactate Threshold',  '#f97316'));
    zones.push(mkZone(5, maxHr * 0.90, maxHr,         'VO2Max / Anaerobic', '#ef4444'));
  }
  return zones;
}

export function computeZoneDistribution(activities: ActivityData[], zones: ReturnType<typeof computeZones>) {
  if (!zones || zones.length === 0) return [];
  const zoneSeconds = [0, 0, 0, 0, 0];
  
  activities.forEach(act => {
    // 1. Try stream data first for highest accuracy (second by second)
    let parsedStreams = act.streams;
    if (typeof parsedStreams === 'string') {
      try { parsedStreams = JSON.parse(parsedStreams); } catch (e) { parsedStreams = null; }
    }

    if (parsedStreams?.heartrate?.data && parsedStreams?.time?.data) {
      const hrData: number[] = parsedStreams.heartrate.data;
      const timeData: number[] = parsedStreams.time.data;
      
      for (let j = 1; j < hrData.length; j++) {
        const hr = hrData[j];
        // Limit time diff to max 5 seconds to prevent paused time from distorting the distribution
        const timeDiff = Math.min(timeData[j] - timeData[j - 1], 5); 
        
        let zoneIdx = 0;
        for (let i = zones.length - 1; i >= 0; i--) { if (hr >= zones[i].min) { zoneIdx = i; break; } }
        zoneSeconds[zoneIdx] += timeDiff;
      }
      return; // Move to next activity
    }

    // 2. Fallback to splits for kilometer-by-kilometer accuracy
    let parsedSplits = act.splits;
    if (typeof parsedSplits === 'string') {
      try { parsedSplits = JSON.parse(parsedSplits); } catch (e) { parsedSplits = null; }
    }

    if (Array.isArray(parsedSplits) && parsedSplits.length > 0) {
      parsedSplits.forEach((s: any) => {
        if (s.average_heartrate && s.moving_time) {
          const hr = s.average_heartrate;
          const duration = s.moving_time;
          let zoneIdx = 0;
          for (let i = zones.length - 1; i >= 0; i--) { if (hr >= zones[i].min) { zoneIdx = i; break; } }
          zoneSeconds[zoneIdx] += duration;
        }
      });
      return; // Move to next activity
    }

    // 3. Absolute fallback: use the overall activity average (least accurate, masks intervals)
    if (!act.average_heartrate) return;
    const hr = act.average_heartrate;
    const duration = act.moving_time || 0;
    let zoneIdx = 0;
    for (let i = zones.length - 1; i >= 0; i--) { if (hr >= zones[i].min) { zoneIdx = i; break; } }
    zoneSeconds[zoneIdx] += duration;
  });

  const totalSeconds = zoneSeconds.reduce((a, b) => a + b, 0) || 1;
  return zones.map((z, i) => ({
    zone: z.zone, label: z.label, color: z.color,
    min: z.min, max: z.max,
    seconds: Math.round(zoneSeconds[i]), percentage: Math.round((zoneSeconds[i] / totalSeconds) * 100)
  }));
}

export function estimateVO2Max(activities: ActivityData[], maxHr: number = 190): number | null {
  const activitiesWithSpeed = activities.filter(a => a.average_speed && a.moving_time > 1200);
  if (activitiesWithSpeed.length === 0) return null;
  
  const estimates = activitiesWithSpeed.map(a => {
    const speed_m_min = (a.distance / (a.moving_time / 60));
    const vo2_at_speed = (speed_m_min * 0.2) + 3.5;
    
    if (a.average_heartrate && maxHr > 0) {
      const hrIntensity = a.average_heartrate / maxHr;
      if (hrIntensity > 0.6) {
        return vo2_at_speed / hrIntensity;
      }
    }
    return vo2_at_speed;
  });
  return Math.round(Math.max(...estimates));
}

export function calculateReadiness(allActivities: ActivityData[]) {
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

  const ctlConst = Math.exp(-1 / 42);
  const atlConst = Math.exp(-1 / 7);
  let ctl = 0, atl = 0;
  
  const dailyLoad = new Map<string, number>();
  const dailyActivities = new Map<string, Array<{ name: string; distance: number; load: number }>>();

  allActivities.forEach(act => {
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
      const km = act.distance / 1000;
      load = km * 6;
    }
    
    dailyLoad.set(day, (dailyLoad.get(day) || 0) + load);

    // Collect activity data for tooltips
    const dayActs = dailyActivities.get(day) || [];
    dayActs.push({
      name: (act as any).name || 'Run',
      distance: act.distance,
      load: Math.round(load)
    });
    dailyActivities.set(day, dayActs);
  });

  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  let startDate = new Date(today); 
  startDate.setDate(startDate.getDate() - 90);
  
  if (allActivities.length > 0) {
    const earliest = parseLocalDate(allActivities[0].start_date);
    earliest.setHours(0, 0, 0, 0);
    if (earliest < startDate) startDate = earliest;
  }
  const cursor = new Date(startDate);
  
  const readinessSeries: Array<{ date: string; fitness: number; fatigue: number; form: number; activities?: any[] }> = [];
  const seriesStartDate = new Date(today);
  seriesStartDate.setDate(seriesStartDate.getDate() - 30);

  while (cursor <= today) {
    const ds = formatLocalDate(cursor);
    const load = dailyLoad.get(ds) || 0;
    ctl = ctl * ctlConst + load * (1 - ctlConst);
    atl = atl * atlConst + load * (1 - atlConst);
    
    if (cursor >= seriesStartDate) {
      readinessSeries.push({
        date: ds,
        fitness: Math.round(ctl),
        fatigue: Math.round(atl),
        form: Math.round(ctl - atl),
        activities: dailyActivities.get(ds) || []
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  
  return {
    fitness: Math.round(ctl),
    fatigue: Math.round(atl),
    form: Math.round(ctl - atl),
    series: readinessSeries
  };
}

export function predictRaceTimes(vo2max: number | null) {
  if (!vo2max) return [];
  const vVO2max = (vo2max - 3.5) / 0.2; 
  const speeds = {
    '5K': vVO2max * 0.93,
    '10K': vVO2max * 0.89,
    'Half Marathon': vVO2max * 0.84,
    'Marathon': vVO2max * 0.79
  };
  
  return [
    { name: '5K', distance: 5000, time: Math.round((5000 / speeds['5K']) * 60) },
    { name: '10K', distance: 10000, time: Math.round((10000 / speeds['10K']) * 60) },
    { name: 'Half Marathon', distance: 21097, time: Math.round((21097 / speeds['Half Marathon']) * 60) },
    { name: 'Marathon', distance: 42195, time: Math.round((42195 / speeds['Marathon']) * 60) }
  ];
}

export function calculateBiomechanicalTrend(activities: ActivityData[]) {
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

  const trend: Array<{ week: string; cadence: number; stride: number }> = [];
  const today = new Date();
  const twelveWeeksAgo = new Date(today);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  const recentActs = activities.filter(a => parseLocalDate(a.start_date) >= twelveWeeksAgo && a.cadence && a.average_speed);
  
  const weeklyMech = new Map<string, { totalCadence: number, totalStride: number, count: number }>();
  recentActs.forEach(act => {
    const d = parseLocalDate(act.start_date);
    const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
    const monday = formatLocalDate(new Date(d.setDate(diff)));
    
    const stride = act.average_speed! / (act.cadence! / 60);
    const entry = weeklyMech.get(monday) || { totalCadence: 0, totalStride: 0, count: 0 };
    entry.totalCadence += act.cadence!;
    entry.totalStride += stride;
    entry.count += 1;
    weeklyMech.set(monday, entry);
  });

  const sortedWeeks = Array.from(weeklyMech.keys()).sort();
  sortedWeeks.forEach(week => {
    const data = weeklyMech.get(week)!;
    trend.push({
      week,
      cadence: Math.round(data.totalCadence / data.count),
      stride: Number((data.totalStride / data.count).toFixed(2))
    });
  });
  return trend;
}

export function calculateAerobicDecoupling(splitsAny: any) {
  let splits = splitsAny;
  if (typeof splits === 'string') {
    try { splits = JSON.parse(splits); } catch (e) { splits = []; }
  }
  if (!Array.isArray(splits) || splits.length < 4) return null;

  const validSplits = splits.slice(1).filter((s: any) => s.distance >= 900 && s.average_heartrate && s.average_speed);
  
  let firstHalfHr = 0, firstHalfSpeed = 0, firstHalfCount = 0;
  let secondHalfHr = 0, secondHalfSpeed = 0, secondHalfCount = 0;
  
  if (validSplits.length >= 2) {
    const midPoint = Math.floor(validSplits.length / 2);
    for (let i = 0; i < validSplits.length; i++) {
      const s = validSplits[i];
      if (i < midPoint) {
        firstHalfHr += s.average_heartrate;
        firstHalfSpeed += s.average_speed;
        firstHalfCount++;
      } else {
        secondHalfHr += s.average_heartrate;
        secondHalfSpeed += s.average_speed;
        secondHalfCount++;
      }
    }
  }

  if (firstHalfCount > 0 && secondHalfCount > 0) {
    const hrPace1 = (firstHalfHr / firstHalfCount) / (firstHalfSpeed / firstHalfCount);
    const hrPace2 = (secondHalfHr / secondHalfCount) / (secondHalfSpeed / secondHalfCount);
    const drift = ((hrPace2 - hrPace1) / hrPace1) * 100;
    
    // Create chart data series mapping splits to their HR and Pace
    const splitsData = splits.map((s: any, idx: number) => {
      let pace = 0;
      if (s.average_speed) {
        pace = 1000 / s.average_speed / 60; // pace in decimal minutes per km
      }
      return {
        split: idx + 1,
        hr: s.average_heartrate ? Math.round(s.average_heartrate) : 0,
        pace: Number(pace.toFixed(2)),
        distance: s.distance
      };
    }).filter((s: any) => s.hr > 0 && s.pace > 0);

    return {
      hasBase: drift <= 5,
      driftPercentage: Number(drift.toFixed(1)),
      splitsData
    };
  }
  return null;
}
