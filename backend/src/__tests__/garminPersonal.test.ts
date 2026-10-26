// Kontrak Fase 2 migrasi Garmin Personal API (docs/plans/garmin-personal-api-migration.md)
// Tanpa jaringan/DB: fokus helper murni + enkripsi. Jalankan: npm test (terkumpul oleh tsx --test)
import { test } from 'node:test';
import assert from 'node:assert';

// env untuk crypto (ENCRYPTION_KEY 64 hex dummy — hanya test)
process.env.ENCRYPTION_KEY ||= 'a'.repeat(64);

import { encrypt, decrypt } from '../services/crypto.js';
import { validateApiKeyInput, keyExpired, connectionType } from '../services/garminPerUser.js';

test('① key tersimpan = ciphertext (format v1, bukan plaintext)', () => {
  const key = 'garmin-personal-api-key-rahasia-123456';
  const enc = encrypt(key);
  assert.match(enc, /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  assert.ok(!enc.includes(key), 'plaintext tidak boleh muncul di ciphertext');
  assert.strictEqual(decrypt(enc), key); // round-trip
});

test('② validateApiKeyInput: tolak pend/kosong/bukan-string, terima panjang wajar', () => {
  assert.ok(validateApiKeyInput('short'));
  assert.ok(validateApiKeyInput(undefined));
  assert.ok(validateApiKeyInput(123 as unknown));
  assert.strictEqual(validateApiKeyInput('  x'.repeat(8).trim()), null); // valid setelah trim
  assert.strictEqual(validateApiKeyInput('g'.repeat(200)), null);
});

test('③ keyExpired: null → false; lampau → true; depan → false; tanggal invalid → false', () => {
  assert.strictEqual(keyExpired(null), false);
  assert.strictEqual(keyExpired('2020-01-01'), true);
  assert.strictEqual(keyExpired('2099-01-01'), false);
  assert.strictEqual(keyExpired('bukan-tanggal'), false);
  assert.strictEqual(keyExpired('2099-01-01', new Date('2099-06-01')), true); // injectable clock
});

test('④ respons status TIDAK memuat key: connectionType hanya mengembalikan tipe', () => {
  assert.strictEqual(connectionType(true, true), 'personal');
  assert.strictEqual(connectionType(false, true), 'legacy');
  assert.strictEqual(connectionType(false, false), null);
  // guard: fungsi tidak menerima nilai key sama sekali (signature: boolean, boolean)
});

test('⑤ idempotensi kolom: ensurePaColumns memakai ADD COLUMN IF NOT EXISTS', async () => {
  // verifikasi statis terhadap sumber (tanpa DB): pola idempoten wajib
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const src = readFileSync(join(dirname(__filename), '..', 'services', 'garminPerUser.ts'), 'utf-8');
  assert.match(src, /ADD COLUMN IF NOT EXISTS garmin_api_key_enc/);
  assert.match(src, /ADD COLUMN IF NOT EXISTS garmin_api_key_expires_at/);
});
