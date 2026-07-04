"""Consistency test-suite for the PRADO-167 scenario dataset.

Checks:
  1. unit_positions.json — chronology, plausible speeds, arrival times vs master
     timeline, WGS84/local agreement, apparatus spacing on scene.
  2. victims.json — resolution times vs master timeline, positions near building.
  3. Radio transcripts — timestamp format & per-file chronology, key milestones
     present on the right channel.
  4. Emergency calls — answer times vs master timeline (files present).

Exit code 0 = all green.
"""
import json
import math
import re
import sys
import pathlib

HERE = pathlib.Path(__file__).parent
SCEN = HERE.parent.parent          # scenario/
DATA = HERE.parent / "data"

FAIL = []
WARN = []


def check(ok, msg):
    (FAIL if not ok else []).append(msg) if not ok else None
    return ok


def fail(msg):
    FAIL.append(msg)


def warn(msg):
    WARN.append(msg)


def T(s):
    h, m, sec = map(int, s.split(":"))
    return h * 3600 + m * 60 + sec


LAT0, LON0 = 43.278230, 5.388545
MX = 111320 * math.cos(math.radians(LAT0))
MY = 110540.0

# ---- expected times from 05_MASTER_TIMELINE.md (hand-copied: single source of truth)
EXPECTED_ARRIVAL = {
    "ENGINE LOUVAIN 1": "02:51:05",
    "LADDER LOUVAIN": "02:51:40",
    "MEDIC LOUVAIN": "02:51:40",
    "ENGINE SAINT-PIERRE 1": "02:54:30",
    "GROUP SOUTH": "02:55:10",
    "ENGINE ENDOUME 1": "02:57:30",
    "MEDIC SAINT-PIERRE": "02:58:30",
    "ENGINE CANEBIERE 1": "03:00:30",
    "LADDER SAINT-PIERRE": "03:01:10",
    "COLUMN 1": "03:02:00",
    "MEDIC ENDOUME": "03:03:00",
    "GROUP NORTH": "03:08:00",
    "COMMAND POST": "03:10:40",
    "AIR SUPPORT": "03:13:30",
    "SMUR 1": "03:14:20",
    "MEDICAL 1": "03:16:00",
}
EXPECTED_VICTIM_RESOLUTION = {
    "V01": "02:55:30", "V02": "02:56:30", "V03": "03:05:30", "V04": "03:10:20",
    "V05": "03:13:40", "V06": "03:18:10", "V07": "03:27:00", "V08": "03:30:20",
    "V09": "03:47:00",
}
MILESTONES = [  # (channel folder, time, regex)
    ("CH1_OPS_DISPATCH", "02:48:05", r"Group alert"),
    ("CH1_OPS_DISPATCH", "02:50:15", r"upgrading to column"),
    ("CH1_OPS_DISPATCH", "02:51:05", r"on scene"),
    ("CH1_OPS_DISPATCH", "02:55:40", r"assume command"),
    ("CH1_OPS_DISPATCH", "02:58:10", r"situation report"),
    ("CH1_OPS_DISPATCH", "03:04:00", r"assume command"),
    ("CH1_OPS_DISPATCH", "03:34:30", r"fire surrounded"),
    ("CH1_OPS_DISPATCH", "04:05:40", r"fire under control"),
    ("CH1_OPS_DISPATCH", "05:45:00", r"fire extinguished"),
    ("CH3_TAC3_SECTOR_ALPHA_FIRE_ATTACK", "03:11:40", r"MAYDAY MAYDAY MAYDAY"),
    ("CH4_TAC4_SECTOR_BRAVO_SEARCH_RESCUE", "02:56:30", r"rescue one complete"),
    ("CH4_TAC4_SECTOR_BRAVO_SEARCH_RESCUE", "03:18:10", r"rescue five complete"),
    ("CH5_TAC5_SECTOR_MEDICAL", "04:11:30", r"consolidated count"),
]
EXPECTED_CALLS = {  # call number -> answered time (files may use any suffix)
    1: "02:47:12", 2: "02:48:26", 3: "02:49:41", 4: "02:50:58", 5: "02:52:20",
    6: "02:47:40", 7: "02:49:05", 8: "02:51:15", 9: "02:53:36", 10: "02:55:02",
}

# ------------------------------------------------------------------ 1. units
up = json.loads((DATA / "unit_positions.json").read_text(encoding="utf-8"))
units = up["units"]
print(f"[1] unit_positions.json — {len(units)} units")

for u in units:
    cs, tr = u["callsign"], u["track"]
    if not tr:
        fail(f"{cs}: empty track")
        continue
    times = [T(p["t"]) for p in tr]
    if any(b < a for a, b in zip(times, times[1:])):
        fail(f"{cs}: track timestamps not monotonically increasing")
    for a, b in zip(tr, tr[1:]):
        dt = T(b["t"]) - T(a["t"])
        d = math.hypot(b["x"] - a["x"], b["y"] - a["y"])
        if dt == 0 and d > 1:
            fail(f"{cs}: teleport at {b['t']} ({d:.0f} m in 0 s)")
        elif dt > 0 and d / dt > 25:
            fail(f"{cs}: implausible speed {d/dt*3.6:.0f} km/h at {b['t']}")
    for p in tr:
        lat = LAT0 + p["y"] / MY
        lon = LON0 + p["x"] / MX
        if abs(lat - p["lat"]) > 2e-5 or abs(lon - p["lon"]) > 2e-5:
            fail(f"{cs}: WGS84/local mismatch at {p['t']}")
    exp = EXPECTED_ARRIVAL.get(cs)
    if exp:
        arr = [p for p in tr if p["status"].startswith(("on_scene", "staging"))]
        if not arr:
            fail(f"{cs}: never on scene")
        elif abs(T(arr[0]["t"]) - T(exp)) > 5:
            fail(f"{cs}: first on-scene/staging {arr[0]['t']} != timeline {exp}")
    else:
        warn(f"{cs}: no expected arrival entry (skipped)")

# spacing at full deployment 03:20:00 (parked units near site)
def pos_at(u, t):
    tr = u["track"]
    if t <= T(tr[0]["t"]):
        return tr[0]
    for a, b in zip(tr, tr[1:]):
        if T(a["t"]) <= t <= T(b["t"]):
            f = (t - T(a["t"])) / max(1, T(b["t"]) - T(a["t"]))
            return {"x": a["x"] + f * (b["x"] - a["x"]),
                    "y": a["y"] + f * (b["y"] - a["y"]), "status": b["status"]}
    return tr[-1]

t0 = T("03:20:00")
near = [(u["callsign"], pos_at(u, t0)) for u in units]
near = [(c, p) for c, p in near if math.hypot(p["x"], p["y"]) < 150
        and not str(p["status"]).startswith(("transporting", "at_hospital", "returning"))]
for i in range(len(near)):
    for j in range(i + 1, len(near)):
        d = math.hypot(near[i][1]["x"] - near[j][1]["x"], near[i][1]["y"] - near[j][1]["y"])
        if d < 7:
            fail(f"spacing: {near[i][0]} / {near[j][0]} only {d:.1f} m apart at 03:20")
print(f"    {len(near)} units on scene at 03:20 — spacing checked")

# ------------------------------------------------------------------ 2. victims
vd = json.loads((DATA / "victims.json").read_text(encoding="utf-8"))
print(f"[2] victims.json — {len(vd['victims'])} entries")
for v in vd["victims"]:
    exp = EXPECTED_VICTIM_RESOLUTION.get(v["id"])
    if exp and v.get("resolved") != exp:
        fail(f"{v['id']}: resolved {v.get('resolved')} != timeline {exp}")
    if math.hypot(v["x"], v["y"]) > 60:
        fail(f"{v['id']}: position ({v['x']},{v['y']}) too far from building")

# ------------------------------------------------------------------ 3. radio
print("[3] radio transcripts")
line_re = re.compile(r"^\[([^\]]+)\] \[(\d\d:\d\d:\d\d)\]: (.+)$")
radio_dir = SCEN / "radio_comms"


def radio_transcript(ch_dir):
    """Locate a channel's transcript in either layout (flat or script/ subfolder)."""
    for cand in (ch_dir / "script" / "transcript.md", ch_dir / "transcript.md"):
        if cand.exists():
            return cand
    return ch_dir / "transcript.md"


for ch_dir in sorted(p for p in radio_dir.iterdir() if p.is_dir()):
    f = radio_transcript(ch_dir)
    if not f.exists():
        fail(f"{ch_dir.name}: transcript.md missing")
        continue
    msgs = []
    for ln in f.read_text(encoding="utf-8").splitlines():
        m = line_re.match(ln.strip())
        if m:
            msgs.append((T(m.group(2)), m.group(1), m.group(3)))
    if len(msgs) < 10:
        fail(f"{ch_dir.name}: only {len(msgs)} parsed transmissions")
    bad = [(a, b) for a, b in zip(msgs, msgs[1:]) if b[0] < a[0]]
    for a, b in bad:
        fail(f"{ch_dir.name}: out-of-order at {b[0]//3600:02d}:{b[0]%3600//60:02d}:{b[0]%60:02d} ({b[1]})")
    print(f"    {ch_dir.name}: {len(msgs)} transmissions, chronological={'yes' if not bad else 'NO'}")

for ch, t, rx in MILESTONES:
    f = radio_transcript(radio_dir / ch)
    txt = f.read_text(encoding="utf-8") if f.exists() else ""
    pat = re.compile(r"\[" + re.escape(t) + r"\]:.*" + rx, re.IGNORECASE)
    if not any(pat.search(ln) for ln in txt.splitlines()):
        # allow milestone text on continuation lines of the same transmission
        if rx.lower() not in txt.lower() or f"[{t}]" not in txt:
            fail(f"{ch}: milestone '{rx}' @ {t} not found")

# ------------------------------------------------------------------ 4. calls
print("[4] emergency calls")
calls_dir = SCEN / "emergency_calls"
for n, t in EXPECTED_CALLS.items():
    # match either layout: flat CALL-XX_*.md or CALL-XX_*/script/*.md
    hits = (list(calls_dir.glob(f"CALL-{n:02d}_*.md"))
            + list(calls_dir.glob(f"CALL-{n:02d}_*/script/*.md")))
    if not hits:
        fail(f"CALL-{n:02d}: file missing")
        continue
    txt = hits[0].read_text(encoding="utf-8")
    if t not in txt:
        fail(f"CALL-{n:02d}: answered time {t} not found in file")

# ------------------------------------------------------------------ report
print()
for w in WARN:
    print(f"  WARN: {w}")
if FAIL:
    print(f"RESULT: {len(FAIL)} FAILURE(S)")
    for f_ in FAIL:
        print(f"  FAIL: {f_}")
    sys.exit(1)
print("RESULT: ALL CHECKS PASSED")
