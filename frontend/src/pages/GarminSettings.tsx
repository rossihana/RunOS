import { useState, useEffect } from 'react';
import { ArrowLeft, Watch, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function GarminSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [gEmail, setGEmail] = useState('');
  const [gPass, setGPass] = useState('');
  const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState('');

  const loadStatus = async () => {
    try {
      const s = await api.get('/activities/garmin/status');
      setConnected(!!s.data.connected);
      if (s.data.status?.detail) setLastSync(String(s.data.status.detail).slice(0, 200));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const connect = async () => {
    setBusy('connect'); setMsg('');
    try {
      await api.post('/activities/garmin/connect', { email: gEmail, password: gPass });
      setConnected(true);
      setGEmail(''); setGPass('');
      setMsg('✅ Garmin terhubung! Sync harian otomatis aktif (tiap pagi 07:00).');
    } catch (e: any) {
      setMsg(`⚠️ ${e?.response?.data?.error || 'Gagal menghubungkan'}`);
    } finally { setBusy(null); }
  };

  const syncNow = async () => {
    setBusy('sync'); setMsg('⏳ Sync dimulai — menarik data dari Garmin...');
    try {
      const r = await api.post('/activities/garmin/sync', { days: 14, details: true });
      setMsg(`⏳ ${r.data.message || 'Sync berjalan'} — data muncul dalam 1-2 menit.`);
      setTimeout(() => { setMsg('✅ Sync selesai — refresh Dashboard untuk melihat data baru.'); setBusy(null); loadStatus(); }, 75_000);
    } catch (e: any) {
      setMsg(`⚠️ ${e?.response?.data?.error || 'Sync gagal'}`);
      setBusy(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Watch className="w-6 h-6 text-orange-500" /> Garmin Connection
          </h1>
          <p className="text-sm text-zinc-500">Hubungkan akun Garmin-mu untuk sinkronisasi data lari otomatis</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Memuat…</div>
      ) : (
        <div className="space-y-6">
          {/* Status card */}
          <div className={`rounded-3xl border p-6 transition-colors ${
            connected
              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
          }`}>
            {connected === true && (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Garmin terhubung</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">Sync otomatis harian aktif (tiap pagi 07:00). Data lari barumu masuk sendiri.</p>
                  <button
                    onClick={syncNow}
                    disabled={busy !== null}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${busy === 'sync' ? 'animate-spin' : ''}`} />
                    {busy === 'sync' ? 'Syncing…' : 'Sync Sekarang'}
                  </button>
                </div>
              </div>
            )}
            {connected === false && (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Activity className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Belum terhubung</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">Hubungkan untuk menarik seluruh riwayat lari dari Garmin Connect-mu.</p>
                </div>
              </div>
            )}
          </div>

          {/* Connect form (hanya saat belum terhubung) */}
          {connected === false && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Kredensial Garmin</h3>
              <p className="text-xs text-zinc-400 -mt-2">
                Sama dengan yang kamu pakai login di aplikasi Garmin Connect. Password disimpan <span className="font-semibold text-zinc-500">terenkripsi</span> di server dan tidak pernah dikirim balik.
              </p>
              <input
                type="email" value={gEmail} onChange={e => setGEmail(e.target.value)}
                placeholder="Email Garmin"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              <input
                type="password" value={gPass} onChange={e => setGPass(e.target.value)}
                placeholder="Password Garmin"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              <button
                onClick={connect}
                disabled={busy !== null || !gEmail || !gPass}
                className="w-full py-3 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-40 transition-colors"
              >
                {busy === 'connect' ? 'Menghubungkan…' : 'Hubungkan Garmin'}
              </button>
              <p className="text-[10px] text-zinc-400 text-center">Data sync pertama bisa memakan 1–3 menit untuk seluruh riwayat.</p>
            </div>
          )}

          {/* Sync now (saat terhubung) + last sync info */}
          {connected && lastSync && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Sync terakhir</p>
              <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap">{lastSync}</pre>
            </div>
          )}

          {msg && (
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">{msg}</div>
          )}
        </div>
      )}
    </div>
  );
}
