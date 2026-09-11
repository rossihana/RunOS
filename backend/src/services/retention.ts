/**
 * Retensi data: hapus chat lebih tua dari N hari (default 30).
 * Dipanggil oleh backend saat startup + bisa oleh cron harian.
 * ponytail: cleanup pasif (saat boot + endpoint internal cron); kalau data
 * tumbuh besar, pindahkan ke worker harian.
 */
import { query } from '../db.js';

export async function purgeOldChats(days = 30): Promise<number> {
  const r = await query(
    `DELETE FROM ai_chat_messages WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(days)]
  );
  if (r.rowCount) console.log(`[retention] ${r.rowCount} pesan chat >${days} hari dihapus`);
  return r.rowCount || 0;
}
