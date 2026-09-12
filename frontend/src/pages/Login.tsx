import { useState, useRef, useEffect } from 'react';
import { Activity, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

// Ditambahkan ke index.html <head> oleh index.html transform (lihat vite config) —
// fallback baca langsung agar field kode undangan hanya muncul kalau server memang menuntut.
declare global {
  interface Window { __RUNOS_INVITE_REQUIRED__?: boolean }
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [needInvite, setNeedInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // Invite field hanya muncul kalau server memang menuntut (endpoint publik /auth/config)
  const [envInviteRequired, setEnvInviteRequired] = useState(false);

  useEffect(() => {
    api.get('/auth/config')
      .then(r => setEnvInviteRequired(!!r.data.inviteRequired))
      .catch(() => setEnvInviteRequired(false));
  }, []);

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
      // Opsi 2: setelah daftar → onboarding Garmin (bukan dashboard kosong)
      if (mode === 'register') {
        localStorage.setItem('runos_just_registered', '1');
        window.location.href = '/garmin';
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      const serverMsg = err.response?.data?.error || 'Terjadi kesalahan. Coba lagi.';
      // Server menuntut kode undangan -> tampilkan field (sekali, lalu persist di mode register)
      if (mode === 'register' && (serverMsg.includes('undangan') || err.response?.status === 403)) {
        setNeedInvite(true);
        setEnvInviteRequired(true);
      }
      setError(serverMsg);
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setLoading(true);
    try {
      if (forgotStep === 'email') {
        const r = await api.post('/auth/forgot-password', { email: forgotEmail });
        setForgotToken(r.data.resetToken);
        setForgotStep('reset');
        setError('');
      } else {
        await api.post('/auth/reset-password', { token: forgotToken, password: newPassword });
        alert('Password berhasil direset! Silakan login dengan password baru.');
        setShowForgot(false);
        setForgotStep('email');
        setForgotEmail(''); setForgotToken(''); setNewPassword('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal memproses reset password');
    } finally {
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
          {showForgot ? (
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleForgot(); }}>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white text-center">Reset Password</h3>
              {forgotStep === 'email' ? (
                <>
                  <p className="text-xs text-zinc-500 text-center">Masukkan email akunmu. Token reset akan diberikan oleh admin aplikasi (personal deployment).</p>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Email akun RunOS"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 text-center">Token didapat ✅ (tersalin otomatis). Sekarang buat password baru.</p>
                  <input
                    type="text"
                    value={forgotToken}
                    onChange={(e) => setForgotToken(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-4 py-3 text-xs"
                    readOnly
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password baru (min. 8 karakter)"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </>
              )}
              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
              )}
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-zinc-900 dark:bg-white dark:text-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50">
                {loading ? 'Memproses...' : forgotStep === 'email' ? 'Minta Token Reset' : 'Simpan Password Baru'}
              </button>
              <button type="button" onClick={() => { setShowForgot(false); setError(''); }} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                Kembali ke login
              </button>
            </form>
          ) : (
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
            {mode === 'register' && envInviteRequired && (
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
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimal 8 karakter' : '••••••••'}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
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

            {mode === 'login' && (
              <button type="button" onClick={() => { setShowForgot(true); setError(''); }} className="w-full text-center text-xs text-zinc-500 hover:text-orange-500 transition-colors">
                Lupa password?
              </button>
            )}
          </form>
          )}

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
