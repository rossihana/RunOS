import { test } from 'node:test';
import assert from 'node:assert';
import { computeZones, estimateVO2Max, predictRaceTimes, calculateReadiness } from '../services/analytics.js';
import { featureModel, extractJson } from '../services/ai.js';

// ── computeZones: HRR method ──
test('computeZones HRR menghasilkan 5 zona naik', () => {
  const zones = computeZones({ method: 'hrr', maxHr: 190, restingHr: 60, lthr: 168, age: null, updatedAt: '' });
  assert.strictEqual(zones.length, 5);
  const mins = zones.map((z: any) => z.min ?? z.from ?? z.lower);
  for (let i = 1; i < mins.length; i++) assert.ok(mins[i] > mins[i - 1], 'zona harus naik');
});

test('computeZones tanpa config tidak crash', () => {
  const zones = computeZones({} as any);
  assert.ok(Array.isArray(zones));
});

// ── estimateVO2Max ──
test('estimateVO2Max dari aktivitas masuk akal (30-70)', () => {
  const acts = [{
    start_date: new Date().toISOString(),
    distance: 10000,
    moving_time: 3000,        // 5:00/km
    average_speed: 10000 / 3000,  // 3.33 m/s
    average_heartrate: 165,
  }];
  const v = estimateVO2Max(acts as any, 190);
  assert.ok(typeof v === 'number' && v > 30 && v < 70, `vo2max=${v}`);
});

test('estimateVO2Max tanpa data → null/0 tanpa crash', () => {
  const v = estimateVO2Max([], 190);
  assert.ok(v === null || v === 0 || typeof v === 'number');
});

// ── predictRaceTimes ──
test('predictRaceTimes monotonic: makin jauh makin lama', () => {
  const p = predictRaceTimes(50) as any;
  assert.ok(p);
  const secs = (s: string) => {
    const [h, m, rest] = s.split(':').map(Number);
    return h * 3600 + m * 60 + (rest || 0);
  };
  const keys = Object.keys(p);
  assert.ok(keys.length >= 3, 'minimal prediksi 3 jarak');
  const values = keys.map(k => secs(String(p[k]))).filter(x => x > 0);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] >= values[i - 1], `${keys[i]} harus >= ${keys[i - 1]}`);
  }
});

// ── calculateReadiness: form terpengaruh latihan berat kemarin ──
test('calculateReadiness: banyak latihan → form turun', () => {
  const now = Date.now();
  const mk = (daysAgo: number, mins: number, hr: number) => ({
    start_date: new Date(now - daysAgo * 86400_000).toISOString(),
    moving_time: mins * 60,
    average_heartrate: hr,
    distance: mins * 200,
  });
  const fresh = calculateReadiness([mk(40, 60, 140)] as any);
  const tired = calculateReadiness([mk(40, 60, 140), mk(1, 90, 175), mk(2, 90, 175)] as any);
  assert.ok((fresh.form ?? 0) > (tired.form ?? 0), 'form setelah latihan berat harus lebih rendah');
});

// ── S4: fallback load tanpa HR memakai pace aktual ──
import { calculateReadiness as cr } from '../services/analytics.js';

test('S4: run lambat tanpa HR memberi load lebih kecil dari run cepat tanpa HR', () => {
  const now = Date.now();
  const mk = (daysAgo: number, dist: number, time: number) => ({
    start_date: new Date(now - daysAgo * 86400_000).toISOString(),
    distance: dist,
    moving_time: time,
    average_heartrate: null,
    average_speed: dist / time,
  });
  // 10 km jalan santai 90 menit (6:45/km) vs 10 km cepat 50 menit (5:00/km)
  const slow = cr([mk(40, 60_000, 5400)] as any);
  const fast = cr([mk(40, 10_000, 3000)] as any);
  // load harian fast harus lebih besar → form turun lebih dalam
  assert.ok((fast.form ?? 0) < (slow.form ?? 0), `fast=${fast.form} harus < slow=${slow.form}`);
});

test('featureModel: user pilih eksplisit → strict (allowFallback false)', () => {
  const r = featureModel('chat', { features: { chat: 'ds/deepseek-v4' } });
  assert.strictEqual(r.model, 'ds/deepseek-v4');
  assert.strictEqual(r.settings.allowFallback, false);
});

test('featureModel: tanpa pilihan → default + fallback boleh', () => {
  const r = featureModel('chat', {});
  assert.strictEqual(r.settings.allowFallback, true);
  assert.ok(r.model.length > 0);
});

test('featureModel: defaultModel dihormati untuk fitur lain', () => {
  const r = featureModel('prediction', { defaultModel: 'selftest:my-model' });
  assert.strictEqual(r.model, 'selftest:my-model');
  assert.strictEqual(r.settings.allowFallback, false);
});

// ── extractJson: postamble & fence upstream (regresi "→ skipped") ──
test('extractJson: JSON murni', () => {
  assert.deepStrictEqual(JSON.parse(extractJson('{"a":1}')), { a: 1 });
});

test('extractJson: fence + postamble dibuang', () => {
  const raw = '```json\n{"a": {"b": "teks } aneh"}}\n```\n→ skipped: formatting\n';
  assert.deepStrictEqual(JSON.parse(extractJson(raw)), { a: { b: 'teks } aneh' } });
});

test('extractJson: brace dalam string tidak mengecoh', () => {
  const raw = '{"s":"kalau } atau { dalam string","n":5}\n→ skipped: x\nadd when: y';
  const j = JSON.parse(extractJson(raw));
  assert.strictEqual(j.n, 5);
  assert.strictEqual(j.s, 'kalau } atau { dalam string');
});

test('extractJson: escape sequence dalam string', () => {
  const raw = '{"s":"baris\\n\\"kutip\\""} trailing';
  const j = JSON.parse(extractJson(raw));
  assert.strictEqual(j.s, 'baris\n"kutip"');
});
