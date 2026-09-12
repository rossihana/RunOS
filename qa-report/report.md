# RunOS — QA Report Lengkap
**Tanggal:** 12 September 2026 · **Metode:** API-level E2E via jalur browser (proxy :5173) + tsc + build
**Scope:** Semua 5 route group (auth, activities, analytics, races, AI) + Garmin + edge cases
**Blocker QA:** Browser tool tidak bisa buka localhost (kendala lama) → UI diuji via: route serve 200, tsc strict, vite build sukses (1.5MB dist), dan semua endpoint yang FE panggil. Interaksi visual (klik/scroll/layar) TIDAK tercakup.

## Ringkasan Eksekutif

| Suite | Hasil |
|---|---|
| 1. Auth (27 test) | 24 ✅ / 3 ❌ |
| 2. Activities/Races/Garmin (19 test) | 15 ✅ / 4 ❌ |
| 3. AI (12 test) | 10 ✅ / 2 ❌ (1 false-alarm: test salah field, enforcement benar) |
| 5. Data & business logic (17 test) | 17 ✅ |
| 6. Edge cases & rate limit (8 test) | 7 ✅ / 1 ❌ |
| **TOTAL** | **73 ✅ / 10 ❌ (1 false-alarm → 9 bug nyata)** |

---

## 🔴 BUG (urut prioritas)

### BUG-1 · ~~CRITICAL~~ · RESOLVED-BY-DESIGN — INVITE_CODE dihapus sengaja
- **Status:** Keputusan user 12/09: invite code tidak dipakai lagi — registrasi memang terbuka. BUKAN bug.

### BUG-2 · FIXED · 500 pada path non-numerik `/activities/:id`
- **Fix:** schema zod `id` kini `regex(/^\d+$/)` → 400; error handler tidak membocorkan pesan Postgres (`isDbError` → generik).
- **Verif:** `/activities/abc` → 400 ✅; SQLi path → 400 ✅; id valid tak ada → 404 ✅.

### BUG-3 · FIXED · Rate limit LOGIN tidak ada
- **Fix:** `loginRateLimit` in-memory per IP (10 attempt gagal / 15 menit), hanya hitung attempt GAGAL; login sukses mereset hitungan.
- **Verif:** 5 salah → benar → 200 ✅ (user normal tidak terganjal); brute 10× gagal → attempt #11 = 429 ✅.

### BUG-4 · FALSE ALARM · QA hit path yang salah
- Route legacy = `/api/activities/sync`; secret salah → **403 benar**. Tidak ada bug.

### BUG-5 · FALSE ALARM · QA kirim field yang salah
- Backend+FE konsisten pakai `race_name`+`distance`; QA kirim `name`+`distance_km` → 400 wajar.
- **Verif ulang:** create race field benar → 201 ✅, delete → 200 ✅. Races tidak rusak.

### BUG-6 · MEDIUM · Kredensial Garmin bisa disimpan TANPA validasi ke Garmin
- **Bukti:** connect dengan email `x@y.com` + password dummy → 200 "terhubung" langsung; sync kemudian akan gagal di background.
- **Dampak:** User typo password → "terhubung" palsu → bingung kenapa data tak masuk. ToS gate jalan, tapi validasi kredensial nyata tidak.
- **Fix (disarankan):** Saat connect, lakukan login Garmin dummy 1× (via queue) → kalau gagal, tolak dengan pesan jelas. Atau: tampilkan warning "kredensial belum diverifikasi".

### BUG-7 · LOW · `email_verified_at` tidak dipakai sebagai gate apa pun
- **Bukti:** User baru register → bisa langsung pakai semua fitur tanpa verifikasi email (login, activities, AI). Email verifikasi terkirim tapi tidak diwajibkan.
- **Dampak:** Verifikasi email saat ini hanya kosmetik. OK untuk personal, tapi kalau tujuannya anti-email-palsu → harus jadi gate (blokir akses sampai verified, atau banner + batasan fitur).
- **Fix:** Keputusan produk: (a) wajib verified untuk login/sync pertama, atau (b) banner pengingat saja. Implement minimal: banner di dashboard + indikator di /me.

### BUG-8 · LOW · Akun owner tidak bisa dites QA (password tak diketahui)
- Password owner (`rossi.hana@gmail.com`) bukan `RunosLari2026!` (yang kuset kemarin) — kemungkinan user mengganti password lewat alur reset email yang user uji sendiri. BUKAN bug — tapi QA suite data-nyata (analytics owner dengan 226 aktivitas) ter-cover pakai user QA dummy dengan data sintetis. Verifikasi analytics dengan data asli masih belum dilakukan → rekomendasi: jalankan ulang suite 5 setelah owner kirim password QA saat ini.

### BUG-9 · LOW · TS + `/api/sync` 404 inkonsisten → cek juga FE Login redirect env-dependent
- FE kirim semua request lewat `VITE_API_URL` (.env) — kalau env salah lagi (seperti APP_URL kemarin), FE gagal senyap. Rekomendasi: tambahkan health-check banner di FE kalau `/api/health` gagal >2× → tampilkan "Backend tidak terjangkau" (bukan blank/loading forever).

---

## ✅ YANG SEHAT (bukti ringkas)

**Auth:** register/login/me/logout valid; email invalid, password <8, duplikat email, JWT palsu, SQLi login — semua ditolak wajar. Reset password token sekali-pakai + password lama mati. **Token verifikasi & reset TIDAK bocor di response. Forgot-password anti-enumeration jalan.**

**Authorization antar user (data isolation):** user B tidak bisa lihat/edit/hapus aktivitas & race milik A (403/404); readiness user kosong → array kosong (bukan error). **Isolasi data per-user solid.**

**AI tiering:** non-owner hanya katalog 3 model gratis; `PUT /ai/settings defaultModel=glm-5.3-flash` → **403 benar**; BYOK provider CRUD + test error jelas; chat history & clear jalan; semua endpoint AI tanpa token → 401.

**Garmin:** connect tanpa ToS → 403; status TIDAK pernah membocorkan kredensial; sync tanpa koneksi → 400; legacy sync tanpa secret → 403.

**Data & bisnis:** 12/12 endpoint analytics/activities/races/AI 200 dengan data 5 aktivitas; konsistensi `average_speed` vs `distance/moving_time` drift 0%; readiness 31 hari terhitung.

**Edge:** payload 100KB → 413; JSON invalid → 400; endpoint asing → 404; auth scheme salah → 401; CORS preflight → 204; SQLi → ditolak. Build FE sukses (tsc strict + vite build 1.5MB). Semua halaman public route serve 200.

---

## Rekomendasi Urutan Fix
1. **BUG-1** (5 menit): kembalikan INVITE_CODE — gerbang registrasi mati
2. **BUG-5** (15 menit): Races create gagal → cek schema
3. **BUG-2** (15 menit): validasi :id + audit error response
4. **BUG-3** (15 menit): rate limit login
5. **BUG-6** (opsional): validasi kredensial Garmin saat connect
6. **BUG-7**: keputusan produk (gate vs banner)
7. **BUG-4 & 9**: audit kecil mount path + health banner FE

*Artifak: `backend/tmp/qa_suite1_auth.js`, `qa_suite2_api.js`, `qa_suite3_ai.js`; hasil JSON di `backend/qa-report/`.*
