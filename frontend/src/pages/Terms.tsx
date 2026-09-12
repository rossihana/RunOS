import { Link } from 'react-router-dom';

const h2 = 'text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-2';
const p = 'text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed';
const li = 'text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed ml-4 list-disc';

export default function Terms() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white">← Kembali ke RunOS</Link>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white mt-4">Terms of Service</h1>
        <p className="text-xs text-zinc-400 mt-1">Versi 2026-09-12 · RunOS</p>

        <h2 className={h2}>1. Tentang RunOS</h2>
        <p className={p}>RunOS adalah aplikasi analitik lari personal. Kami mengumpulkan data aktivitas lari dari akun Garmin Connect milikmu untuk menampilkan analitik, prediksi, dan saran pelatihan berbasis AI.</p>

        <h2 className={h2}>2. Akun & Kredensial Garmin</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Kamu bertanggung jawab menjaga kerahasiaan akun RunOS-mu.</li>
          <li className={li}>Saat menghubungkan Garmin, kamu memberikan email dan password Garmin Connect-mu kepada RunOS untuk tujuan sinkronisasi data — <b>tidak untuk tujuan lain</b>.</li>
          <li className={li}>Password Garmin disimpan dalam bentuk terenkripsi (AES-256-GCM) dan tidak pernah ditampilkan kembali kepada siapa pun, termasuk kamu.</li>
          <li className={li}>Kamu dapat memutuskan koneksi Garmin kapan pun; kredensial akan dihapus.</li>
        </ul>

        <h2 className={h2}>3. Sifat Integrasi Garmin (PENTING)</h2>
        <p className={p}>Sinkronisasi menggunakan <b>API tidak resmi</b> Garmin Connect (bukan partner API resmi). Konsekuensinya:</p>
        <ul className="space-y-1 mb-2">
          <li className={li}>Integrasi dapat berhenti bekerja sewaktu-waktu tanpa kontrol kami jika Garmin mengubah sistemnya.</li>
          <li className={li}>Garmin dapat membatasi (rate-limit) aktivitas login/sync yang terlalu sering.</li>
          <li className={li}>Dengan menghubungkan akun, kamu memahami dan menerima risiko ini.</li>
        </ul>

        <h2 className={h2}>4. Saran AI</h2>
        <p className={p}>Saran pelatihan, prediksi balapan, dan diagnosis dari fitur AI dihasilkan oleh model kecerdasan buatan dan <b>bukan nasihat medis</b>. Selalu konsultasi dengan pelatih atau tenaga medis untuk keputusan kesehatan. Jangan abaikan nyeri atau gejala cedera.</p>

        <h2 className={h2}>5. Penggunaan yang Dilarang</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Menggunakan data atau akun orang lain tanpa izin.</li>
          <li className={li}>Mencoba mengakses, mengubah, atau merusak data pengguna lain.</li>
          <li className={li}>Otomatisasi yang berlebihan (spam request ke server).</li>
        </ul>

        <h2 className={h2}>6. Tanggung Jawab Kami</h2>
        <p className={p}>RunOS disediakan "sebagaimana adanya", tanpa jaminan. Kami berupaya menjaga keamanan data (enkripsi kredensial, isolasi data per user), namun tidak ada sistem yang 100% aman. Layanan ini dikelola sebagai proyek personal; pemiliknya tidak bertanggung jawab atas kerugian tidak langsung akibat gangguan layanan.</p>

        <h2 className={h2}>7. Perubahan Ketentuan</h2>
        <p className={p}>Ketentuan dapat berubah. Perubahan penting akan diminta persetujuannya kembali saat kamu login. Versi terkini selalu ada di halaman ini.</p>

        <h2 className={h2}>8. Kontak</h2>
        <p className={p}>Pertanyaan soal ketentuan atau datamu: hubungi pemilik RunOS langsung.</p>

        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/privacy" className="text-xs font-bold text-orange-600 hover:underline">Lihat Privacy Policy →</Link>
          <span className="text-xs text-zinc-400">Dengan menggunakan RunOS, kamu tunduk pada ketentuan di atas.</span>
        </div>
      </div>
    </div>
  );
}
