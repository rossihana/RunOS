import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Enkripsi simetris untuk data sensitif di DB (API key provider, kredensial Garmin user).
 * AES-256-GCM, key dari ENCRYPTION_KEY (64 hex = 32 byte). Format tersimpan:
 *   v1:<iv-hex>:<tag-hex>:<cipher-hex>
 * GCM memberi integrity — ciphertext yang diubah akan gagal decrypt.
 */
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  if (!env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY belum diset — tidak bisa enkripsi/dekripsi');
  const k = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY harus 64 karakter hex (32 byte)');
  return k;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const [v, ivHex, tagHex, dataHex] = stored.split(':');
  if (v !== 'v1' || !ivHex || !tagHex || !dataHex) throw new Error('Format enkripsi tidak dikenal');
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/** Utility: hanya terapkan kalau belum terenkripsi (migrasi data lama). */
export function encryptIfPlain(value: string): string {
  return value.startsWith('v1:') ? value : encrypt(value);
}
