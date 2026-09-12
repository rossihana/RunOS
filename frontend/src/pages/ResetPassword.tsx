import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

/** Halaman tujuan link reset password dari email: /reset-password?token=... */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const token = params.get('token');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setMsg('Password berhasil diganti! Mengalihkan ke login…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Reset gagal. Token mungkin kedaluwarsa.');
    } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Link tidak valid</h1>
          <p className="text-sm text-zinc-500 mb-6">Token tidak ditemukan. Minta link reset baru dari halaman login.</p>
          <Link to="/login" className="text-sm font-bold text-orange-600 hover:underline">Kembali ke Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-10 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🔑</div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white">Password Baru</h1>
            <p className="text-xs text-zinc-500 mt-1">Set password baru untuk akun RunOS-mu.</p>
          </div>
          {msg ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400 text-center">{msg}</div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password baru (min. 8 karakter)"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 pr-12"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600">
                  {show ? '🙈' : '👁'}
                </button>
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              <button
                type="submit" disabled={busy || password.length < 8}
                className="w-full py-3 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-40"
              >
                {busy ? 'Menyimpan…' : 'Simpan Password Baru'}
              </button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">← Kembali ke login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
