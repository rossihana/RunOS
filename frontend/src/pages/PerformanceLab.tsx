import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import HRConfigWizard from '../components/training/HRConfigWizard';
import HRZoneChart from '../components/charts/HRZoneChart';
import HealthTrendChart from '../components/charts/HealthTrendChart';
import CadenceCard from '../components/dashboard/CadenceCard';
import InsightPanel from '../components/dashboard/InsightPanel';
import RacePredictorCards from '../components/dashboard/RacePredictorCards';
import BiomechanicalTrendChart from '../components/charts/BiomechanicalTrendChart';
import ReadinessChart from '../components/charts/ReadinessChart';
import AerobicDecouplingChart from '../components/charts/AerobicDecouplingChart';
import { FlaskConical, Settings, RefreshCw, HeartPulse, Activity, Footprints } from 'lucide-react';

interface LabData {
  labConfig: any;
  zones: any[];
  zoneDistribution: any[];
  fitnessMetrics: { vo2max: number | null; fitness: number; fatigue: number; form: number };
  performanceMetrics: { avgCadence: number | null; totalActivities30d: number; totalKm30d: number };
  racePredictions?: any[];
  readinessSeries?: any[];
  biomechanicalTrend?: any[];
  hrDrift?: { hasBase: boolean; driftPercentage: number } | null;
  garminHealth?: { hrv: number | null; sleep: number | null; readiness: number | null; vo2max: number | null } | null;
  garminHealthSeries?: Array<{ date: string; hrv: number | null; sleep: number | null; vo2max: number | null; rhr: number | null }>;
  racePredictionsSource?: string;
  trainingReadiness?: { score: number; band: string; components: { key: string; label: string; value: number; weight: number }[]; source: string } | null;
}

export default function PerformanceLab() {
  const [labData, setLabData] = useState<LabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get('/activities/lab');
      setLabData(res.data);
      setShowSetup(!res.data.labConfig);
    } catch (err: any) {
      console.error('Failed to load lab data', err);
      setError(err?.response?.data?.error || 'Gagal memuat data lab. Coba refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Tombol Refresh = sync khusus data Lab (aktivitas 30hr + details → splits/decoupling
  // + health → HRV/sleep/VO2max/RHR/prediksi). Pola sama dengan tombol Sync Dashboard:
  // loading terus sampai sync SELESAI (polling 5 dtk), baru data lab dimuat ulang.
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      let usedPerUser = false;
      // S7: Garmin terhubung di akun → jalur per-user (JWT, tanpa secret)
      try {
        const st = await api.get('/activities/garmin/status');
        if (st.data?.connected) {
          await api.post('/activities/garmin/sync', { days: 30, details: true, health: true });
          usedPerUser = true;
        }
      } catch { /* fallback ke jalur owner */ }
      // Jalur owner (SYNC_SECRET)
      if (!usedPerUser) {
        let secret = localStorage.getItem('runos_sync_secret') || '';
        if (!secret) {
          secret = prompt('Masukkan Sync Secret (lihat backend/.env SYNC_SECRET):') || '';
          if (!secret) throw new Error('Sync dibatalkan — secret dibutuhkan');
          localStorage.setItem('runos_sync_secret', secret);
        }
        await api.post('/activities/sync', { days: 30, details: true, health: true }, { headers: { 'X-Sync-Secret': secret } });
      }

      // Polling status tiap 5 dtk sampai done/failed (maks 5 menit)
      let outcome: 'done' | 'failed' | 'timeout' = 'timeout';
      for (let polls = 0; polls < 60; polls++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const st = await api.get('/activities/garmin/status');
          const s = st.data?.status?.status;
          if (s === 'done') { outcome = 'done'; break; }
          if (s === 'failed') { outcome = 'failed'; toast.error(`Sync gagal: ${String(st.data?.status?.detail || '').slice(-160)}`); break; }
        } catch { /* status sesaat gagal → lanjut polling */ }
      }
      if (outcome === 'done') toast.success('✅ Sync Lab selesai — data dimuat ulang!');
      if (outcome === 'timeout') toast.error('Sync timeout — cek log sync (backend/tmp).');
      await fetchData(true); // muat ulang data lab (finally-nya mematikan refreshing)
    } catch (e: any) {
      setRefreshing(false);
      const msg = e?.response?.data?.error || e?.message || 'Sync gagal dimulai';
      if (String(msg).includes('secret')) localStorage.removeItem('runos_sync_secret');
      toast.error(msg);
    }
  }, [refreshing, fetchData]);

  const handleConfigSaved = () => {
    setShowSetup(false);
    fetchData(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 animate-pulse">Menghitung data lab kamu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="text-5xl">⚠️</div>
        <p className="text-zinc-300 font-bold">{error}</p>
        <button onClick={() => fetchData()} className="mt-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-all">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (showSetup) {
    return <HRConfigWizard onSaved={handleConfigSaved} />;
  }

  if (!labData) return null;

  const {
    fitnessMetrics, performanceMetrics, zoneDistribution, labConfig,
    racePredictions, readinessSeries, biomechanicalTrend, hrDrift, garminHealthSeries, racePredictionsSource, trainingReadiness
  } = labData;

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Performance Lab</h1>
            <p className="text-sm text-zinc-500">Data lari kamu, dijadikan insight yang berarti.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all text-sm font-medium"
          >
            <Settings className="w-4 h-4" /> HR Setup
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition-all text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Syncing…' : 'Sync & Refresh'}
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Lari (30hr)', value: `${performanceMetrics.totalActivities30d}x`, icon: Activity, color: 'text-blue-400' },
          { label: 'Total KM (30hr)', value: `${performanceMetrics.totalKm30d} km`, icon: Footprints, color: 'text-orange-400' },
          { label: 'Fitness (CTL)', value: `${fitnessMetrics.fitness}`, icon: HeartPulse, color: 'text-indigo-400' },
          { label: "Today's Form", value: `${fitnessMetrics.form > 0 ? '+' : ''}${fitnessMetrics.form}`, icon: FlaskConical, color: fitnessMetrics.form > 5 ? 'text-emerald-400' : fitnessMetrics.form < -15 ? 'text-rose-400' : 'text-yellow-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-black text-zinc-900 dark:text-white">{stat.value}</div>
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Garmin Health Trend (HRV / Sleep / VO2max dari sync --health, 30 hari) */}
      {garminHealthSeries && garminHealthSeries.length > 0 && (
        <HealthTrendChart data={garminHealthSeries} />
      )}

      {/* HR Config banner if no config */}
      {!labConfig && (
        <div className="p-5 mb-6 rounded-2xl border border-dashed border-orange-500/40 bg-orange-500/5 flex items-center gap-4">
          <HeartPulse className="w-8 h-8 text-orange-500 shrink-0" />
          <div>
            <div className="text-sm font-bold text-white mb-0.5">Setup HR Configuration dulu yuk!</div>
            <p className="text-xs text-zinc-400">Zona HR belum dikonfigurasi — beberapa metrik tidak bisa ditampilkan. Klik "HR Setup" di atas.</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Span full row: HR Zone Chart */}
        <div className="lg:col-span-2 xl:col-span-3">
          {zoneDistribution.length > 0 ? (
            <HRZoneChart data={zoneDistribution} />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
              <HeartPulse className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Distribusi zona HR tidak tersedia. Setup konfigurasi HR terlebih dahulu.</p>
            </div>
          )}
        </div>

        {/* Cadence */}
        <CadenceCard avgCadence={performanceMetrics.avgCadence} />

        {/* Feature 1: Race Predictor (sumber dicetak di kartu) */}
        {racePredictions && racePredictions.length > 0 && (
          <div className="lg:col-span-1 xl:col-span-1">
            <RacePredictorCards
              predictions={racePredictions}
              sourceLabel={racePredictionsSource === 'garmin' ? 'Prediksi resmi Garmin (sync harian)' : 'Estimasi berbasis VO2Max & VDOT (belum sync health)'}
            />
          </div>
        )}

        {/* Feature 2: Readiness — skor FirstBeat-style + chart TSB (boleh salah satu saja) */}
        {(readinessSeries && readinessSeries.length > 0) || trainingReadiness ? (
          <div className="lg:col-span-2 xl:col-span-3 min-w-0 flex flex-col">
            <ReadinessChart data={readinessSeries || []} readiness={trainingReadiness} />
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 lg:col-span-2 xl:col-span-3 min-w-0">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Fitness vs Fatigue</h3>
                <p className="text-[10px] text-zinc-500">Model TSB (Banister)</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Fitness (CTL)', value: fitnessMetrics.fitness, color: 'bg-indigo-500', max: 100 },
                { label: 'Fatigue (ATL)', value: fitnessMetrics.fatigue, color: 'bg-orange-500', max: 100 },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400 font-medium">{m.label}</span>
                    <span className="font-black text-white">{m.value}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${m.color}`} style={{ width: `${Math.min((m.value / m.max) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-zinc-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Form (TSB)</span>
                  <span className={`text-lg font-black ${fitnessMetrics.form > 5 ? 'text-emerald-400' : fitnessMetrics.form < -15 ? 'text-rose-400' : 'text-yellow-400'}`}>
                    {fitnessMetrics.form > 0 ? '+' : ''}{fitnessMetrics.form}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature 4: HR Drift / Aerobic Decoupling Chart */}
        {hrDrift && (
          <div className="lg:col-span-2 xl:col-span-3 min-w-0 flex flex-col">
             <AerobicDecouplingChart data={hrDrift as any} />
          </div>
        )}

        {/* Feature 3: Biomechanical Trend Chart (Now spans full row for maximum chart readability) */}
        {biomechanicalTrend && biomechanicalTrend.length > 0 && (
          <div className="lg:col-span-2 xl:col-span-3 min-w-0 flex flex-col">
            <BiomechanicalTrendChart data={biomechanicalTrend} />
          </div>
        )}

        {/* Insight Panel — full width */}
        <div className="lg:col-span-2 xl:col-span-3">
          <InsightPanel
            fitnessMetrics={fitnessMetrics}
            performanceMetrics={performanceMetrics}
            zoneDistribution={zoneDistribution}
          />
        </div>
      </div>
    </div>
  );
}
