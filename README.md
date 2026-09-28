# RunOS

> **AI-powered running training dashboard** — analitik lari, data kesehatan (HRV, sleep, VO2max), rencana latihan adaptif, dan AI Coach dalam satu aplikasi web.

![RunOS — video iklan](docs/ad.gif)

*[Video iklan MP4](docs/ad.mp4) · [Video demo aplikasi (GIF)](docs/demo.gif) · [Video demo MP4](docs/demo.mp4)*

**Live: [https://runos.web.id](https://runos.web.id)** · [Terms of Service](https://runos.web.id/terms) · [Privacy Policy](https://runos.web.id/privacy)

![garmin-sync](https://github.com/rossihana/RunOS/actions/workflows/garmin-sync.yml/badge.svg)
![backup-db](https://github.com/rossihana/RunOS/actions/workflows/backup-db.yml/badge.svg)

## Fitur

- **Dashboard** — mileage mingguan/bulanan, tren, preview balapan, AI Prediction Console.
- **Activities** — riwayat lengkap: peta rute, split, pace, detak jantung.
- **Performance Lab** — kartu kesehatan harian (**HRV, sleep score, VO2max**), status pemulihan, prediksi waktu finish berbasis data Garmin.
- **Training & Master Plan** — rencana latihan bertahap (Build → Peak → Tapering) menuju balapan.
- **AI Coach** — chat pelatihan bertenaga Gemini dengan konteks riwayat & data kesehatan.
- **Races** — kelola balapan, target waktu, dan PR.
- **Garmin Sync otomatis** — tarik aktivitas + data kesehatan **2× sehari (09.00 & 21.00 WIB)** via GitHub Actions, atau sinkron manual dari aplikasi.
- **Akun & persetujuan** — registrasi dengan persetujuan ToS/Privacy Policy yang dicatat di server (`users.terms_accepted_at`).

## Arsitektur (gratis total — tanpa kartu kredit)

```
                        statis (SPA + fallback)
  Browser ────────────► runos.web.id  (Cloudflare Workers)
     │
     │  /api
     └────────────────► Vercel  (Express + Drizzle + TypeScript)
                              │  TLS wajib (sslmode=require)
                              ▼
                     Supabase (Postgres)

  GitHub Actions ── sync Garmin harian (09.00 & 21.00 WIB, serial)
                └── backup DB terenkripsi harian → artefak 90 hari

  AI: Gemini API (OpenAI-compatible)   ·   Email: Resend (opsional)
```

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 4 · Recharts · React Router 7 |
| Backend | Express · TypeScript · Drizzle ORM · JWT |
| Database | Supabase (Postgres) — koneksi dipaksa **TLS** |
| Hosting | Cloudflare Workers (frontend) · Vercel (backend) · GitHub Actions (sinkronisasi & backup) |
| AI | Google Gemini |

## Menjalankan Lokal

Prasyarat: **Node.js 20+** (Python 3 + venv hanya untuk tes sinkronisasi Garmin, opsional).

```bash
git clone https://github.com/rossihana/RunOS.git
cd RunOS
npm run install:all          # install backend + frontend
```

Siapkan environment (salin dari `.env.example`, isi nilainya — jangan pernah commit `.env`):

- `backend/.env` — minimal `DATABASE_URL` (Postgres/Supabase; akhiri dengan parameter `sslmode` yang sesuai — lihat catatan di `.env.example`) dan `JWT_SECRET`.
  Variabel opsional: `ENCRYPTION_KEY` (backup terenkripsi), `SYNC_SECRET` (endpoint internal sync), `CORS_ORIGINS`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `INVITE_CODE`.
- `frontend/.env` — `VITE_API_URL` (mis. `http://localhost:3001`).

Jalankan keduanya:

```bash
npm run dev:backend           # Express → http://localhost:3001
npm run dev:frontend          # Vite → http://localhost:5173
```

atau `npm start` untuk keduanya sekaligus.

## Tes

```bash
cd backend
npm run lint                  # tsc --noEmit
npm test                      # unit test (node --test) + tes skrip sinkronisasi Garmin*
```

\*Bagian Python-nya memakai path venv lokal (lihat `scripts/test_garmin_sync.py`); lewati bila tidak ada.

## Keamanan & Privasi

- **TLS wajib** ke database di semua klien (baik driver Node maupun Python) — bukan fallback diam-diam.
- **Backup harian terenkripsi AES-256-GCM**, retensi 90 hari (GitHub Actions + salinan lokal), dengan rotasi kunci `ENCRYPTION_KEY` yang terdokumentasi (`backend/scripts/rotate_key.mjs`).
- **Consent gate di server**: registrasi tanpa persetujuan ToS/Privacy ditolak (400), timestamp disimpan di DB.
- **Rate limiting** pada endpoint registrasi & lupa password, validasi input di trust boundary, endpoint internal dilindungi `X-Sync-Secret`.
- Kebijakan lengkap: [runos.web.id/terms](https://runos.web.id/terms) · [runos.web.id/privacy](https://runos.web.id/privacy).

## Sinkronisasi & Operasi

- `garmin-sync.yml` — cron 2×/hari + `workflow_dispatch`; serial agar API Garmin tidak 429.
- `backup-db.yml` — dump terenkripsi harian → artefak (retensi 90 hari).
- Backup manual lokal: `node backend/scripts/backup_db.mjs dump` · cek sehat: `... selftest`.

## Disclaimer

RunOS tidak berafiliasi dengan Garmin Ltd. Data Garmin diambil melalui akun pengguna atas persetujuan mereka.
