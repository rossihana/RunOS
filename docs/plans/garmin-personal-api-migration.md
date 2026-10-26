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
