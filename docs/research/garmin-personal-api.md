# Riset: Garmin Connect Personal API — Kelayakan Migrasi RunOS

> Tanggal: 2026-10-26 · Status: riset dokumentasi (belum uji akun nyata)
> Pemicu: sync Garmin RunOS saat ini memakai jalur tidak resmi (email+password via lib `garminconnect`) — password user tersimpan di server, rawan 2FA/429/ToS abu-abu. Garmin baru membuka **Personal API** resmi (Oktober 2026).

## Ringkasan eksekutif

- Personal API **gratis**, untuk akses **data diri sendiri** lewat **API key yang dibuat user di Garmin Connect Web** — tanpa apply/paperwork, tanpa OAuth browser, tanpa serah password.
- Autentikasi: API key → token akses **24 jam** (endpoint khusus, tanpa refresh token — mint ulang kapan saja). **Headless/GitHub Actions friendly.**
- **Semua kebutuhan data RunOS tercover** (lihat tabel kelayakan): aktivitas + detail lengkap (distance, pace, HR, cadence, VO2max, HR zones), wellness harian (RHR, stress, sleep, Body Battery, HRV), fitness age.
- **Satu celah**: koordinat rute GPS tidak disediakan sebagai GeoJSON — hanya flag `hasPolyline`; rute didapat dengan **unduh file FIT** lalu diparse.
- Batasan terbesar bukan teknis tapi **ketentuan pemakaian**: Personal API ditujukan untuk pemakaian personal; RunOS multi-user berada di area abu-abu (diskusi di bagian Rekomendasi).
- Garmin merilis **client Python resmi**: [garmin/connect-personal-api-python](https://github.com/garmin/connect-personal-api-python) (Apache-2.0).

## 1. Cara mendapat akses

Sumber: [Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-api/) · [Program Overview](https://developer.garmin.com/gc-developer-program/)

- Buka **Garmin Connect Web** (login akun Garmin sendiri) → halaman **Personal API Key** → **Create Key** → setujui T&C → pilih masa berlaku → **Create**.
- **Gratis.** DC Rainmaker (21 Okt 2026): tier Personal dan Startup gratis, tanpa proses verifikasi kertas seperti program lama ([sumber](https://www.dcrainmaker.com/2026/10/garmin-connect-api-revamps-connect-developer.html)). Garmin membuka kembali program ini setelah ±7 bulan tutup untuk pendaftar baru.
- **Key hanya tampil sekali** (seperti pola password/token umum). Hilang = hapus + buat baru.
- **Key kedaluwarsa**: pilihan 30 / 90 / 180 / 365 hari. Email pengingat ±1 minggu sebelum kedaluwarsa. Status & kedaluwarsa bisa dilihat kapan pun di Garmin Connect Web.
- Dapat **dihapus/dicabut kapan pun** — token yang diturunkan dari key ikut mati.

## 2. Alur otorisasi

Sumber: [Personal API FAQ — Authentication](https://developer.garmin.com/gc-developer-program/personal/personal-api/)

- **Bukan OAuth browser-flow.** Tidak ada consent callback, tidak ada client secret, tidak ada serah password ke aplikasi ([konfirmasi pola yang sama](https://github.com/oscarrenalias/garmin-connect-data-retriever/blob/main/docs/SPEC.md)).
- Alurnya:
  1. User membuat API key di Garmin Connect Web (di atas).
  2. Aplikasi menukar key → access token:
     `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` dengan header `Authorization: ApiKey <key>`.
  3. Token dipakai untuk memanggil API (`Authorization: Bearer`), base URL `https://personal.connectapi.garmin.com`.
- **Token berlaku 24 jam** (atau sampai key kedaluwarsa). **Tanpa refresh token** — cukup minta token baru dari key kapan pun.
- Cabut akses = hapus key di Garmin Connect.

## 3. Cakupan data (dibedah dari OpenAPI spec resmi)

Sumber: [Personal API Swagger Docs](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/) — spec diekstrak utuh dari halaman tersebut (26 endpoint, 109 schema; arsip: `docs/research/garmin-personal-api-openapi.json` di repo ini).

### 3a. Aktivitas lari — **tercover penuh**

`GET /activitylist-service/activities/search/activities` (param `start`, `limit`, default 99) → `SummarizedActivityDTO` (**230 field**). Yang RunOS konsumsi, semuanya ada:

| Kebutuhan RunOS | Field di DTO |
|---|---|
| Jarak, durasi, moving time | `distance`, `duration`, `movingDuration`, `elapsedDuration` |
| Pace/kecepatan | `averageSpeed`, `maxSpeed`, `avgGradeAdjustedSpeed`, `fastestSplit_1000/5000/…` |
| Heart rate | `averageHR`, `maxHR`, `minHR`, `hrTimeInZone_1..5`, `lactateThresholdBpm` |
| Kadensi | `averageRunningCadenceInStepsPerMinute`, `maxRunningCadenceInStepsPerMinute`, `avgStrideLength` |
| VO2max | `vO2MaxValue` (per aktivitas) |
| Elevasi | `elevationGain/Loss`, `min/max/avgElevation` |
| Ekstra berharga | `aerobicTrainingEffect`, `activityTrainingLoad`, `splitSummaries`, `intensityMinutes` |

Detail per aktivitas: `GET /activity-service/activity/{activityId}` → `ActivitySummaryDTO`.
Summary per rentang tanggal: `GET /wellnessactivity-service/activity/summary/range/{fromDate}/{untilDate}`.

### 3b. Rute GPS (polyline) — **tercover dengan langkah tambahan**

- Spec hanya menyediakan **flag** `hasPolyline` + `startLatitude/Longitude`, `endLatitude/Longitude` — **tidak ada endpoint GeoJSON rute**.
- Rute didapat dari **unduhan file FIT**: `GET /download-service/files/activity/{activityId}` ("Download activity file") → file FIT memuat track GPS per detik → parse (mis. lib `fitdecode`/`garmin-fit-sdk`) → polyline untuk peta RunOS.
- Implikasi: satu langkah ekstra (unduh + parse FIT) dibanding jalur `garminconnect` sekarang yang menyajikan polyline langsung.

### 3c. Wellness / Perf Lab — **tercover**

| Fitur RunOS | Endpoint |
|---|---|
| RHR harian | `GET /wellness-service/wellness/dailyHeartRate` (`DailyHeartRateDTO.restingHeartRate`, `lastSevenDaysAvgRestingHeartRate`) |
| Stress harian | `GET /usersummary-service/stats/stress/daily/{from}/{to}` |
| HR zones | `GET /biometric-service/heartRateZones/v2` |
| Fitness age | `GET /fitnessage-service/fitnessage/v2/{calendarDate}` |
| HRV | `GET /hrv-service/hrv/{calendarDate}` + range harian |
| Sleep | `GET /sleep-service/sleep/dailySleep` + summaries per tanggal |
| Body Battery, SpO2 | `/wellness-service/wellness/bodyBattery/reports/daily`, `daily/spo2acclimation/{date}` |
| Langkah, bobot, hidrasi | `/usersummary-service/stats/steps/daily/…`, `/weight-service/weight/range/…`, hydration |

Catatan: VO2max per aktivitas ada di `SummarizedActivityDTO.vO2MaxValue`; tidak ada endpoint "VO2max tren harian" terpisah di spec — tren bisa dibangun dari riwayat aktivitas + fitness age.

## 4. Batasan & ketentuan

- **Rate limit**: spesifikasi OpenAPI **tidak mendokumentasikan** rate limit. (Perlu uji empiris dengan akun nyata — riset lanjutan.)
- **Ukuran response**: endpoint list default 99 item per halaman, paginasi `start`/`limit`.
- **ToS tier personal**: *"intended for individual Garmin users who want programmatic access to their own data. It is not intended for commercial applications serving multiple end users."* (FAQ resmi). Tier **Startup** (juga gratis) ditujukan untuk organisasi ≤1.000 user ([DC Rainmaker](https://www.dcrainmaker.com/2026/10/garmin-connect-api-revamps-connect-developer.html)).
- **Key kedaluwarsa wajib dipilih** (min. 30 hari) — aplikasi harus menangani pembaruan key (email pengingat dari Garmin ±1 minggu sebelum).

## 5. Kompatibilitas operasional (GitHub Actions / headless)

- **Sangat cocok**: alurnya murni API — key (dari env secret GHA) → mint token 24 jam → panggil endpoint. **Tidak ada langkah interaktif**, tidak ada 2FA, tidak ada sesi basi seperti `garminconnect`.
- Tanpa refresh token bukan masalah: token bisa dicetak ulang setiap sync (murah, 1 request).
- Client Python resmi tersedia: [garmin/connect-personal-api-python](https://github.com/garmin/connect-personal-api-python) (rilis 2026-10-20, Apache-2.0).

## 6. Kelayakan migrasi untuk RunOS

| Kebutuhan | garminconnect (sekarang) | Personal API | Catatan |
|---|---|---|---|
| List + detail aktivitas (jarak, pace, HR, kadensi, VO2max, zona) | ✓ | ✓ **lebih lengkap** (230 field, splits, training effect) | — |
| Rute GPS peta | ✓ polyline langsung | ⚠️ via unduh FIT + parse | +1 langkah, +dependensi parser FIT |
| Perf Lab (RHR, stress, sleep, HRV, fitness age) | ✓ (cara tidak resmi) | ✓ **endpoint resmi** | — |
| Keamanan user | ✗ password tersimpan | ✓ **key saja, cabut kapan pun** | argumen terkuat migrasi |
| Stabilitas sync | ✗ rawan 2FA/basi/429 | ✓ token 24 jam dicetak ulang kapan pun | — |
| Headless GHA | ⚠️ sesi rawan mati | ✓ murni API | — |
| Multi-user RunOS | ⚠️ password tiap user | ⚠️ area abu-abu ToS (lihat bawah) | perlu keputusan sadar |

**Ketentuan multi-user**: FAQ menyatakan Personal API bukan untuk "commercial applications serving multiple end users". RunOS non-komersial, dan skema yang paling selaras = **setiap user memakai key miliknya sendiri** (model BYOK, persis pola provider AI yang sudah ada) — tiap key hanya menyentuh data pemiliknya. Untuk kepatuhan penuh terhadap huruf ToS, tier Startup adalah jalurnya, tapi tier itu difokuskan untuk organisasi; untuk lingkup personal app kecil, pola BYOK per-user adalah yang paling defensible.

## Rekomendasi untuk RunOS

1. **Migrasi ke Personal API layak dan sebaiknya dikerjakan** — menutup risiko keamanan terbesar RunOS (penyimpanan password Garmin user) dan masalah stabilitas sync.
2. **Desain yang disarankan**: tiru pola BYOK yang sudah ada — halaman Garmin Connection ganti dari "email+password" menjadi "tempel Personal API Key" (tersimpan terenkripsi, sama seperti sekarang); tiap sync: mint token 24 jam → tarik data; tangani kedaluwarsa key dengan notifikasi ke user.
3. **Riset lanjutan sebelum eksekusi** (uji akun nyata): (a) uji rate limit empiris, (b) verifikasi parsing FIT → polyline untuk peta, (c) cek field `SummarizedActivityDTO` yang benar-benar dikembalikan server vs spec (spec bisa lebih longgar dari realita).
4. **Strategi transisi**: jalankan dua jalur selama 1-2 minggu (user lama tetap kredensial, user baru Personal API) — sync script menjadi adapter dengan dua backend.

---

*Sumber primer: developer.garmin.com (Personal API FAQ, Program Overview, Swagger Docs), spesifikasi OpenAPI diekstrak 2026-10-26, DC Rainmaker 21-10-2026, GitHub garmin/connect-personal-api-python.*
