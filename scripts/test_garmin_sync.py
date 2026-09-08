# -*- coding: utf-8 -*-
"""Self-check untuk garmin_sync.py: mapping & encoding murni (tanpa jaringan/DB).
Jalankan: python test_garmin_sync.py"""
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from garmin_sync import map_summary, map_splits, streams_to_dict, encode_polyline

# ── map_summary ──
a = {
    "activityId": 12345,
    "activityName": "Morning Run",
    "distance": 5234.5,
    "duration": 1800.0,
    "movingDuration": 1750.0,
    "averageSpeed": 2.9911,  # m/s -> 5:34/km
    "maxSpeed": 4.2,
    "averageHR": 150.3,
    "maxHR": 172,
    "elevationGain": 32.0,
    "averageRunningCadenceInStepsPerMinute": 84.5,
    "startTimeGMT": "2026-09-07T00:30:00.000Z",
    "startTimeLocal": "2026-09-07 07:30:00",
}
row = map_summary(a)
assert row[0] == 12345 and row[1] == "Morning Run"
assert row[3] == 1750.0 and row[4] == 1800.0          # moving, elapsed
assert row[6] == "5:34", row[6]                        # pace 1000/2.9911 = 334.3s
assert row[11] == 169                                  # cadence 84.5*2
assert row[13] == "2026-09-07 07:30:00"

b = dict(a, averageHR=None, averageRunningCadenceInStepsPerMinute=None, averageSpeed=0)
row_b = map_summary(b)
assert row_b[8] is None and row_b[11] is None and row_b[6] is None

# ── map_splits (lapDTOs) ──
raw = {"lapDTOs": [
    {"distance": 1000.0, "duration": 330.0, "averageSpeed": 3.03, "averageHR": 148},
    {"distance": 400.0, "duration": 120.0, "averageSpeed": 3.3, "averageHR": 155},
]}
sp = map_splits(raw)
assert len(sp) == 2
assert sp[0] == {"split": 1, "distance": 1000.0, "duration": 330.0, "average_speed": 3.03, "average_heartrate": 148}
assert map_splits(None) is None and map_splits({"lapDTOs": []}) is None

# ── streams_to_dict (metricDescriptors + activityDetailMetrics) ──
details = {
    "metricDescriptors": [
        {"metricsIndex": 0, "key": "directLatitude", "unit": {"factor": 1.0}},
        {"metricsIndex": 1, "key": "directLongitude", "unit": {"factor": 1.0}},
        {"metricsIndex": 2, "key": "directHeartRate", "unit": {"factor": 1.0}},
        {"metricsIndex": 3, "key": "directSpeed", "unit": {"factor": 0.1}},
        {"metricsIndex": 4, "key": "sumDistance", "unit": {"factor": 100.0}},
    ],
    "activityDetailMetrics": [
        {"metrics": [-6.2, 106.8, 150, 3.0, 100.5]},
        {"metrics": [-6.21, 106.81, 152, 3.1, 1010.0]},
        {"metrics": [-6.22, 106.82, None, 3.2, 2015.5]},
    ],
}
st = streams_to_dict(details)
assert st["latlng"]["data"] == [[-6.2, 106.8], [-6.21, 106.81], [-6.22, 106.82]]
assert st["heartrate"]["data"] == [150, 152, None]  # None dipertahankan (alignment dgn distance)
# PENTING: nilai mentah dipakai apa adanya (sudah satuan final) — factor JANGAN diterapkan
assert st["velocity_smooth"]["data"] == [3.0, 3.1, 3.2]
assert st["distance"]["data"] == [100.5, 1010.0, 2015.5]
assert "altitude" not in st
assert streams_to_dict({}) is None

# fallback geoPolylineDTO
st2 = streams_to_dict({"metricDescriptors": [], "geoPolylineDTO": {"polyline": [
    {"lat": -6.2, "lon": 106.8}, {"lat": -6.21, "lon": 106.81}]}})
assert st2["latlng"]["data"] == [[-6.2, 106.8], [-6.21, 106.81]]

# ── encode_polyline: vektor resmi Google ──
pts = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
assert encode_polyline(pts) == "_p~iF~ps|U_ulLnnqC_mqNvxq`@", encode_polyline(pts)

# ── compute_best_efforts: sliding window ──
from garmin_sync import compute_best_efforts, BE_CATEGORIES

# 10 km: split makin lambat (300s → 390s) → 5K tercepat = split 1-5 = 1600
splits10 = [{"distance": 1000.0, "duration": 300 + i * 10} for i in range(10)]
be = compute_best_efforts(splits10)
assert be["5K"] == 1600, be.get("5K")
# 10K = seluruh run = sum(300..390) = 3450
assert be["10K"] == 3450
assert "Half-Marathon" not in be  # cuma 10 km

# negative split: 5K tercepat = split 6-10 (350+340+330+320+310 = 1650)
splits_neg = [{"distance": 1000.0, "duration": 400 - i * 10} for i in range(10)]
be2 = compute_best_efforts(splits_neg)
assert be2["5K"] == 1650, be2["5K"]

# partial split terakhir (9.5 km run): 5K tercepat = 5 full split pertama = 1500
splits95 = [{"distance": 1000.0, "duration": 300} for _ in range(9)] + [{"distance": 500.0, "duration": 160}]
be3 = compute_best_efforts(splits95)
assert be3["5K"] == 1500, be3["5K"]
assert "10K" not in be3

# splits kosong/rusak
assert compute_best_efforts(None) == {} and compute_best_efforts([]) == {}

# ── compute_best_efforts_from_streams: presisi via integrasi ──
from garmin_sync import compute_best_efforts_from_streams

# konstan 3.0 m/s, titik tiap 100m, total 10 km
N = 101
d_const = [i * 100.0 for i in range(N)]
v_const = [3.0] * N
be_s = compute_best_efforts_from_streams({"distance": {"data": d_const}, "velocity_smooth": {"data": v_const}})
assert be_s["5K"] == 1667, be_s.get("5K")   # 5000/3 = 1666.7
assert be_s["10K"] == 3333, be_s.get("10K") # 10000/3

# half slow (2.5 m/s) half fast (3.5 m/s): 5K tercepat = paruh kedua = 5000/3.5 = 1428.6
d_var = [i * 100.0 for i in range(N)]
v_var = [2.5 if i < 50 else 3.5 for i in range(N)]
be_v = compute_best_efforts_from_streams({"distance": {"data": d_var}, "velocity_smooth": {"data": v_var}})
assert be_v["5K"] == 1429, be_v.get("5K")
# 10K = 2000 + 1428.6 ≈ 3429 (midpoint-integration di transisi diskontinu meleset ~7s → toleransi)
assert 3420 <= be_v["10K"] <= 3438, be_v.get("10K")

# ada pause (v=0, d tidak maju): waktu tidak bertambah
d_p = []; v_p = []
for i in range(11):
    d_p.append(i * 100.0); v_p.append(3.0)
d_p += [1000.0] * 3; v_p += [0.0] * 3          # berhenti 3 titik
for i in range(1, 6):
    d_p.append(1000.0 + i * 100.0); v_p.append(3.0)
be_p = compute_best_efforts_from_streams(
    {"distance": {"data": d_p}, "velocity_smooth": {"data": v_p}},
    categories=[("1K", 1000.0)])
assert be_p["1K"] == 333, be_p.get("1K")       # 1000/3, pause di-skip

# input rusak -> {} (sync otomatis fallback ke splits)
assert compute_best_efforts_from_streams(None) == {}
assert compute_best_efforts_from_streams({"velocity_smooth": {"data": [1, 2]}}) == {}

# ── jalur directTimestamp (exact, seperti Garmin asli) ──
# 100m/point, 3 m/s → tm ms = d/3*1000; window 5K jatuh tepat di point 50
tm_const = [round(i * 100.0 / 3.0 * 1000) for i in range(N)]
be_t = compute_best_efforts_from_streams({"distance": {"data": d_const}, "time": {"data": tm_const}})
assert be_t["5K"] == 1667, be_t.get("5K")
assert be_t["10K"] == 3333, be_t.get("10K")

# pause 30 detik (3 titik × 10 dtk, d diam) DI DALAM window 1K: ikut dihitung
# (jitter 1 dtk tidak boleh dibuang; lihat catatan aturan stall di garmin_sync)
d_p = [i * 100.0 for i in range(5)]            # 0..400m @3m/s (133s)
d_p += [400.0] * 3                              # diam 3×10s
d_p += [400.0 + i * 100.0 for i in range(1, 7)]  # 500..1000m @3m/s (200s)
v_p = [3.0] * 5 + [0.0] * 3 + [3.0] * 6
tm_p = []
for i in range(5):
    tm_p.append(round(i * 100.0 / 3.0 * 1000))
tm_p += [tm_p[-1] + 10000, tm_p[-1] + 20000, tm_p[-1] + 30000]
for i in range(1, 7):
    tm_p.append(tm_p[-1] + round(100.0 / 3.0 * 1000))
be_pt = compute_best_efforts_from_streams(
    {"distance": {"data": d_p}, "time": {"data": tm_p}},
    categories=[("1K", 1000.0)])
assert be_pt["1K"] == 363, be_pt.get("1K")  # 333 + 30s berhenti singkat

# stall gap sungguhan (autopause 60 dtk: 1 titik diam, d tetap): di-skip
d_g = [i * 100.0 for i in range(5)] + [400.0] + [400.0 + i * 100.0 for i in range(1, 7)]
tm_g = [round(i * 100.0 / 3.0 * 1000) for i in range(5)]
tm_g += [tm_g[-1] + 60000]                      # 1 gap 60s (stall)
for i in range(1, 7):
    tm_g.append(tm_g[-1] + round(100.0 / 3.0 * 1000))
be_g = compute_best_efforts_from_streams(
    {"distance": {"data": d_g}, "time": {"data": tm_g}},
    categories=[("1K", 1000.0)])
assert be_g["1K"] == 333, be_g.get("1K")  # gap 60 dtk tidak dihitung

print("✅ Semua self-check lulus")
