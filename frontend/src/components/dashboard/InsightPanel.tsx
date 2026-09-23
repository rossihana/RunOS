interface Insight {
  emoji: string;
  category: string;
  text: string;
  severity: 'good' | 'warn' | 'info';
}

interface Props {
  fitnessMetrics: { vo2max: number | null; fitness: number; fatigue: number; form: number };
  performanceMetrics: { avgCadence: number | null; totalActivities30d: number; totalKm30d: number };
  zoneDistribution: Array<{ zone: number; percentage: number }>;
}

const sev = {
  good: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  warn: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

function generateInsights(fitness: Props): Insight[] {
  const { fitnessMetrics, performanceMetrics, zoneDistribution } = fitness;
  const insights: Insight[] = [];

  const { form, fatigue, fitness: ctl, vo2max } = fitnessMetrics;
  const z2 = zoneDistribution.find(z => z.zone === 2);
  const z4 = zoneDistribution.find(z => z.zone === 4);
  const z5 = zoneDistribution.find(z => z.zone === 5);
  const { avgCadence, totalKm30d, totalActivities30d } = performanceMetrics;

  // Form / Fatigue insights
  if (form > 10) insights.push({ emoji: '🔋', category: 'Kesiapan', severity: 'good', text: `Form +${form}: Tubuhmu segar dan siap untuk sesi intensitas tinggi atau balapan!` });
  else if (form < -15) insights.push({ emoji: '⚠️', category: 'Kesiapan', severity: 'warn', text: `Form ${form}: Kelelahan tinggi terdeteksi. Prioritaskan recovery — hindari interval keras minggu ini.` });
  else insights.push({ emoji: '✅', category: 'Kesiapan', severity: 'info', text: `Form ${form > 0 ? '+' + form : form}: Kondisi latihan normal. Aman untuk meneruskan rencana sesuai jadwal.` });

  // Volume insights
  if (totalKm30d < 40) insights.push({ emoji: '📉', category: 'Volume', severity: 'warn', text: `Total ${totalKm30d} km dalam 30 hari terakhir. Volume masih rendah untuk membangun kebugaran serius.` });
  else if (totalKm30d > 150) insights.push({ emoji: '🏃', category: 'Volume', severity: 'info', text: `Total ${totalKm30d} km dalam 30 hari — volume tinggi! Pastikan tidur dan nutrisi mendukung pemulihan.` });
  else insights.push({ emoji: '📊', category: 'Volume', severity: 'good', text: `${totalKm30d} km dalam 30 hari — volume sehat. Pertahankan konsistensi ini!` });

  // Zone distribution insights
  if (z2 && z2.percentage < 25)
    insights.push({ emoji: '🫀', category: 'HR Zones', severity: 'warn', text: `Zona 2 hanya ${z2.percentage}% dari total larimu. Aerobik base kamu butuh lebih banyak easy run panjang.` });
  if ((z4?.percentage ?? 0) + (z5?.percentage ?? 0) > 35)
    insights.push({ emoji: '🔴', category: 'HR Zones', severity: 'warn', text: `${((z4?.percentage ?? 0) + (z5?.percentage ?? 0))}% waktu di Zona 4-5 — lebih tinggi dari ideal. Tanda hard running terlalu sering.` });

  // Cadence
  if (avgCadence && avgCadence < 165)
    insights.push({ emoji: '🦵', category: 'Teknik', severity: 'warn', text: `Cadence rata-rata ${avgCadence} spm masih di bawah optimal. Cobalah lari di 170 spm dengan bantuan metronom.` });
  else if (avgCadence && avgCadence >= 180)
    insights.push({ emoji: '⚡', category: 'Teknik', severity: 'good', text: `Cadence ${avgCadence} spm — teknik langkah kamu sudah efisien! Lebih sedikit benturan = lebih sedikit risiko cedera.` });

  // VO2Max
  if (vo2max && vo2max < 40)
    insights.push({ emoji: '🫁', category: 'Kapasitas Aerobik', severity: 'warn', text: `VO2Max ${vo2max} ml/kg/min — masih bisa jauh lebih tinggi! Long run Zona 2 adalah kunci utamanya.` });
  else if (vo2max && vo2max >= 50)
    insights.push({ emoji: '🏅', category: 'Kapasitas Aerobik', severity: 'good', text: `VO2Max ${vo2max} ml/kg/min — kapasitas aerobik kamu sangat baik untuk seorang pelari! Pertahankan!` });

  // Frequency
  if (totalActivities30d < 6)
    insights.push({ emoji: '📅', category: 'Konsistensi', severity: 'warn', text: `Hanya ${totalActivities30d} sesi dalam 30 hari. Konsistensi minimal 3x/minggu jauh lebih efektif untuk meningkatkan performa.` });

  return insights;
}

export default function InsightPanel(props: Props) {
  const insights = generateInsights(props);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
      <div className="mb-5">
        <h3 className="text-base font-black text-white">Insight Pelatih</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Analisis otomatis berdasarkan data larimu — diperbarui tiap sesi baru.</p>
      </div>
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border ${sev[ins.severity]}`}>
            <span className="text-xl shrink-0">{ins.emoji}</span>
            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider mb-1 ${ins.severity === 'good' ? 'text-emerald-500' : ins.severity === 'warn' ? 'text-amber-500' : 'text-blue-500'}`}>
                {ins.category}
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">{ins.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
