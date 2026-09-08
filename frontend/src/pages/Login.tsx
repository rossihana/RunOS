import { useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [needInvite, setNeedInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post(`/auth/${mode}`, {
        email,
        password,
        ...(mode === 'register' ? { name, inviteCode: inviteCode || undefined } : {}),
      });
      localStorage.setItem('token', response.data.token);
      window.location.href = '/';
    } catch (err: any) {
      const serverMsg = err.response?.data?.error || 'Terjadi kesalahan. Coba lagi.';
      // Server menuntut kode undangan -> tampilkan field (sekali, lalu persist di mode register)
      if (mode === 'register' && (serverMsg.includes('undangan') || err.response?.status === 403)) {
        setNeedInvite(true);
      }
      setError(serverMsg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-zinc-900 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-sm">
            <Activity className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Welcome to RunOS
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Your AI-powered running training dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-zinc-200 dark:border-zinc-800 transition-colors">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nama
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama kamu"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>
            )}
            {mode === 'register' && needInvite && (
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Kode Undangan
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Kode dari pemilik aplikasi"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimal 8 karakter' : '••••••••'}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center items-center rounded-xl bg-zinc-900 dark:bg-white dark:text-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Masuk' : 'Daftar'}
            </button>

            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {mode === 'login' ? (
                <>
                  Belum punya akun?{' '}
                  <button type="button" onClick={() => { setMode('register'); setError(''); }} className="font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    Daftar
                  </button>
                </>
              ) : (
                <>
                  Sudah punya akun?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(''); }} className="font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    Masuk
                  </button>
                </>
              )}
            </div>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500 dark:text-zinc-400">Garmin Sync</span>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <p>Data aktivitas lari disinkronkan otomatis dari Garmin Connect.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
