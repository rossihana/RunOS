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
        <p className="text-xs text-zinc-400 mt-1">Versi 2026-09-27 · RunOS</p>

        <h2 className={h2}>1. Tentang RunOS</h2>
        <p className={p}>RunOS adalah aplikasi analitik lari <b>personal dan non-komersial</b>. Kami mengumpulkan data aktivitas lari dari akun Garmin Connect milikmu untuk menampilkan analitik, prediksi, dan saran pelatihan berbasis AI. Dengan membuat akun atau menggunakan layanan, kamu setuju pada ketentuan di halaman ini.</p>

        <h2 className={h2}>2. Kelayakan & Sifat Akun</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Layanan ini ditujukan untuk penggunaan pribadi; dilarang memonetisasi data atau laporan hasil dari RunOS.</li>
          <li className={li}>Kamu harus cukup umur menurut hukum yang berlaku di wilayahmu untuk membuat akun.</li>
          <li className={li}>Kamu bertanggung jawab menjaga kerahasiaan akun RunOS-mu dan atas semua aktivitas yang terjadi di bawah akunmu.</li>
          <li className={li}>Satu orang satu akun; berbagi akun dengan pihak lain dilarang karena keamanan data.</li>
        </ul>

        <h2 className={h2}>3. Akun & Kredensial Garmin</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Saat menghubungkan Garmin, kamu memberikan email dan password Garmin Connect-mu kepada RunOS untuk tujuan sinkronisasi data — <b>tidak untuk tujuan lain</b>.</li>
          <li className={li}>Password Garmin disimpan dalam bentuk terenkripsi (AES-256-GCM) dan tidak pernah ditampilkan kembali kepada siapa pun, termasuk kamu.</li>
          <li className={li}>Kamu dapat memutuskan koneksi Garmin kapan pun; kredensial akan dihapus.</li>
        </ul>

        <h2 className={h2}>4. Sifat Integrasi Garmin (PENTING)</h2>
        <p className={p}>Sinkronisasi menggunakan <b>API tidak resmi</b> Garmin Connect (bukan partner API resmi). Konsekuensinya:</p>
        <ul className="space-y-1 mb-2">
          <li className={li}>Integrasi dapat berhenti bekerja sewaktu-waktu tanpa kontrol kami jika Garmin mengubah sistemnya.</li>
          <li className={li}>Garmin dapat membatasi (rate-limit) aktivitas login/sync yang terlalu sering.</li>
          <li className={li}>Dengan menghubungkan akun, kamu memahami dan menerima risiko ini.</li>
        </ul>

        <h2 className={h2}>5. Saran AI</h2>
        <p className={p}>Saran pelatihan, prediksi balapan, dan diagnosis dari fitur AI dihasilkan oleh model kecerdasan buatan eksternal (mis. Google Gemini) dan <b>bukan nasihat medis</b>. Selalu konsultasi dengan pelatih atau tenaga medis untuk keputusan kesehatan. Jangan abaikan nyeri atau gejala cedera.</p>

        <h2 className={h2}>6. Penggunaan yang Dilarang</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>Menggunakan data atau akun orang lain tanpa izin.</li>
          <li className={li}>Mencoba mengakses, mengubah, atau merusak data pengguna lain.</li>
          <li className={li}>Otomatisasi yang berlebihan (spam request ke server) atau scraping massal layanan.</li>
          <li className={li}>Menggunakan RunOS untuk melanggar hukum atau hak pihak lain.</li>
        </ul>

        <h2 className={h2}>7. Ketersediaan & Perubahan Layanan</h2>
        <ul className="space-y-1 mb-2">
          <li className={li}>RunOS berjalan di infrastruktur cloud (Vercel, Cloudflare, Supabase) dengan paket gratis — <b>tanpa jaminan uptime</b> dan tanpa SLA.</li>
          <li className={li}>Fitur dapat ditambah, diubah, atau dihapus sewaktu-waktu; pemeliharaan dapat menyebabkan gangguan sementara.</li>
          <li className={li}>Jadwal sinkronisasi otomatis dapat disesuaikan demi stabilitas layanan.</li>
        </ul>

        <h2 className={h2}>8. Penghentian</h2>
        <p className={p}>Kamu dapat menghapus akun kapan pun. Kami dapat membatasi atau mengakhiri akses kamu jika ketentuan dilanggar, atau jika layanan dihentikan sepenuhnya. Setelah penghapusan, data terkait akunmu ikut dihapus sesuai Privacy Policy.</p>

        <h2 className={h2}>9. Tanggung Jawab Kami</h2>
        <p className={p}>RunOS disediakan "sebagaimana adanya", tanpa jaminan. Kami berupaya menjaga keamanan data (enkripsi kredensial, isolasi data per user), namun tidak ada sistem yang 100% aman. Sejauh diizinkan hukum, pemilik RunOS tidak bertanggung jawab atas kerugian tidak langsung akibat gangguan layanan, keterlambatan data, atau perubahan API pihak ketiga (Garmin/AI).</p>

        <h2 className={h2}>10. Hukum yang Berlaku</h2>
        <p className={p}>Ketentuan ini tunduk pada hukum Negara Republik Indonesia. Setiap sengketa diselesaikan secara musyawarah terlebih dahulu.</p>

        <h2 className={h2}>11. Perubahan Ketentuan</h2>
        <p className={p}>Ketentuan dapat berubah. Perubahan penting akan diminta persetujuannya kembali saat kamu login. Versi terkini selalu ada di halaman ini.</p>

        <h2 className={h2}>12. Kontak</h2>
        <p className={p}>Pertanyaan soal ketentuan atau datamu: hubungi pemilik RunOS langsung (melalui email terdaftar di akunmu).</p>

        <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/privacy" className="text-xs font-bold text-orange-600 hover:underline">Lihat Privacy Policy →</Link>
          <span className="text-xs text-zinc-400">Dengan menggunakan RunOS, kamu tunduk pada ketentuan di atas.</span>
        </div>
      </div>
    </div>
  );
}
