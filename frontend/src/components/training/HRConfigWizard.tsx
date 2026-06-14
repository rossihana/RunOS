import { useState } from 'react';
import api from '../../services/api';
import { Heart, Zap, Activity, ChevronRight, CheckCircle2, Save } from 'lucide-react';

interface Zone { zone: number; label: string; min: number; max: number; color: string; }

interface Props {
  onSaved: () => void;
}

const METHODS = [
  { id: 'hrmax', icon: Heart, title: 'HR Max', subtitle: 'Paling sederhana', desc: 'Gunakan batas detak jantung maksimalmu atau hitung otomatis dari usia.', color: 'border-indigo-500 bg-indigo-500/10' },
  { id: 'hrr', icon: Activity, title: 'HRR (Karvonen)', subtitle: 'Direkomendasikan', desc: 'Lebih akurat — memperhitungkan detak jantung istirahat untuk zona personal.', color: 'border-orange-500 bg-orange-500/10' },
  { id: 'lthr', icon: Zap, title: 'LTHR', subtitle: 'Tingkat Lanjut', desc: 'Gunakan Lactate Threshold Heart Rate dari tes lapangan untuk zona yang paling tepat.', color: 'border-rose-500 bg-rose-500/10' },
];

export default function HRConfigWizard({ onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<'hrmax' | 'hrr' | 'lthr'>('hrr');
  const [age, setAge] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [lthr, setLthr] = useState('');
  const [preview, setPreview] = useState<Zone[]>([]);
  const [saving, setSaving] = useState(false);

  const autoMaxHr = age ? 220 - parseInt(age) : null;
  const effectiveMaxHr = maxHr ? parseInt(maxHr) : autoMaxHr || 190;

  const handleNext = async () => {
    if (step === 2) {
      // Fetch preview
      try {
        const res = await api.post('/activities/lab/config', {
          method, maxHr: effectiveMaxHr || 190,
          restingHr: restingHr ? parseInt(restingHr) : 60,
          lthr: lthr ? parseInt(lthr) : Math.round(effectiveMaxHr * 0.88),
          age: age ? parseInt(age) : null,
          preview: true
        });
        setPreview(res.data.zones);
        setStep(3);
      } catch { setStep(3); }
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/activities/lab/config', {
        method,
        maxHr: effectiveMaxHr || 190,
        restingHr: restingHr ? parseInt(restingHr) : 60,
        lthr: lthr ? parseInt(lthr) : null,
        age: age ? parseInt(age) : null,
      });
      onSaved();
    } finally { setSaving(false); }
  };

  const zoneColors: Record<string, string> = {
    '#6366f1': 'bg-indigo-500',
    '#22c55e': 'bg-green-500',
    '#eab308': 'bg-yellow-500',
    '#f97316': 'bg-orange-500',
    '#ef4444': 'bg-red-500',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step >= s ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{step > s ? <CheckCircle2 className="w-4 h-4" /> : s}</div>
              {s < 3 && <div className={`w-16 h-1 rounded-full transition-all ${step > s ? 'bg-orange-500' : 'bg-zinc-800'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          {step === 1 && (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">Pilih Metode HR Zones</h2>
                <p className="text-zinc-400 text-sm">Metode ini menentukan cara kita menghitung zona detak jantungmu. Bisa diubah kapan saja.</p>
              </div>
              <div className="space-y-3">
                {METHODS.map(m => (
                  <button key={m.id} onClick={() => setMethod(m.id as any)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${method === m.id ? m.color : 'border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800'}`}>
                    <div className="flex items-center gap-4">
                      <m.icon className={`w-6 h-6 shrink-0 ${method === m.id ? 'text-current' : 'text-zinc-400'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white">{m.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${method === m.id ? 'bg-white/20 text-current' : 'bg-zinc-700 text-zinc-400'}`}>{m.subtitle}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{m.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">
                  {method === 'hrmax' ? 'HR Max Setup' : method === 'hrr' ? 'HRR Setup' : 'LTHR Setup'}
                </h2>
                <p className="text-zinc-400 text-sm">Isi data di bawah untuk menghitung zona personalmu.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Usia</label>
                  <input type="number" placeholder="Contoh: 28" value={age} onChange={e => setAge(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors" />
                  {autoMaxHr && <p className="text-xs text-zinc-500 mt-1">HR Max estimasi usia: <span className="text-orange-400 font-bold">{autoMaxHr} bpm</span></p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">HR Max (opsional override)</label>
                  <input type="number" placeholder={autoMaxHr ? `${autoMaxHr} (dari usia)` : 'Contoh: 192'} value={maxHr} onChange={e => setMaxHr(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
                {method === 'hrr' && (
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">HR Istirahat (Resting HR)</label>
                    <input type="number" placeholder="Contoh: 55 (ukur saat baru bangun)" value={restingHr} onChange={e => setRestingHr(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors" />
                  </div>
                )}
                {method === 'lthr' && (
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Lactate Threshold HR</label>
                    <input type="number" placeholder="Contoh: 168 (dari tes lapangan)" value={lthr} onChange={e => setLthr(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors" />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">Zona HRmu Siap! 🎉</h2>
                <p className="text-zinc-400 text-sm">Inilah zona detak jantung personal berdasarkan datamu. Simpan untuk mulai menggunakan Performance Lab.</p>
              </div>
              <div className="space-y-3">
                {preview.map(z => (
                  <div key={z.zone} className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-2xl">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 ${zoneColors[z.color] || 'bg-zinc-600'}`}>Z{z.zone}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white">{z.label}</div>
                      <div className="flex-1 h-2 bg-zinc-700 rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${zoneColors[z.color] || 'bg-zinc-500'}`} style={{ width: `${(z.zone / 5) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-mono text-zinc-400 shrink-0">{z.min}–{z.max} bpm</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="p-6 border-t border-zinc-800 flex justify-between items-center">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">← Kembali</button>
            ) : <div />}
            {step < 3 ? (
              <button onClick={handleNext} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
                Selanjutnya <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan & Masuk Lab'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
