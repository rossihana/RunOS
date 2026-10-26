# Rencana Migrasi: Garmin Sync → Personal API

> Status: rencana (belum dieksekusi) · Basis riset: [garmin-personal-api.md](../research/garmin-personal-api.md) (riset dokumentasi + tes empiris 2026-10-26, semua tervalidasi dengan akun nyata)
> Estimasi total: ±3–4 sesi kerja · Tidak ada downtime — migrasi bertahap, dua jalur

## Tujuan

Sync Garmin RunOS berpindah dari jalur kredensial (email+password via `garminconnect`, tidak resmi) ke **Garmin Connect Personal API resmi** (API key per user → token 24 jam → endpoint `personal.connectapi.garmin.com`). Password Garmin tidak lagi tersimpan di mana pun.

## Prinsip yang mengikat semua fase

1. **Dua jalur selama transisi**: user lama (kredensial) tetap sync; user baru pakai Personal API. Sync script menjadi adapter dengan dua backend; jalur lama dihapus setelah semua user berpindah.
2. **BYOK per user**: tiap user menempel API key miliknya sendiri (disimpan terenkripsi AES-256-GCM, pola sama dengan provider AI yang sudah ada). Tidak ada key owner yang di-share.
3. **Semua temuan empiris jadi kontrak**: token = JWT plain-text (bukan JSON), FIT = ZIP, `vO2MaxValue`/`hasPolyline` tidak dikembalikan server, detail aktivitas = envelope dengan `summaryDTO` bersarang.

## Keputusan yang harus dikunci dulu (sebelum Fase 1)

> ✅ **Dikunci 2026-10-26** — semua sesuai rekomendasi: K1 `fitdecode` · K2 owner dulu · K3 pola `garminPerUser.ts` · K4 notifikasi kedaluwarsa.

| # | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| K1 | Parser FIT | `fitdecode` (pure-python, matang) vs `garmin-fit-sdk` (resmi Garmin, butuh SDK binary) | `fitdecode` — cukup untuk polyline + mudah di GHA |
| K2 | Siapa dulu yang migrasi | Owner dulu (uji diri sendiri) vs langsung semua user | Owner dulu ±1 minggu, baru buka ke user lain |
| K3 | Penyimpanan key | Field baru `garmin_api_key_enc` di `ai_settings`-style JSON vs kolom tabel terpisah | Ikuti pola existing `garminPerUser.ts` (JSON terenkripsi) — diff terkecil |
| K4 | Perilaku key kedaluwarsa | Notifikasi in-app + email vs diam-diam gagal | Notifikasi (Garmin sudah kirim email ±1 minggu sebelum; kita tambah badge di UI saat sync gagal 401) |

## Fase 1 — Adapter sync Personal API (backend + GHA) · ±1 sesi

**Kerja:**
- [ ] `scripts/garmin_sync.py` → tambah backend kedua: baca `GARMIN_PERSONAL_KEY` (env GHA secret) → mint token (`POST …/personalapitoken-service/personal-api/personal-api-key/token`, **parse plain-text JWT**) → tarik list aktivitas (paginasi `start`/`limit`, backfill bertahap) → tulis ke DB dengan pemetaan field sama seperti jalur lama.
- [ ] Pemetaan field (list → skema DB RunOS): `distance`, `movingDuration`, `averageHR`, `maxHR`, `averageRunningCadenceInStepsPerMinute`, `hrTimeInZone_1..5`, `elevationGain`, `splitSummaries`, `startLatitude/Longitude`, `locationName`.
- [ ] FIT download per aktivitas baru: `GET /download-service/files/activity/{id}` → **unzip** → simpan `.fit` mentah untuk Fase 3 (jangan parse dulu — dipisah supaya fase ini kecil).
- [ ] Rate-limit guard konservatif: jeda 1–2 detik antar unduhan FIT (limit API tak terdokumentasi; empiris aman sampai ≥2,2 req/s beruntun + 50 paralel, tapi jangan memaksa).
- [ ] `.github/workflows/garmin-sync.yml`: secret baru `GARMIN_PERSONAL_KEY` (per user nanti; Fase 1 satu owner dulu) — jalur lama tetap utuh sebagai cabang kedua.
- [ ] Self-test kecil: skrip `--test-personal` yang mint token + tarik 1 aktivitas + bandingkan field (pola self-test yang sudah ada).

**Kriteria selesai:** sync owner via Personal API menghasilkan baris aktivitas di DB lokal yang setara dengan jalur lama (dicek: jumlah aktivitas, distance total, field inti terisi).

## Fase 2 — UI & settings per user · ±1 sesi

**Kerja:**
- [ ] `backend/src/services/garminPerUser.ts`: terima koneksi via `api_key` (selain jalur kredensial lama). Field: `garmin_api_key_enc` + `garmin_api_key_expires_at`.
- [ ] Endpoint sync per user: baca key user → mint token 24 jam → sync (frontend tak pernah melihat key lagi setelah simpan).
- [ ] `frontend/src/pages/GarminSettings.tsx`: form ganti dari "Kredensial Garmin (email+password)" menjadi "Personal API Key" + petunjuk singkat cara buat key (tautan ke panduan) + badge kedaluwarsa.
- [ ] Penanganan kedaluwarsa: saat sync 401 → tandai koneksi "key kedaluwarsa, perbarui" (K4) + opsional email via Resend.
- [ ] Teks legal: Privacy Policy disunting — password Garmin tidak lagi dikumpulkan untuk user jalur baru.

**Kriteria selesai:** user owner bisa menghubungkan Garmin hanya dengan menempel key; sync jalan end-to-end dari UI; user jalur lama tidak terganggu.

## Fase 3 — Rute GPS (FIT → polyline) · ±1 sesi

**Kerja:**
- [ ] Parser: unzip ZIP → `fitdecode` → ekstrak record GPS per timestamp → simpan polyline terenkode (format sama dengan kolom `map_polyline` sekarang).
- [ ] Jalankan untuk aktivitas baru saat sync; backfill historis = tugas batch terpisah (±4.000 unduhan, dibatasi laju, boleh beberapa hari).
- [ ] `MapThumbnail`/peta tidak berubah — konsumen polyline sama.

**Kriteria selesai:** peta rute tampil di Activity Detail untuk aktivitas yang disinkron via Personal API.

## Fase 4 — Rollout & pembongkaran jalur lama · ±½ sesi

**Kerja:**
- [ ] Migrasi user lain satu per satu (mereka buat key sendiri di Garmin Connect Web, tempel di UI).
- [ ] Monitor ±1–2 minggu: error sync, kedaluwarsa key, keluhan kehilangan data.
- [ ] Hapus jalur kredensial: kolom password terenkripsi di-nol-kan, kode `garminconnect` + secrets GHA lama dihapus, Privacy Policy final disunting.
- [ ] Update `docs/research/garmin-personal-api.md` → status "terimplementasi".

**Kriteria selesai:** tidak ada satu pun password Garmin tersimpan; semua sync lewat Personal API; dokumentasi akurat.

## Gerbang keamanan per fase (wajib lulus sebelum lanjut)

Setiap fase ditutup dengan audit yang sama, plus gerbang khusus fasenya:

**Audit standar tiap akhir fase (checklist):**
1. **Scan secret**: `git grep` + scan working tree untuk nilai key/token/password/DSN — nol kecocokan
2. **Scan penghapusan**: `git status` + `git diff --stat` — tidak ada file/data yang hilang tanpa disengaja
3. **Dua jalur sehat**: sync jalur lama SUKSES terakhir + jalur baru lulus self-test
4. **DB**: backup harian terenkripsi sukses (backup-db.yml) SEBELUM dan SESUDAH fase
5. **Log GHA**: tidak ada nilai sensitif ter-echo di log workflow (scan log run terakhir)

**Gerbang khusus:**

| Fase | Gerbang tambahan |
|---|---|
| Fase 1 (adapter) | Adapter menulis **hanya-baca ke Garmin** (GET/mint token saja — sudah jadi kontrak) · idempotensi tulis DB: `activityId` unik, tak boleh duplikat dengan jalur lama · secret GHA diset via `gh secret set`, tidak pernah lewat chat/log |
| Fase 2 (UI/settings) | Key user tersimpan terenkripsi (verifikasi: query DB, ciphertext bukan plaintext) · respons API TIDAK PERNAH memuat key/token (test otomatis) · user jalur lama lolos sync normal |
| Fase 3 (rute GPS) | FIT diunduh + diparse **read-only** · aktivitas treadmill/tanpa GPS → `hasPolyline=false`, tak ada crash · jumlah polyline lama TIDAK berubah |
| Fase 4 (pembongkaran) | **Snapshot backup manual + verifikasi restore** sebelum menyentuh kolom password · semua user sudah di Personal API ≥2 minggu hijau · audit final: `SELECT count(*) WHERE garmin_password_enc IS NOT NULL` = **0** baru kolom di-nol-kan |

## Pemantauan pasca-migrasi (permanen)

| Interval | Cek | Cara |
|---|---|---|
| Per sync (harian) | GHA garmin-sync sukses; 0 error 401/429 | Status workflow otomatis + badge gagal di UI |
| Mingguan | Scan secret repo (pola key/JWT/password) + `.env*` masih di-gitignore | Script scan sederhana atau gitleaks |
| Mingguan | Kontinuitas data: jumlah aktivitas minggu ini > 0 (kalau user aktif lari) — gap = sync diam tanpa alasan | Query DB sederhana |
| 7 hari sebelum key user kedaluwarsa | Badge + email pengingat (K4) | Cron cek `garmin_api_key_expires_at` |
| Bulanan | Audit: tidak ada plaintext kredensial di DB; jumlah user jalur kredensial lama menurun ke 0 | Query audit |
| Kapan pun dibutuhkan | **Rollback**: jalur lama dihapus hanya di Fase 4; sebelum itu, key lama bisa dibuat ulang user dalam 1 menit (buat key baru → tempel) | Prosedur terdokumentasi |

## Pengujian — kontrak per fase (tes otomatis, bukan cek manual)

Prinsip: **tes jalan tanpa jaringan** (fixture rekaman respons nyata dari tes empiris 2026-10-26 — token plain-text, list 96-field, envelope detail, ZIP FIT) supaya CI/GHA tidak bergantung akun hidup. Tes empiris live hanya untuk validasi akhir fase.

| Fase | Tes yang wajib ada & lulus |
|---|---|
| Fase 1 (adapter) | ① Parse token: respons plain-text JWT → token benar; respons error → pesan jelas (tanpa echo key) ② Pemetaan field: fixture list-respons nyata → baris DB dengan nilai persis (distance 7188.46 → 7.19 km dst.) ③ Idempotensi: sync 2× fixture sama → baris DB tetap N, bukan 2N ④ Paginasi: fixture 3 halaman → total gabungan benar, tak ada duplikat ⑤ **Regresi jalur lama**: `scripts/test_garmin_sync.py` yang existing tetap lulus tanpa diubah |
| Fase 2 (UI/settings) | ① Key tersimpan = ciphertext (assert bukan `ghp_`/plaintext prefix) ② Respons `GET /api/activities/garmin/*` **tidak mengandung** substring key/token (assert otomatis) ③ Kedaluwarsa: key dengan `expires_at` kemarin → status "kedaluwarsa", bukan crash ④ User jalur lama: alur lama lulus semua test existing |
| Fase 3 (rute GPS) | ① Fixture ZIP FIT nyata (116 KB) → unzip → jumlah titik GPS > 0 ② FIT tanpa GPS (treadmill fixture) → polyline kosong + status aman, tanpa exception ③ Polyline terenkode valid (parse balik → koordinat dalam rentang masuk akal) ④ Polyline aktivitas jalur lama tak berubah |
| Fase 4 (pembongkaran) | ① Audit query: count password tersisa = 0 (assert di skrip fase) ② Semua test Fase 1–3 masih hijau setelah kode lama dihapus ③ Dry-run delete di DB staging/copy dulu, baru produksi |

**Aturan gerbang**: checklist keamanan di atas **dan** semua test fase = hijau, baru fase dinyatakan selesai. Tes live (akun nyata) dijalankan sekali per fase sebagai validasi akhir, hasilnya dicatat di commit message.

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Key user kedaluwarsa → sync berhenti | Badge UI + email notifikasi (K4); mint ulang token otomatis gagal terdeteksi cepat |
| VO2max per aktivitas tidak dikembalikan server (empiris) | Tren Perf Lab ambil dari `fitnessAge` endpoint (terverifikasi 200) |
| Limit rate tak terdokumentasi | Guard jeda + backfill bertahap; empiris aman jauh di bawah beban sync normal |
| ToS multi-user | BYOK per user (tiap key hanya data pemiliknya); bila suatu saat dipertanyakan, tier Startup gratis adalah jalur naik |
| FIT parser gagal di edge case (aktivitas tanpa GPS/treadmill) | Skip + tandai `hasPolyline=false` — fitur lain tak terpengaruh |
| Spek OpenAPI ≠ realita (sudah terbukti) | Kontrak implementasi = respons empiris yang terdokumentasi di riset, bukan spek |

## Di luar skop (untuk kali ini)

- Cloudflare Tunnel 9router & BYOK AI — tidak tersentuh migrasi ini
- Menghapus jalur kredensial sebelum Fase 4 selesai
- Dashboard admin multi-user
