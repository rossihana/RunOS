import { Footprints } from 'lucide-react';

interface Props {
  avgCadence: number | null;
}

export default function CadenceCard({ avgCadence }: Props) {
  const getStatus = (c: number) => {
    if (c >= 180) return { label: 'Optimal', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' };
    if (c >= 165) return { label: 'Cukup Baik', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', barColor: 'bg-yellow-500' };
    return { label: 'Perlu Ditingkatkan', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', barColor: 'bg-orange-500' };
  };

  const status = avgCadence ? getStatus(avgCadence) : null;
  const fillPct = avgCadence ? Math.min((avgCadence / 200) * 100, 100) : 0;

  const insight = avgCadence
    ? avgCadence < 160
      ? `Cadence ${avgCadence} spm terlalu rendah. Coba gunakan metronom di 170 spm dan tingkatkan 5% per minggu.`
      : avgCadence < 175
      ? `Cadence ${avgCadence} spm sudah di jalur yang baik. Target idealnya ≥180 spm untuk efisiensi penuh.`
      : `Cadence ${avgCadence} spm sudah optimal! Ini mengurangi risiko cedera dan meningkatkan efisiensi energi.`
    : 'Data cadence belum tersedia. Lakukan "Sync Strava" ulang dari halaman Activities agar data cadence dari jam tanganmu tersimpan.';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
          <Footprints className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">Cadence</h3>
          <p className="text-[10px] text-zinc-500">Langkah per menit (rata-rata 30 hari)</p>
        </div>
      </div>

      {avgCadence ? (
        <>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-black text-white">{avgCadence}</span>
            <span className="text-sm text-zinc-500 pb-1">spm</span>
          </div>
          {/* Progress bar to 200 spm */}
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all ${status?.barColor}`} style={{ width: `${fillPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mb-4">
            <span>0</span><span>160</span><span className="font-bold text-zinc-500">180✓</span><span>200</span>
          </div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${status?.bg} ${status?.color}`}>
            {status?.label}
          </div>
        </>
      ) : (
        <div className="text-3xl font-black text-zinc-600 mb-4">—</div>
      )}

      <div className="pt-4 border-t border-zinc-800/60 flex items-start gap-2 mt-4">
        <span className="text-base">💡</span>
        <p className="text-xs text-zinc-300 leading-relaxed">{insight}</p>
      </div>
    </div>
  );
}
