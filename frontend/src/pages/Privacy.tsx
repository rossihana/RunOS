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
        <p className="text-xs text-zinc-400 mt-1">Versi 2026-09-27 · RunOS</p>

        <h2 className={h2}>1. Data yang Kami Kumpulkan</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}><b>Email & password RunOS</b> — untuk login (password disimpan sebagai hash scrypt).</li>
          <li className={li}><b>Email & password Garmin Connect</b> — hanya untuk sinkronisasi data; password disimpan terenkripsi AES-256-GCM.</li>
          <li className={li}><b>Data aktivitas & wellness</b> — jarak, pace, heart rate, cadence, rute GPS, split per km, tidur, HRV, skor kesiapan, VO2max — semuanya dari akun Garmin-mu.</li>
          <li className={li}><b>Riwayat chat AI</b> — percakapan dengan AI Coach (dihapus otomatis setelah 30 hari).</li>
          <li className={li}><b>Data teknis dasar</b> — log server standar (alamat IP, waktu akses) untuk keamanan dan debugging.</li>
        </ul>

        <h2 className={h2}>2. Bagaimana Data Dipakai</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Menampilkan analitik, prediksi race, dan saran pelatihan untuk <b>kamu sendiri</b>.</li>
          <li className={li}>Data lari milikmu <b>tidak pernah dilihat oleh user lain</b>, tidak dijual, tidak dibagikan ke pihak ketiga untuk marketing.</li>
          <li className={li}>Kredensial Garmin hanya dipakai server untuk login sesi sync — tidak dipakai untuk mengubah apa pun di akun Garmin-mu (read-only).</li>
        </ul>

        <h2 className={h2}>3. Pemroses Data</h2>
        <p className={p}>Untuk menjalankan layanan, data diproses oleh penyedia infrastruktur tepercaya (hosting, database, email transaksional, dan model AI) yang terikat perjanjian kerahasiaan dan hanya memproses data atas instruksi kami. Kami tidak menjual data; detail infrastruktur internal tidak kami umumkan demi keamanan layanan. Kredensial yang dilewatkan ke proses sinkronisasi otomatis <b>disamarkan pada log</b> dan disimpan terenkripsi.</p>

        <h2 className={h2}>4. AI & Provider Eksternal</h2>
        <p className={p}>Saran AI dihasilkan oleh model eksternal. Untuk menghasilkan jawaban, RunOS mengirim ringkasan data lari dan isi chat-mu ke provider model tersebut. Konten yang dikirim tidak memuat password-mu. Jika kamu memakai model custom dengan API key sendiri (BYOK), request langsung ke provider pilihanmu di luar kendali RunOS.</p>

        <h2 className={h2}>5. Cookies & Penyimpanan Lokal</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Login menggunakan token yang disimpan di <b>localStorage browser-mu</b> — bukan cookie pelacakan.</li>
          <li className={li}>Tidak ada cookie iklan, tidak ada pelacak pihak ketiga, tidak ada analytics pihak ketiga.</li>
          <li className={li}>Preferensi (tema terang/gelap) disimpan lokal di perangkatmu.</li>
        </ul>

        <h2 className={h2}>6. Penyimpanan & Keamanan</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Password RunOS: hash scrypt. Password Garmin: AES-256-GCM terenkripsi, kunci enkripsi disimpan terpisah dari database.</li>
          <li className={li}>Sesi sync Garmin per-user terisolasi (token per user, tidak bercampur); log proses sinkronisasi disamarkan untuk kredensial.</li>
          <li className={li}>Koneksi seluruh layanan menggunakan HTTPS/TLS.</li>
          <li className={li}>Kami tidak bisa dan tidak akan menampilkan password Garmin-mu kembali — kalau lupa, cukup disconnect lalu reconnect.</li>
          <li className={li}>Tidak ada sistem yang 100% aman; kami berupaya memperbaiki kerentanan secepatnya bila ditemukan.</li>
        </ul>

        <h2 className={h2}>7. Retensi</h2>
        <p className={p}>Chat AI otomatis terhapus setelah 30 hari. Data aktivitas disimpan selama akunmu aktif. Saat akun dihapus, seluruh data terkait (aktivitas, kredensial Garmin, riwayat chat) ikut dihapus dari database.</p>

        <h2 className={h2}>8. Hak Kamu</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}><b>Disconnect</b> — putuskan koneksi Garmin; kredensial dihapus dari database.</li>
          <li className={li}><b>Hapus akun & data</b> — minta penghapusan akun beserta seluruh data lari, PR, dan chat AI.</li>
          <li className={li}><b>Export</b> — minta salinan data aktivitasmu.</li>
        </ul>

        <h2 className={h2}>9. Data Anak</h2>
        <p className={p}>RunOS tidak ditujukan untuk anak di bawah 13 tahun (atau batas usia minimal sesuai hukum wilayahmu). Jika kami mengetahui data anak dikumpulkan tanpa izin yang diperlukan, data tersebut akan dihapus.</p>

        <h2 className={h2}>10. Transfer Data Internasional</h2>
        <p className={p}>Prosesor kami beroperasi di berbagai negara. Dengan menggunakan RunOS, kamu memahami bahwa data dapat diproses di luar negara tempatmu tinggal, sesuai kebijakan privasi masing-masing penyedia.</p>

        <h2 className={h2}>11. Perubahan Kebijakan</h2>
        <p className={p}>Versi terkini selalu ada di halaman ini. Perubahan material akan diminta persetujuan ulang.</p>

        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/terms" className="text-xs font-bold text-orange-600 hover:underline">Lihat Terms of Service →</Link>
          <span className="text-xs text-zinc-400">Pertanyaan soal datamu? Hubungi pemilik RunOS (email terdaftar di akunmu).</span>
        </div>
      </div>
    </div>
  );
}
