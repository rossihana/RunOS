import { Link } from 'react-router-dom';

const h2 = 'text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-2';
const p = 'text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed';
const li = 'text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed ml-4 list-disc';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">← Kembali ke RunOS</Link>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white mt-4">Privacy Policy</h1>
        <p className="text-xs text-zinc-400 mt-1">Versi 2026-09-12 · RunOS</p>

        <h2 className={h2}>1. Data yang Kami Kumpulkan</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}><b>Email & password RunOS</b> — untuk login (password disimpan sebagai hash scrypt).</li>
          <li className={li}><b>Email & password Garmin Connect</b> — hanya untuk sinkronisasi data; password disimpan terenkripsi AES-256-GCM.</li>
          <li className={li}><b>Data aktivitas lari</b> — jarak, pace, heart rate, kadence, rute GPS, split per km, dsb. dari akun Garmin-mu.</li>
          <li className={li}><b>Riwayat chat AI</b> — percakapan dengan AI Coach (dihapus otomatis setelah 30 hari).</li>
        </ul>

        <h2 className={h2}>2. Bagaimana Data Dipakai</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Menampilkan analitik, prediksi race, dan saran pelatihan untuk <b>kamu sendiri</b>.</li>
          <li className={li}>Data lari milikmu <b>tidak pernah dilihat oleh user lain</b>, tidak dijual, tidak dibagikan ke pihak ketiga untuk marketing.</li>
          <li className={li}>Kredensial Garmin hanya dipakai server untuk login sesi sync — tidak dipakai untuk mengubah apa pun di akun Garmin-mu (read-only).</li>
        </ul>

        <h2 className={h2}>3. AI & Provider Eksternal</h2>
        <p className={p}>Saran AI dihasilkan oleh model eksternal. Untuk menghasilkan jawaban, RunOS mengirim ringkasan data lari dan isi chat-mu ke provider model yang dipilih. Konten yang dikirim tidak memuat password-mu. Jika kamu memakai model custom dengan API key sendiri (BYOK), request langsung ke provider pilihanmu di luar kendali RunOS.</p>

        <h2 className={h2}>4. Penyimpanan & Keamanan</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Data disimpan di PostgreSQL terkelola (Supabase).</li>
          <li className={li}>Password RunOS: hash scrypt. Password Garmin: AES-256-GCM terenkripsi, kunci di server terpisah dari database.</li>
          <li className={li}>Sesi sync Garmin per-user terisolasi (token tersimpan per user, tidak bercampur).</li>
          <li className={li}>Kami tidak bisa dan tidak akan menampilkan password Garmin-mu kembali — kalau lupa, cukup disconnect lalu reconnect.</li>
        </ul>

        <h2 className={h2}>5. Hak Kamu</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}><b>Disconnect</b> — putuskan koneksi Garmin; kredensial dihapus dari database.</li>
          <li className={li}><b>Hapus akun & data</b> — minta penghapusan akun beserta seluruh data lari, PR, dan chat AI.</li>
          <li className={li}><b>Export</b> — minta salinan data aktivitasmu.</li>
        </ul>

        <h2 className={h2}>6. Retensi</h2>
        <p className={p}>Chat AI otomatis terhapus setelah 30 hari. Data aktivitas disimpan selama akunmu aktif. Saat akun dihapus, semua data terkait ikut terhapus.</p>

        <h2 className={h2}>7. Perubahan Kebijakan</h2>
        <p className={p}>Versi terkini selalu ada di halaman ini. Perubahan material akan diminta persetujuan ulang.</p>

        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/terms" className="text-xs font-bold text-orange-600 hover:underline">Lihat Terms of Service →</Link>
          <span className="text-xs text-zinc-400">Pertanyaan soal datamu? Hubungi pemilik RunOS.</span>
        </div>
      </div>
    </div>
  );
}
