// Email via Resend HTTP API — zero dependency (fetch bawaan Node 22).
// Kalau RESEND_API_KEY tak diset: kirim email dilewati (mode personal tanpa email).
import { env } from '../config/env.js';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

/** Kirim email lewat Resend. Return true jika terkirim; false jika email infra belum diset. */
export async function sendMail({ to, subject, html }: MailInput): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to,
        subject,
        html,
      }),
    });
    if (!r.ok) {
      console.error(`[mail] Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[mail] send failed:', (e as Error).message);
    return false;
  }
}
