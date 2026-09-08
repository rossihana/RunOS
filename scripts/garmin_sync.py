# -*- coding: utf-8 -*-
"""RunOS: sinkronisasi aktivitas lari Garmin Connect -> Supabase (Postgres).

Pemakaian (pakai venv garmin-hermes):
  D:/tools/garmin-hermes/Scripts/python.exe D:/PROJECT/RunOS/scripts/garmin_sync.py            # sync ringkas (semua riwayat)
  D:/tools/garmin-hermes/Scripts/python.exe D:/PROJECT/RunOS/scripts/garmin_sync.py --days 30  # sync aktivitas 30 hari terakhir saja
  D:/tools/garmin-hermes/Scripts/python.exe D:/PROJECT/RunOS/scripts/garmin_sync.py --details  # + splits km / polyline / streams detail
  D:/tools/garmin-hermes/Scripts/python.exe D:/PROJECT/RunOS/scripts/garmin_sync.py --details --max-detail 10

Kredensial dibaca dari scripts/garmin_sync.env (GARMIN_EMAIL, GARMIN_PASSWORD, DATABASE_URL).
Idempoten: aman dijalankan berulang / via cron.
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
TOKENSTORE = os.path.join(HERE, ".garmin_tokens")  # sesi login dipakai ulang (hindari rate-limit SSO)

# Kategori best effort (nama = yang dipakai Dashboard & AI coach)
BE_CATEGORIES = [
    ("5K", 5000.0), ("10K", 10000.0), ("15K", 15000.0), ("20K", 20000.0),
    ("Half-Marathon", 21097.5), ("30K", 30000.0), ("Marathon", 42195.0), ("50K", 50000.0),
]

def read_env(path):
    env = {}
    try:
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env

ENV = read_env(os.path.join(HERE, "garmin_sync.env"))

def need(key):
    val = ENV.get(key) or os.environ.get(key)
    if not val:
        raise SystemExit(f"❌ {key} tidak ditemukan (garmin_sync.env / environment)")
    return val

# ─── Mapping Garmin -> skema RunOS ───

def map_summary(a):
    """List activity Garmin -> tuple untuk INSERT activities."""
    dist = a.get("distance") or 0
    speed = a.get("averageSpeed") or 0
    pace = None
    if speed > 0:
        sec_per_km = 1000 / speed
        pace = f"{int(sec_per_km // 60)}:{int(round(sec_per_km % 60)):02d}"
    cadence = a.get("averageRunningCadenceInStepsPerMinute")
    start_gmt = a.get("startTimeGMT")
    return (
        a["activityId"],
        (a.get("activityName") or "Run").strip(),
        dist,
        a.get("movingDuration") or a.get("duration"),
        a.get("duration"),
        speed or None,
        pace,
        a.get("maxSpeed"),
        a.get("averageHR"),
        a.get("maxHR"),
        a.get("elevationGain"),
        # Garmin SPM = langkah satu kaki/menit; skema RunOS memakai full cadence (dua kaki)
        round(cadence * 2) if cadence else None,
        start_gmt,
        a.get("startTimeLocal"),
    )

def map_splits(raw_splits):
    """Garmin splits response (lapDTOs) -> format yang dibaca frontend RunOS.
    Frontend pakai: split, distance, duration, average_speed, average_heartrate."""
    if isinstance(raw_splits, dict):
        raw_splits = raw_splits.get("lapDTOs")
    out = []
    for i, s in enumerate(raw_splits or [], 1):
        if not isinstance(s, dict):
            continue
        out.append({
            "split": i,
            "distance": s.get("distance"),
            "duration": s.get("duration"),
            "average_speed": s.get("averageSpeed"),
            "average_heartrate": s.get("averageHR"),
        })
    return out or None

def streams_to_dict(details):
    """Garmin activity details -> {latlng:{data}, distance:{data}, heartrate:{data},
    altitude:{data}, velocity_smooth:{data}} — bentuk yang dibaca ActivityDetail.tsx.
    PENTING: payload JSON Garmin sudah dalam satuan final (meter, m/s, bpm, spm,
    derajat) — unit.factor JANGAN diterapkan (terverifikasi empiris: sumDistance
    mentah = total jarak persis, directSpeed mentah = averageSpeed persis)."""
    md = details.get("metricDescriptors") or []
    rows = details.get("activityDetailMetrics") or []
    idx = {d.get("key"): d.get("metricsIndex") for d in md if d.get("key")}

    def row_metrics(r):
        m = r.get("metrics") if isinstance(r, dict) else r
        return m if isinstance(m, list) else None

    def col(key):
        i = idx.get(key)
        if i is None:
            return None
        out = []
        for r in rows:
            m = row_metrics(r)
            # None dipertahankan supaya indeks sejajar dengan sumDistance (chart FE per-titik)
            if m and i < len(m):
                out.append(m[i])
        return out or None

    lat_i, lon_i = idx.get("directLatitude"), idx.get("directLongitude")
    latlng = None
    if lat_i is not None and lon_i is not None:
        latlng = []
        for r in rows:
            m = row_metrics(r)
            if m and lat_i < len(m) and lon_i < len(m) and m[lat_i] is not None and m[lon_i] is not None:
                latlng.append([m[lat_i], m[lon_i]])

    poly = (details.get("geoPolylineDTO") or {}).get("polyline") or []
    if not latlng and poly:
        latlng = [[p.get("lat"), p.get("lon")] for p in poly
                  if isinstance(p, dict) and p.get("lat") is not None and p.get("lon") is not None]

    cadence = col("directDoubleCadence") or col("directRunCadence")
    streams = {
        "latlng": {"data": latlng} if latlng else None,
        "distance": {"data": col("sumDistance")} if col("sumDistance") else None,
        "time": {"data": col("directTimestamp")} if col("directTimestamp") else None,
        "heartrate": {"data": col("directHeartRate")} if col("directHeartRate") else None,
        "altitude": {"data": col("directElevation")} if col("directElevation") else None,
        "velocity_smooth": {"data": col("directSpeed")} if col("directSpeed") else None,
        "cadence": {"data": cadence} if cadence else None,
    }
    streams = {k: v for k, v in streams.items() if v}
    return streams or None

def encode_polyline(latlngs):
    """List [lat,lng] -> Google encoded polyline (delta-encoded, untuk map_polyline di Leaflet FE)."""
    result = []
    plat, plng = 0, 0
    for lat, lng in latlngs:
        for num, prev in ((lat, plat), (lng, plng)):
            n = int(round((num - prev) * 1e5))
            n = ~(n << 1) if n < 0 else (n << 1)
            chunks = []
            while n >= 0x20:
                chunks.append(chr((0x20 | (n & 0x1f)) + 63))
                n >>= 5
            chunks.append(chr(n + 63))
            result.append("".join(chunks))
        plat, plng = lat, lng
    return "".join(result)

def compute_best_efforts(splits, categories=BE_CATEGORIES):
    """Splits per-km -> {kategori: detik tercepat} via sliding window.
    splits: [{distance, duration}, ...] sejajar urutan tempuh.
    ponytail: granularitas 1 km (splits Garmin per-km) + window bisa overshoot
    ≤1 km — konsisten antar-run jadi perbandingan tetap adil; upgrade: pakai streams sumDistance detik-precise."""
    if not splits:
        return {}
    dists = [float(s.get("distance") or 0) for s in splits]
    durs = [float(s.get("duration") or 0) for s in splits]
    n = len(dists)
    pd = [0.0] * (n + 1)
    pt = [0.0] * (n + 1)
    for i in range(n):
        pd[i + 1] = pd[i] + dists[i]
        pt[i + 1] = pt[i] + durs[i]
    best = {}
    for name, D in categories:
        bt = None
        j = 1
        for i in range(n):
            if j < i + 1:
                j = i + 1
            while j <= n and pd[j] - pd[i] < D:
                j += 1
            if j > n:
                break
            t = pt[j] - pt[i]
            if bt is None or t < bt:
                bt = t
        if bt:
            best[name] = int(round(bt))
    return best

BE_UPSERT_SQL = """
INSERT INTO best_efforts (user_id, name, distance, elapsed_time, moving_time, start_date, start_date_local, garmin_activity_id)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT (user_id, name) DO UPDATE SET
  distance = EXCLUDED.distance,
  elapsed_time = EXCLUDED.elapsed_time,
  moving_time = EXCLUDED.moving_time,
  start_date = EXCLUDED.start_date,
  start_date_local = EXCLUDED.start_date_local,
  garmin_activity_id = EXCLUDED.garmin_activity_id
WHERE EXCLUDED.elapsed_time < best_efforts.elapsed_time
"""

def compute_best_efforts_from_streams(streams, categories=BE_CATEGORIES):
    """Best efforts presisi dari streams (distance kumulatif + waktu per titik).
    Waktu antar titik: dari directTimestamp asli bila tersedia (exact); fallback:
    integrasi Δd/velocity_smooth. Semantik: moving time (Δt hanya dihitung saat
    jarak benar-benar maju — segmen berhenti/pause tidak menambah waktu)."""
    d = (streams or {}).get("distance", {}).get("data")
    if not d or len(d) < 2:
        return {}
    v = (streams or {}).get("velocity_smooth", {}).get("data")
    tm = (streams or {}).get("time", {}).get("data")
    use_tm = bool(tm) and len(tm) >= len(d) and all(x is not None for x in tm[:len(d)])
    if not use_tm and (not v or len(v) < 2):
        return {}
    arrs = [tm] if use_tm else [d, v]
    n = min(len(a) for a in arrs)
    d = [float(x or 0) for x in d[:n]]
    if use_tm:
        tm = [float(x) for x in tm[:n]]
    else:
        v = [float(x or 0) for x in v[:n]]

    # Waktu kumulatif per titik
    t = [0.0] * n
    for k in range(1, n):
        dd = d[k] - d[k - 1]
        if use_tm:
            dt = (tm[k] - tm[k - 1]) / 1000.0
            # Skip hanya stall gap sungguhan (autopause/resume: lompatan >20 dtk tanpa jarak).
            # GPS jitter 1 detik & detik jalan lambat TETAP dihitung (aturan dd>0.5 terbukti
            # membuang 350-an detik → PR palsu lebih cepat dari Garmin).
            stall = dt > 20.0 and dd < 20.0
            t[k] = t[k - 1] + (0.0 if stall else max(dt, 0.0))
        else:
            vv = (v[k - 1] + v[k]) / 2.0
            t[k] = t[k - 1] + (dd / vv if dd > 0 and vv > 0.1 else 0.0)

    best = {}
    for name, D in categories:
        bt = None
        j = 1
        for i in range(n - 1):
            target = d[i] + D
            if target > d[n - 1]:
                break  # sisa jarak tak cukup; d monotonik → i berikutnya pasti gagal
            if j < i + 1:
                j = i + 1
            while j < n and d[j] < target:
                j += 1
            if j >= n:
                break
            dd = d[j] - d[j - 1]
            frac = (target - d[j - 1]) / dd if dd > 0 else 0.0
            end_t = t[j - 1] + frac * (t[j] - t[j - 1])
            tc = end_t - t[i]  # durasi window, bukan waktu absolut
            if bt is None or tc < bt:
                bt = tc
        if bt:
            best[name] = int(round(bt))
    return best

def sync_best_efforts(conn, user_id):
    """Hitung ulang SEMUA best efforts: presisi dari streams, fallback sliding-window splits.
    Full recompute: hapus dulu lalu insert — guard 'hanya jika lebih cepat' tidak dipakai
    di sini (nilai salah dari algoritma lama tidak akan bisa tertimpa oleh yang benar)."""
    cur = conn.cursor()
    cur.execute("DELETE FROM best_efforts WHERE user_id = %s", (user_id,))
    cur.execute("""
        SELECT id, start_date, COALESCE(start_date_local, start_date::date::text), splits, streams
        FROM activities
        WHERE user_id = %s AND splits IS NOT NULL
        ORDER BY start_date ASC
    """, (user_id,))
    rows = cur.fetchall()

    def parse(x):
        if isinstance(x, str):
            try:
                return json.loads(x)
            except Exception:
                return None
        return x

    found = 0
    for act_id, start_date, start_local, splits_raw, streams_raw in rows:
        be = compute_best_efforts_from_streams(parse(streams_raw))
        if not be:
            sp = parse(splits_raw)
            be = compute_best_efforts(sp if isinstance(sp, list) else None)
        if not be:
            continue
        for name, secs in be.items():
            cat_dist = dict(BE_CATEGORIES)[name]
            cur.execute(BE_UPSERT_SQL, (user_id, name, cat_dist, secs, secs, start_date, start_local, act_id))
            found += 1
    conn.commit()
    return found

# ─── DB ───

UPSERT_SQL = """
INSERT INTO activities (
  user_id, garmin_activity_id, name, distance, moving_time, elapsed_time,
  average_speed, average_pace, max_speed, average_heartrate, max_heartrate,
  elevation_gain, cadence, start_date, start_date_local, map_polyline, details_fetched
) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT (garmin_activity_id) DO UPDATE SET
  name = EXCLUDED.name,
  distance = EXCLUDED.distance,
  moving_time = EXCLUDED.moving_time,
  elapsed_time = EXCLUDED.elapsed_time,
  average_speed = EXCLUDED.average_speed,
  average_pace = EXCLUDED.average_pace,
  max_speed = EXCLUDED.max_speed,
  average_heartrate = EXCLUDED.average_heartrate,
  max_heartrate = EXCLUDED.max_heartrate,
  elevation_gain = EXCLUDED.elevation_gain,
  cadence = COALESCE(EXCLUDED.cadence, activities.cadence),
  start_date = EXCLUDED.start_date,
  start_date_local = EXCLUDED.start_date_local,
  map_polyline = COALESCE(activities.map_polyline, EXCLUDED.map_polyline)
"""

DETAIL_UPDATE_SQL = """
UPDATE activities
SET splits = %s,
    streams = %s,
    map_polyline = COALESCE(NULLIF(map_polyline, ''), %s),
    details_fetched = TRUE
WHERE garmin_activity_id = %s
"""

def get_db():
    """Koneksi Postgres dari DATABASE_URL.
    Password boleh mengandung '@' — diparse manual (RFC: userinfo = bagian sebelum '@' TERAKHIR)."""
    import psycopg2
    from urllib.parse import urlsplit, unquote
    u = urlsplit(need("DATABASE_URL"))
    userinfo = u.username or "", unquote(u.password) if u.password else ""
    user, password = userinfo
    conn = psycopg2.connect(
        user=user, password=password,
        host=u.hostname, port=u.port or 5432, dbname=u.path.lstrip("/"),
        sslmode="require",
    )
    return conn

def get_user_id(conn):
    """Pilih user pemilik data: yang punya aktivitas terbanyak (fallback: user pertama)."""
    cur = conn.cursor()
    cur.execute("""SELECT u.id FROM users u
                   LEFT JOIN activities a ON a.user_id = u.id
                   GROUP BY u.id ORDER BY count(a.id) DESC, u.id LIMIT 1""")
    row = cur.fetchone()
    if not row:
        raise SystemExit("❌ Belum ada user di tabel users — daftar dulu via aplikasi RunOS.")
    return row[0]

# ─── Main ───

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=None, help="hanya aktivitas N hari terakhir")
    ap.add_argument("--details", action="store_true", help="ambil splits/polyline/streams per aktivitas")
    ap.add_argument("--max-detail", type=int, default=25, help="batas fetch detail per run (default 25)")
    ap.add_argument("--best-efforts", action="store_true", help="hitung ulang best efforts dari splits (tanpa akses Garmin)")
    args = ap.parse_args()

    conn = get_db()
    user_id = get_user_id(conn)

    if args.best_efforts:
        n = sync_best_efforts(conn, user_id)
        print(f"🏅 Best efforts diperbarui: {n} evaluasi kategori (user_id={user_id})")
        conn.close()
        print("✅ Selesai")
        return

    from garminconnect import Garmin
    c = Garmin(email=need("GARMIN_EMAIL"), password=need("GARMIN_PASSWORD"))
    c.login(tokenstore=TOKENSTORE)  # load token lama kalau ada; kalau tak ada -> login kredensial
    try:
        c.client.dump(TOKENSTORE)  # simpan sesi untuk run berikutnya
    except Exception:
        pass
    print("✅ Login Garmin ok")

    # Kumpulkan semua run (paginasi, garminconnect max 1000/page)
    runs, start = [], 0
    while True:
        batch = c.get_activities(start, 1000)
        if not batch:
            break
        runs.extend(a for a in batch if a.get("activityType", {}).get("typeKey") == "running")
        if len(batch) < 1000:
            break
        start += 1000

    if args.days:
        import datetime
        cutoff = datetime.date.today() - datetime.timedelta(days=args.days)
        runs = [a for a in runs if a["startTimeLocal"][:10] >= cutoff.isoformat()]

    print(f"🏃 {len(runs)} aktivitas lari dari Garmin")

    cur = conn.cursor()
    for a in runs:
        row = map_summary(a)
        # details_fetched default FALSE saat insert baru
        cur.execute(UPSERT_SQL, (user_id,) + row[:15] + (None, False))
    conn.commit()
    print(f"⬆️  {len(runs)} aktivitas tersimpan ke Supabase (user_id={user_id})")

    if args.details:
        cur.execute("""
            SELECT garmin_activity_id FROM activities
            WHERE user_id = %s AND (details_fetched = FALSE OR details_fetched IS NULL OR splits IS NULL)
            ORDER BY start_date DESC LIMIT %s
        """, (user_id, args.max_detail))
        ids = [r[0] for r in cur.fetchall()]
        print(f"🔍 Fetch detail untuk {len(ids)} aktivitas")
        for gid in ids:
            try:
                splits_raw = c.get_activity_splits(str(gid))
                splits = map_splits(splits_raw)

                details = c.get_activity_details(str(gid), maxchart=2000, maxpoly=4000)
                streams = streams_to_dict(details)

                latlng = (streams or {}).get("latlng", {}).get("data")
                polyline = encode_polyline(latlng) if latlng else None

                cur.execute(DETAIL_UPDATE_SQL, (
                    json.dumps(splits) if splits else None,
                    json.dumps(streams) if streams else None,
                    polyline,
                    gid,
                ))
                conn.commit()
                time.sleep(1.0)  # jangan banting Garmin Connect
                print(f"   ✓ {gid}: splits={'y' if splits else 'n'} streams={'y' if streams else 'n'}")
            except Exception as e:
                conn.rollback()
                print(f"   ✗ {gid}: {type(e).__name__}: {str(e)[:120]}")

    cur.close()

    # Best efforts otomatis diperbarui tiap sync (murni dari splits, tanpa API tambahan)
    n = sync_best_efforts(conn, user_id)
    print(f"🏅 Best efforts: {n} evaluasi kategori")

    conn.close()
    print("✅ Selesai")

if __name__ == "__main__":
    main()
