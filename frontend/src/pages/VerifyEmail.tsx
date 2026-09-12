import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

/** Halaman tujuan link verifikasi email: /verify-email?token=... */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('error'); setMsg('Token tidak ditemukan di link.'); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(r => { setState('ok'); setMsg(r.data.message); })
      .catch(e => { setState('error'); setMsg(e?.response?.data?.error || 'Verifikasi gagal.'); });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">{state === 'ok' ? '✅' : state === 'error' ? '⚠️' : '⏳'}</div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-white mb-2">
          {state === 'ok' ? 'Email terverifikasi!' : state === 'error' ? 'Verifikasi gagal' : 'Memverifikasi…'}
        </h1>
        <p className="text-sm text-zinc-500 mb-6">{msg}</p>
        <Link to="/" className="inline-block px-6 py-3 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700">
          Ke RunOS
        </Link>
      </div>
    </div>
  );
}
