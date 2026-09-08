import { useState, useEffect } from 'react';
import { Cpu, X, Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const AI_FEATURES: { key: string; label: string }[] = [
  { key: 'chat', label: 'AI Coach (chat)' },
  { key: 'dashboard', label: 'Dashboard Analysis' },
  { key: 'activity', label: 'Analisis Aktivitas' },
  { key: 'prediction', label: 'Race Prediction' },
  { key: 'plan', label: 'Training Plan' },
  { key: 'merge', label: 'Master Plan Merge' },
];

export default function AiSettings() {
  const [models, setModels] = useState<string[]>([]);
  const [customModels, setCustomModels] = useState<{ name: string; models: string[]; error?: string }[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [providers, setProviders] = useState<{ name: string; baseUrl: string }[]>([]);
  const [npName, setNpName] = useState('');
  const [npUrl, setNpUrl] = useState('');
  const [npKey, setNpKey] = useState('');
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([api.get('/ai/models'), api.get('/ai/settings')]);
        setModels(m.data.models || []);
        setCustomModels(m.data.custom || []);
        setDefaultModel(s.data.defaultModel || '');
        setFeatures(s.data.features || {});
        setProviders(s.data.providers || []);
      } catch (e) {
        console.error(e);
        setMsg('⚠️ Gagal memuat pengaturan');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allOptions = [
    ...models.map(m => ({ v: m, label: m })),
    ...customModels.flatMap(c => c.models.map(m => ({ v: `${c.name}:${m}`, label: `${c.name} / ${m}` }))),
  ];

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const r = await api.put('/ai/settings', {
        defaultModel: defaultModel || null,
        features: Object.fromEntries(Object.entries(features).filter(([, v]) => v)),
      });
      setFeatures(r.data.features || {});
      setMsg('✅ Tersimpan');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setMsg(`⚠️ ${e?.response?.data?.error || 'Gagal menyimpan'}`);
    } finally {
      setSaving(false);
    }
  };

  const addProvider = async () => {
    setMsg('');
    try {
      await api.put('/ai/providers', { name: npName, baseUrl: npUrl, apiKey: npKey });
      setProviders(prev => [...prev.filter(p => p.name !== npName), { name: npName, baseUrl: npUrl }]);
      setNpName(''); setNpUrl(''); setNpKey('');
      // Refresh katalog custom
      const m = await api.get('/ai/models');
      setCustomModels(m.data.custom || []);
      setMsg(`✅ Provider "${npName}" ditambahkan — modelnya sudah muncul di dropdown`);
    } catch (e: any) {
      setMsg(`⚠️ ${e?.response?.data?.error || 'Gagal menambah provider'}`);
    }
  };

  const testProvider = async (name: string) => {
    setTestResult(prev => ({ ...prev, [name]: '...' }));
    try {
      const r = await api.post(`/ai/providers/${name}/test`);
      setTestResult(prev => ({ ...prev, [name]: r.data.ok ? `✅ ${r.data.count} model` : `❌ ${r.data.error}` }));
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [name]: `❌ ${e?.message || 'gagal'}` }));
    }
  };

  const removeProvider = async (name: string) => {
    if (!confirm(`Hapus provider "${name}"? Model yang memakainya ikut di-reset.`)) return;
    await api.delete(`/ai/providers/${name}`);
    setProviders(prev => prev.filter(p => p.name !== name));
    const [m, s] = await Promise.all([api.get('/ai/models'), api.get('/ai/settings')]);
    setCustomModels(m.data.custom || []);
    setFeatures(s.data.features || {});
    if (defaultModel && defaultModel.startsWith(`${name}:`)) setDefaultModel('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-6 h-6 text-orange-500" /> Pengaturan AI
            </h1>
            <p className="text-sm text-zinc-500">Model per fitur + provider sendiri (OpenAI-compatible)</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Memuat…</div>
      ) : (
        <div className="space-y-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8">
          {/* Default model */}
          <section>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Model Default</h3>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 py-2.5 text-sm"
            >
              <option value="">— Pilih dari katalog 9router —</option>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-xs text-zinc-400 mt-1">Dipakai semua fitur yang tidak punya override. Kalau kamu memilih model secara eksplisit dan model itu gagal, akan muncul error — tidak ada penggantian model diam-diam.</p>
          </section>

          {/* Per feature */}
          <section>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Model per Fitur</h3>
            <div className="space-y-2">
              {AI_FEATURES.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="w-44 text-xs font-medium text-zinc-600 dark:text-zinc-300 shrink-0">{f.label}</label>
                  <select
                    value={features[f.key] || ''}
                    onChange={(e) => setFeatures(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-xs"
                  >
                    <option value="">Ikuti default</option>
                    {allOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>

          {/* Providers */}
          <section>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
              Provider Sendiri (BYOK)
            </h3>
            <p className="text-xs text-zinc-400 mb-3">Tambahkan provider OpenAI-compatible (OpenAI, Groq, OpenRouter, DeepSeek, Ollama lokal, dll). API key disimpan di server, tidak pernah dikirim balik ke browser.</p>
            <div className="space-y-2 mb-4">
              {providers.map(p => (
                <div key={p.name} className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{p.baseUrl}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500">{testResult[p.name] || ''}</span>
                  <button onClick={() => testProvider(p.name)} className="px-2 py-1 text-[10px] font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200">TEST</button>
                  <button onClick={() => removeProvider(p.name)} className="px-2 py-1 text-[10px] font-bold rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">HAPUS</button>
                </div>
              ))}
              {providers.length === 0 && <p className="text-xs text-zinc-400">Belum ada provider tambahan.</p>}
            </div>
            <div className="grid grid-cols-[1fr_2fr_2fr_auto] gap-2">
              <input value={npName} onChange={e => setNpName(e.target.value)} placeholder="nama" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-3 py-2 text-xs" />
              <input value={npUrl} onChange={e => setNpUrl(e.target.value)} placeholder="https://api.provider.com/v1" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-3 py-2 text-xs" />
              <input value={npKey} onChange={e => setNpKey(e.target.value)} placeholder="API key" type="password" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 px-3 py-2 text-xs" />
              <button onClick={addProvider} disabled={!npName || !npUrl || !npKey} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-40 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
            {customModels.some(c => c.error) && (
              <p className="text-[10px] text-amber-500 mt-2">
                Provider bermasalah: {customModels.filter(c => c.error).map(c => `${c.name} (${c.error})`).join(', ')}
              </p>
            )}
          </section>

          {/* Footer */}
          <div className="flex justify-end items-center gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {msg && <span className="text-xs text-zinc-500">{msg}</span>}
            <button onClick={save} disabled={saving} className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
