import { Wind } from 'lucide-react';

interface Props {
  vo2max: number | null;
  age?: number | null;
}

const getCategory = (v: number, age: number) => {
  // Simplified Fitzgerald VO2Max category by age (men/unisex general)
  const ranges =
    age < 30 ? [38, 44, 54, 61] :
    age < 40 ? [34, 40, 50, 56] :
    age < 50 ? [30, 36, 45, 51] :
               [26, 32, 40, 46];
  if (v < ranges[0]) return { label: 'Di Bawah Rata-rata', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  if (v < ranges[1]) return { label: 'Rata-rata', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' };
  if (v < ranges[2]) return { label: 'Di Atas Rata-rata', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
  if (v < ranges[3]) return { label: 'Baik', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  return { label: 'Sangat Baik', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
};

export default function VO2MaxCard({ vo2max, age }: Props) {
  const cat = vo2max ? getCategory(vo2max, age || 30) : null;

  const insight = vo2max
    ? vo2max < 40
      ? 'VO2Max masih bisa ditingkatkan. Tambahkan sesi Zona 2 panjang (30-60 menit) 3x seminggu.'
      : vo2max < 52
      ? 'VO2Max kamu di level solid. Interval ringan dan long run stabil bisa mendongkraknya lebih jauh.'
      : 'VO2Max kamu sangat baik! Fokuslah mempertahankan kebugaran aerobik ini.'
    : 'Butuh minimal satu lari >20 menit untuk estimasi VO2Max.';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Wind className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">VO2Max (Estimasi)</h3>
          <p className="text-[10px] text-zinc-500">Kapasitas aerobik maksimalmu</p>
        </div>
      </div>

      {vo2max ? (
        <>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-black text-white">{vo2max}</span>
            <span className="text-sm text-zinc-500 pb-1">mL/kg/min</span>
          </div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${cat?.bg} ${cat?.color} mb-4`}>
            {cat?.label}
          </div>
        </>
      ) : (
        <div className="text-3xl font-black text-zinc-600 mb-4">—</div>
      )}

      <div className="pt-4 border-t border-zinc-800/60 flex items-start gap-2">
        <span className="text-base">💡</span>
        <p className="text-xs text-zinc-300 leading-relaxed">{insight}</p>
      </div>
    </div>
  );
}
