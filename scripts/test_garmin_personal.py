# -*- coding: utf-8 -*-
"""Self-check jalur Personal API garmin_sync.py — TANPA jaringan/DB (kontrak Fase 1,
docs/plans/garmin-personal-api-migration.md). Fixture anonim dari respons nyata.
Jalankan: python test_garmin_personal.py"""
import io
import os
import sys
import types
import urllib.error
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garmin_sync as gs

# ── fixture anonim (bentuk = respons nyata 2026-10-26; nilai diubah) ──
FAKE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.sig"
KEY = "test-key-1234567890"

ACT = {
    "activityId": 111222333,
    "activityName": "Contoh Lari",
    "startTimeLocal": "2026-10-25 06:13:30",
    "startTimeGMT": "2026-10-24T23:13:30.000Z",
    "activityType": {"typeKey": "running", "typeId": 1},  # PA: dict dgn typeKey
    "distance": 7188.46,
    "duration": 3661.547,
    "movingDuration": 3594.518,
    "averageSpeed": 1.9632,
    "maxSpeed": 3.4,
    "averageHR": 130.0,
    "maxHR": 148.0,
    "elevationGain": 29.0,
    "averageRunningCadenceInStepsPerMinute": 156.65625,
    "calories": 480,
    "locationName": "Kota Contoh",
}
ACT2 = dict(ACT, activityId=444555666, distance=5000.0, startTimeGMT="2026-10-20T23:00:00.000Z",
            startTimeLocal="2026-10-21 06:00:00")  # running kedua (typeKey sama)
WALK = dict(ACT, activityId=777888999, activityType={"typeKey": "walking"})

failures = []
def check(name, cond):
    print(("  ✓ " if cond else "  ✗ ") + name)
    if not cond:
        failures.append(name)

# ── ① mint token: plain-text JWT → token; error tanpa echo key ──
import urllib.request  # patch global — fungsi gs melakukan import lokal ke modul yang sama
class FakeResp:
    def __init__(self, body):
        self.body = body if isinstance(body, bytes) else body.encode()
    def read(self):
        return self.body

def fake_urlopen_ok(req, timeout=0):
    assert req.get_header("Authorization") == "ApiKey " + KEY
    return FakeResp(FAKE_JWT)

orig = urllib.request.urlopen
urllib.request.urlopen = fake_urlopen_ok
try:
    tok = gs.mint_pa_token(KEY)
    check("① mint: plain-text JWT → token utuh", tok == FAKE_JWT)

    def fake_urlopen_err(req, timeout=0):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, io.BytesIO(b"no"))
    urllib.request.urlopen = fake_urlopen_err
    try:
        gs.mint_pa_token(KEY)
        check("① mint: HTTP 401 harus gagal", False)
    except SystemExit as e:
        check("① mint: error 401 → SystemExit", True)
        check("① mint: key TIDAK ikut dalam pesan", KEY not in str(e))
finally:
    urllib.request.urlopen = orig

# ── ② pemetaan field: fixture PA → map_summary (nilai persis) ──
row = gs.map_summary(ACT)
check("② map: jarak", row[2] == 7188.46)
check("② map: moving/elapsed", row[3] == 3594.518 and row[4] == 3661.547)
sec_km = 1000 / 1.9632
check("② map: pace", row[6] == f"{int(sec_km // 60)}:{int(round(sec_km % 60)):02d}")
check("② map: averageHR/maxHR", row[8] == 130.0 and row[9] == 148.0)
check("② map: kadensi dibulatkan", row[11] == 157)
check("② map: start GMT/Local", row[12] == "2026-10-24T23:13:30.000Z" and row[13] == "2026-10-25 06:13:30")

# ── ③ paginasi + filter: halaman penuh → lanjut; halaman pendek → stop; tanpa duplikat ──
page0 = [ACT] * 99 + [WALK]          # 100 item = penuh → lanjut ke halaman 2
pages = {
    0: page0,
    100: [ACT2, ACT],                # pendek → stop; ACT duplikat → ditolak
}
fetched = []
def fake_pa_get(tok, path, timeout=0):
    start = int(path.split("start=")[1].split("&")[0])
    fetched.append(start)
    return pages.get(start, [])
gs.pa_get = fake_pa_get
runs = gs.pa_fetch_runs(FAKE_JWT)
check("③ paginasi: 2 halaman dikunjungi (penuh→lanjut, pendek→stop)", fetched == [0, 100])
check("③ paginasi: hanya running", all(gs.pa_activity_type_key(a) == "running" for a in runs))
check("③ paginasi: tanpa duplikat", len(runs) == 2 and len({a["activityId"] for a in runs}) == 2)

# ── ③ idempotensi: upsert 2× fixture sama → SQL & param identik (ON CONFLICT) ──
class FakeCursor:
    def __init__(self):
        self.calls = []
    def execute(self, sql, params=None):
        self.calls.append((sql, params))
class FakeConn:
    def __init__(self):
        self.cursor_obj = FakeCursor()
        self.commits = 0
    def cursor(self):
        return self.cursor_obj
    def commit(self):
        self.commits += 1

check("③ idempotensi: UPSERT memakai ON CONFLICT (garmin_activity_id)",
      "ON CONFLICT (garmin_activity_id)" in gs.UPSERT_SQL)

# ── ④ FIT download: ZIP berisi .fit → disimpan; tanpa .fit → None ──
def fake_urlopen_zip(req, timeout=0):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("111222333_ACTIVITY.fit", b"\x0cFIT-binary-data-fixture")
    return FakeResp(buf.getvalue())
urllib.request.urlopen = fake_urlopen_zip
tmpdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tmp_fit_test")
try:
    out = gs.pa_download_fit(FAKE_JWT, 111222333, tmpdir)
    check("④ FIT: ZIP → file .fit tersimpan", out and os.path.exists(out)
          and open(out, "rb").read() == b"\x0cFIT-binary-data-fixture")

    def fake_urlopen_nofit(req, timeout=0):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("readme.txt", "bukan fit")
        return FakeResp(buf.getvalue())
    urllib.request.urlopen = fake_urlopen_nofit
    check("④ FIT: ZIP tanpa .fit → None", gs.pa_download_fit(FAKE_JWT, 999, tmpdir) is None)
finally:
    urllib.request.urlopen = orig
    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)

# ── ⑤ regresi jalur lama: test_garmin_sync.py existing tetap lulus ──
import subprocess
r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_garmin_sync.py")],
                   capture_output=True, text=True)
check("⑤ regresi: test_garmin_sync.py lulus", r.returncode == 0)

# ── ⑥ Fase 3: FIT → GPS → polyline (fixture asli lokal; skip bila tidak ada/fitdecode tak ada) ──
import importlib.util
FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".garmin_fit", "111222333.fit")
if not importlib.util.find_spec("fitdecode"):
    print("  - ⑥ fitdecode tidak terpasang di interpreter ini — tes FIT dilewati")
elif os.path.exists(FIXTURE):
    latlng = gs.pa_fit_to_latlng(FIXTURE)
    check("⑥ FIT asli: titik GPS > 0", len(latlng) > 0)
    check("⑥ FIT asli: koordinat dalam rentang masuk akal",
          all(-90 <= la <= 90 and -180 <= lo <= 180 for la, lo in latlng))
    poly = gs.encode_polyline(latlng)
    check("⑥ polyline terenkode non-kosong", len(poly) > 20)
else:
    print("  - ⑥ fixture FIT lokal tidak ada (scripts/.garmin_fit/111222333.fit) — tes dilewati")

# ── ⑦⑧ pa_sync_polylines: graceful tanpa GPS & saat FIT rusak ──
class FakeCursor3:
    def __init__(self): self.calls = []
    def execute(self, sql, params=None): self.calls.append((sql, params))
class FakeConn3:
    def __init__(self): self.cur = FakeCursor3()
    def cursor(self): return self.cur
    def commit(self): pass

tmpdir2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tmp_fit_test2")
import shutil
import urllib.request as _ur
shutil.rmtree(tmpdir2, ignore_errors=True)
urllib.request.urlopen = orig  # pastikan kondisi bersih dulu
orig_fit = gs.pa_fit_to_latlng

# ⑦ FIT valid tapi tanpa record GPS → polyline kosong, dilewati
def fake_zip_ok(req, timeout=0):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("1_ACTIVITY.fit", b"\x0cfit-valid-mock")
    return FakeResp(buf.getvalue())
urllib.request.urlopen = fake_zip_ok
gs.pa_fit_to_latlng = lambda p: []
try:
    fc = FakeConn3()
    fetched, parsed = gs.pa_sync_polylines(FAKE_JWT, [ACT], tmpdir2, fc)
    check("⑦ tanpa GPS: dilewati tanpa exception, 0 polyline", parsed == 0 and len(fc.cur.calls) == 0)
finally:
    gs.pa_fit_to_latlng = orig_fit
    urllib.request.urlopen = orig

# ⑧ FIT rusak (bukan FIT valid) → error tertangkap, sync lanjut
def fake_zip_garbage(req, timeout=0):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("1_ACTIVITY.fit", b"\x0cgarbage-not-a-fit")
    return FakeResp(buf.getvalue())
urllib.request.urlopen = fake_zip_garbage
try:
    shutil.rmtree(tmpdir2, ignore_errors=True)
    fc = FakeConn3()
    fetched, parsed = gs.pa_sync_polylines(FAKE_JWT, [ACT], tmpdir2, fc)
    check("⑧ FIT rusak: error tertangkap, 0 polyline", parsed == 0)
finally:
    urllib.request.urlopen = orig
shutil.rmtree(tmpdir2, ignore_errors=True)

print()
if failures:
    print(f"❌ GAGAL: {len(failures)} cek:", failures)
    sys.exit(1)
print("✅ SEMUA OK — kontrak Fase 1 terpenuhi")
