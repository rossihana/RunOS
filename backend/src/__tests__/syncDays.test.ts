import { test } from 'node:test';
import assert from 'node:assert';
import { clampDays } from '../services/garminPerUser.js';

// K1: clamp days di dua lapis — cek nilai batas & input busuk dari klien.
test('clampDays membatasi hari ke rentang [1, 365]', () => {
  assert.strictEqual(clampDays(undefined), undefined);
  assert.strictEqual(clampDays(NaN), undefined);
  assert.strictEqual(clampDays(Infinity), undefined);
  assert.strictEqual(clampDays(-5), 1);        // negatif -> 1
  assert.strictEqual(clampDays(0), 1);
  assert.strictEqual(clampDays(999999), 365);  // DoS via range besar -> 365
  assert.strictEqual(clampDays(1.7), 1);       // fractional -> floor
  assert.strictEqual(clampDays(30), 30);       // normal tetap normal
  assert.strictEqual(clampDays('45' as any), 45);
});
