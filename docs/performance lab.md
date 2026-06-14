# 🧠 Runos – Performance Lab (Product & UX Implementation Plan)

## 🎯 Objective

Membuat fitur **Performance Lab** yang membantu runner memahami kondisi tubuh dan performa mereka melalui data yang mudah dipahami dan actionable.

Fokus utama:

- Awareness (user ngerti tubuhnya)
- Insight (bukan cuma angka)
- Simplicity (tidak overwhelming)

---

# 📱 1. Feature Overview

Performance Lab adalah halaman khusus yang berisi:

- Heart Rate Configuration (setup dasar)
- Heart Rate Zones
- VO2Max (Estimated)
- Training Load
- Running Efficiency
- HR Drift
- Lactate Threshold
- Cadence & Stride Awareness
- Insights (interpretasi data)

---

# 🧭 2. UX Philosophy

## 2.1 Principles

- **Simple → Insightful → Actionable**
- Jangan tampilkan semua sekaligus (progressive disclosure)
- Setiap data harus punya arti (bukan angka kosong)

---

## 2.2 User Value

User harus bisa menjawab:

- “Apakah latihan gue sudah benar?”
- “Apakah gue terlalu capek?”
- “Apakah performa gue meningkat?”

---

# 🔄 3. UX Flow

## 3.1 First-Time User

Flow:

```text
Open Performance Lab
→ Prompt Setup
→ Pilih metode HR
→ Input data
→ Preview hasil
→ Save
→ Masuk ke dashboard
```

---

## 3.2 Returning User

Flow:

```text
Open Performance Lab
→ Lihat ringkasan kondisi
→ Scroll untuk detail
→ Baca insights
```

---

## 3.3 Setelah Activity Baru

Flow:

```text
Selesai lari
→ Data diproses
→ Metrics update
→ Insights berubah
```

---

# 🧩 4. UI Structure

## 4.1 Layout Utama

```text
Performance Lab
│
├── HR Configuration (sticky)
├── Heart Rate Zones
├── Fitness Metrics
├── Performance Metrics
├── Endurance Metrics
└── Insights
```

---

# ⚙️ 5. Heart Rate Configuration (Core UX)

## Tujuan

Menentukan dasar semua analisis.

---

## Step 1: Pilih Metode

User memilih:

- HR Max (simple)
- HRR (recommended)
- LTHR (advanced)

---

## Step 2: Input Data

### HR Max

- Umur (auto calculate)
- Optional manual input

### HRR

- HR Max
- Resting HR

### LTHR

- Threshold HR (manual / dari activity)

---

## Step 3: Preview

User melihat:

- Range tiap zona HR

---

## Step 4: Save

→ Semua data Performance Lab jadi personalized

---

# ❤️ 6. Heart Rate Zones Section

## Tujuan

Menunjukkan distribusi effort saat latihan.

---

## UI

- Donut / bar chart
- Breakdown zona 1–5
- Highlight zona dominan

---

## Insight Contoh

- “Kamu terlalu sering di zona tinggi”
- “Zona 2 kamu masih kurang”

---

# 🫁 7. Fitness Metrics

## Isi

- VO2Max
- Lactate Threshold

---

## Tujuan

Menunjukkan kapasitas tubuh dan performa inti.

---

## UX

- Tampilkan angka + kategori (Good, Average, dll)
- Tampilkan perubahan (naik/turun)

---

# ⚡ 8. Performance Metrics

## Isi

- Running Efficiency
- Cadence
- Stride

---

## Tujuan

Membantu user memahami teknik lari.

---

## Insight Contoh

- “Cadence kamu masih rendah”
- “Efisiensi meningkat dibanding minggu lalu”

---

# 🔁 9. Endurance & Fatigue

## Isi

- Training Load
- HR Drift

---

## Tujuan

Menilai kondisi tubuh (fresh vs fatigue)

---

## Insight Contoh

- “Kamu mendekati overtraining”
- “Endurance kamu stabil”

---

# 💡 10. Insight Section (Most Important)

## Tujuan

Mengubah data menjadi pemahaman.

---

## Format

- List insight singkat
- Bahasa natural (seperti coach)

---

## Contoh

- “Easy run kamu terlalu cepat”
- “Recovery kamu kurang minggu ini”
- “Performa kamu meningkat”

---

# 🎨 11. UI Guidelines

## 11.1 Visual Hierarchy

- Angka besar → fokus utama
- Label kecil → penjelas
- Warna → status (good / warning)

---

## 11.2 Warna (contoh)

- Hijau → optimal
- Kuning → hati-hati
- Merah → overtraining

---

## 11.3 Komponen

- Card-based layout
- Scroll vertical
- Chart sederhana (tidak kompleks)

---

# 🧠 12. Content Strategy

## Jangan:

- Tampilkan angka tanpa konteks

## Harus:

- Selalu ada arti / insight

---

## Contoh Perbandingan

❌

- HR Drift: 7%

✅

- “HR kamu naik → tanda kelelahan ringan”

---

# 🚀 13. MVP Scope (WAJIB ADA)

- HR Configuration
- HR Zones
- Training Load (basic)
- VO2Max (simple estimate)
- Insights sederhana

---

# 🔥 14. Next Level (Optional)

- Lactate Threshold
- HR Drift
- Running Efficiency
- Cadence analysis

---

# ✅ 15. Success Criteria

Fitur ini berhasil kalau:

- User lebih ngerti kondisi tubuhnya
- User kembali untuk cek performa
- User merasa “dibimbing”

---

# 🏁 Conclusion

Performance Lab bukan sekadar fitur tambahan, tapi:

> Core value dari Runos sebagai smart running app

Fokus utama:

- Insight over data
- Simplicity over complexity
- Guidance over numbers

---
