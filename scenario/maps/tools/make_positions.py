"""Generate unit_positions.json and victims.json for the PRADO-167 scenario.

Positions are authored in the local metric CRS (metres from the incident-building
centroid, x=east y=north — see site_meta.json) and exported with both local and
WGS84 coordinates. Times must match 05_MASTER_TIMELINE.md — validate_geo.py checks.

Real anchor points (from OSM): fire stations, hospitals. Routes between them are
simplified polylines roughly following the street grid (display interpolation only).
"""
import json
import math
import pathlib

HERE = pathlib.Path(__file__).parent
DATA = HERE.parent / "data"

LAT0, LON0 = 43.278230, 5.388545
MX = 111320 * math.cos(math.radians(LAT0))   # metres per degree lon
MY = 110540.0                                 # metres per degree lat


def wgs(x, y):
    return round(LAT0 + y / MY, 6), round(LON0 + x / MX, 6)


def T(s):  # "hh:mm:ss" -> seconds since midnight
    h, m, sec = map(int, s.split(":"))
    return h * 3600 + m * 60 + sec


# Real anchor points (local metres, from OSM coords)
STATION = {
    "LOUVAIN":      (205, -249),    # CIS Louvain
    "SAINT-PIERRE": (1103, 1582),   # CIS Saint-Pierre
    "CANEBIERE":    (-701, 2132),   # CIS Canebière
    "ENDOUME":      (-2188, 986),   # CIS Endoume
    "SAINT-LAZARE": (-1107, 3098),  # CIS Saint-Lazare
    "HQ":           (-1120, 3179),  # Battalion HQ (état-major)
    "TIMONE":       (953, 1356),    # La Timone hospital (approx)
    "EUROPEEN":     (-2151, 2960),  # Hôpital Européen (approx)
}

# Simplified approach routes (polyline of local points, station -> site area)
ROUTE = {
    "LOUVAIN":      [(205, -249), (190, -120), (120, -14), (10, -11)],
    "SAINT-PIERRE": [(1103, 1582), (700, 900), (250, 300), (50, 60), (-20, 20)],
    "CANEBIERE":    [(-701, 2132), (-400, 1200), (-150, 400), (-60, 50)],
    "ENDOUME":      [(-2188, 986), (-1400, 600), (-600, 200), (-100, 0)],
    "SAINT-LAZARE": [(-1107, 3098), (-600, 1800), (-200, 600), (-50, 80)],
    "HQ":           [(-1120, 3179), (-600, 1800), (-200, 600), (-50, 80)],
    "TIMONE":       [(953, 1356), (500, 700), (150, 150), (-20, -40)],
}


def leg(route, park, t_start, t_end, status="responding", end_status="on_scene"):
    """Waypoints along a route ending at parking position, times interpolated by
    distance. The final waypoint carries end_status (arrival state)."""
    pts = route + [park]
    dists = [0.0]
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dists.append(dists[-1] + math.hypot(x2 - x1, y2 - y1))
    total = dists[-1] or 1.0
    out = []
    for i, (p, d) in enumerate(zip(pts, dists)):
        t = t_start + (t_end - t_start) * d / total
        st = end_status if i == len(pts) - 1 else status
        out.append((round(t), p, st))
    return out


def fmt(t):
    return f"{t//3600:02d}:{t%3600//60:02d}:{t%60:02d}"


UNITS = []


def unit(callsign, utype, station, crew, cdr, waypoints):
    UNITS.append({
        "callsign": callsign,
        "type": utype,
        "station": station,
        "crew": crew,
        "crew_commander": cdr,
        "track": [
            {"t": fmt(t), "x": x, "y": y,
             "lat": wgs(x, y)[0], "lon": wgs(x, y)[1], "status": st}
            for (t, (x, y), st) in waypoints
        ],
    })


def station_hold(name, t):
    return [(T(t), STATION[name], "at_station")]


def onscene(park, t_arrive, t_until, status="on_scene"):
    return [(T(t_arrive), park, status), (T(t_until), park, status)]


# ---------------------------------------------------------------- wave 1
unit("ENGINE LOUVAIN 1", "engine (FPT)", "CIS Louvain", 6, "CPO M. Bouzid",
     station_hold("LOUVAIN", "02:48:05")
     + leg(ROUTE["LOUVAIN"], (-14, -22), T("02:48:50"), T("02:51:05"))
     + [(T("07:00:00"), (-14, -22), "on_scene_fire_watch")])

unit("LADDER LOUVAIN", "aerial ladder (EPA)", "CIS Louvain", 3, "PO1 V. Lange",
     station_hold("LOUVAIN", "02:48:05")
     + leg(ROUTE["LOUVAIN"], (-14, 6), T("02:48:55"), T("02:51:40"))
     + [(T("06:40:00"), (-14, 6), "on_scene"),
        (T("06:55:00"), STATION["LOUVAIN"], "returning")])

unit("MEDIC LOUVAIN", "medic (VSAV)", "CIS Louvain", 3, "PO2 I. Robert",
     station_hold("LOUVAIN", "02:48:05")
     + leg(ROUTE["LOUVAIN"], (-16, -35), T("02:48:55"), T("02:51:40"))
     + [(T("03:05:00"), (-16, -35), "transporting")]
     + leg(list(reversed(ROUTE["TIMONE"])), STATION["TIMONE"],
           T("03:05:10"), T("03:15:00"), "transporting", end_status="at_hospital")
     + [(T("03:32:00"), STATION["TIMONE"], "at_hospital")]
     + leg(ROUTE["TIMONE"], (-16, -35), T("03:32:10"), T("03:42:10"), "returning")
     + [(T("03:58:40"), (-16, -35), "transporting")]
     + leg(list(reversed(ROUTE["TIMONE"]))[:2] + [(-800, 1500)], STATION["EUROPEEN"],
           T("03:58:50"), T("04:10:00"), "transporting", end_status="at_hospital")
     + [(T("04:20:00"), STATION["EUROPEEN"], "at_hospital")]
     + leg([STATION["EUROPEEN"], (-800, 1500), (150, 150)], (-16, -35),
           T("04:20:10"), T("04:35:00"), "returning")
     + [(T("07:00:00"), (-16, -35), "on_scene_fire_watch")])

unit("ENGINE SAINT-PIERRE 1", "engine (FPT)", "CIS Saint-Pierre", 6, "CPO Y. Le Goff",
     station_hold("SAINT-PIERRE", "02:48:05")
     + leg(ROUTE["SAINT-PIERRE"], (30, -11), T("02:49:30"), T("02:54:30"))
     + [(T("06:40:00"), (30, -11), "on_scene"),
        (T("06:55:00"), STATION["SAINT-PIERRE"], "returning")])

unit("GROUP SOUTH", "group commander (VLCG)", "CIS Saint-Pierre", 2, "LT C. Aubry",
     station_hold("SAINT-PIERRE", "02:48:05")
     + leg(ROUTE["SAINT-PIERRE"], (-20, -16), T("02:49:40"), T("02:55:10"))
     + [(T("07:00:00"), (-20, -16), "on_scene_fire_watch")])

# ---------------------------------------------------------------- wave 2
unit("ENGINE ENDOUME 1", "engine (FPT)", "CIS Endoume", 6, "CPO R. Santini",
     station_hold("ENDOUME", "02:50:15")
     + leg(ROUTE["ENDOUME"], (-40, -100), T("02:51:30"), T("02:57:30"), end_status="staging")
     + [(T("02:58:20"), (-40, -100), "staging"),
        (T("02:58:30"), (-14, 32), "on_scene"),
        (T("05:00:45"), (-14, 32), "on_scene"),
        (T("05:15:00"), STATION["ENDOUME"], "returning")])

unit("MEDIC SAINT-PIERRE", "medic (VSAV)", "CIS Saint-Pierre", 3, "PO2 L. Pons",
     station_hold("SAINT-PIERRE", "02:50:15")
     + leg(ROUTE["SAINT-PIERRE"], (-26, -52), T("02:51:00"), T("02:58:30"))
     + [(T("03:36:00"), (-26, -52), "transporting")]
     + leg(list(reversed(ROUTE["TIMONE"])), STATION["TIMONE"],
           T("03:36:10"), T("03:46:00"), "transporting", end_status="at_hospital")
     + [(T("04:12:00"), STATION["TIMONE"], "at_hospital")]
     + leg(ROUTE["TIMONE"], (-26, -52), T("04:12:10"), T("04:25:00"), "returning")
     + [(T("05:30:00"), (-26, -52), "on_scene"),
        (T("05:45:00"), STATION["SAINT-PIERRE"], "returning")])

unit("ENGINE CANEBIERE 1", "engine (FPT)", "CIS Canebière", 6, "CPO A. Fischer",
     station_hold("CANEBIERE", "02:50:15")
     + leg(ROUTE["CANEBIERE"], (-42, -110), T("02:51:30"), T("03:00:30"), end_status="staging")
     + [(T("03:09:50"), (-42, -110), "staging"),
        (T("03:10:30"), (-48, 25), "on_scene"),
        (T("05:00:30"), (-48, 25), "on_scene"),
        (T("05:15:00"), STATION["CANEBIERE"], "returning")])

unit("LADDER SAINT-PIERRE", "aerial ladder (EPA)", "CIS Saint-Pierre", 3, "PO1 G. Moreau",
     station_hold("SAINT-PIERRE", "02:50:15")
     + leg(ROUTE["SAINT-PIERRE"][:4] + [(60, -12)], (8, -11), T("02:51:45"), T("03:01:10"))
     + [(T("06:40:00"), (8, -11), "on_scene"),
        (T("06:55:00"), STATION["SAINT-PIERRE"], "returning")])

unit("COLUMN 1", "column commander (VLCC)", "Battalion HQ", 2, "LCDR A. Verne",
     station_hold("HQ", "02:50:15")
     + leg(ROUTE["HQ"], (-32, -78), T("02:50:40"), T("03:02:00"))
     + [(T("06:10:00"), (-32, -78), "on_scene"),
        (T("06:25:00"), STATION["HQ"], "returning")])

unit("MEDIC ENDOUME", "medic (VSAV)", "CIS Endoume", 3, "PO2 B. Sila",
     station_hold("ENDOUME", "02:50:15")
     + leg(ROUTE["ENDOUME"], (-28, -64), T("02:52:00"), T("03:03:00"))
     + [(T("03:40:00"), (-28, -64), "transporting")]
     + leg([(-100, 0), (-600, 200), (-1400, 600)], STATION["EUROPEEN"],
           T("03:40:10"), T("03:50:00"), "transporting", end_status="at_hospital")
     + [(T("04:00:00"), STATION["EUROPEEN"], "at_hospital")]
     + leg([STATION["EUROPEEN"], (-1400, 600), (-600, 200), (-100, 0)], (-28, -64),
           T("04:00:10"), T("04:10:00"), "returning")
     + [(T("04:41:00"), (-28, -64), "on_scene"),
        (T("04:55:00"), STATION["ENDOUME"], "returning")])

unit("GROUP NORTH", "group commander (VLCG)", "Battalion HQ", 2, "LT H. Reyes",
     station_hold("HQ", "02:50:15")
     + leg(ROUTE["HQ"][:4] + [(60, -12)], (14, -18), T("02:53:00"), T("03:08:00"))
     + [(T("06:40:00"), (14, -18), "on_scene"),
        (T("06:55:00"), STATION["HQ"], "returning")])

unit("COMMAND POST", "command post (PC)", "Battalion HQ", 3, "PO1 M. Adler",
     station_hold("HQ", "02:50:15")
     + leg(ROUTE["HQ"], (-36, -85), T("02:55:00"), T("03:10:40"))
     + [(T("06:10:00"), (-36, -85), "on_scene"),
        (T("06:25:00"), STATION["HQ"], "returning")])

unit("AIR SUPPORT", "BA logistics (VAR)", "CIS Saint-Lazare", 2, "PO1 J. Brun",
     station_hold("SAINT-LAZARE", "02:50:15")
     + leg(ROUTE["SAINT-LAZARE"], (-16, 48), T("02:54:00"), T("03:13:30"))
     + [(T("06:40:00"), (-16, 48), "on_scene"),
        (T("06:55:00"), STATION["SAINT-LAZARE"], "returning")])

unit("SMUR 1", "SAMU mobile ICU", "La Timone", 3, "SAMU physician",
     [(T("03:04:00"), STATION["TIMONE"], "at_hospital")]
     + leg(ROUTE["TIMONE"], (-22, -70), T("03:04:10"), T("03:14:20"))
     + [(T("04:40:40"), (-22, -70), "on_scene"),
        (T("04:52:00"), STATION["TIMONE"], "returning")])

unit("MEDICAL 1", "medical director (DSM)", "La Timone", 2, "LCDR (MD) S. Bonnet",
     [(T("03:06:00"), STATION["TIMONE"], "at_hospital")]
     + leg(ROUTE["TIMONE"], (-44, -72), T("03:06:10"), T("03:16:00"))
     + [(T("05:00:00"), (-44, -72), "on_scene"),
        (T("05:12:00"), STATION["TIMONE"], "returning")])

# ---------------------------------------------------------------- victims
VICTIMS = [
    {"id": "V01", "name": "Pavel Horak", "age": 46, "persons": 1, "location": "3rd-floor landing (fled flat 3B)",
     "x": 3, "y": 1, "floor": 3, "caller": False, "triage": "red",
     "found": "02:53:20", "resolved": "02:55:30", "resolution": "carry-down by attack pair 1",
     "transported": "03:05:00", "destination": "La Timone (hyperbaric)"},
    {"id": "V02", "name": "Théo Marchal + Emma Costa", "age": 31, "persons": 2, "location": "flat 3A balcony (Prado side)",
     "x": -5, "y": 4, "floor": 3, "caller": "CALL-05", "triage": "green",
     "resolved": "02:56:30", "resolution": "ladder rescue #1 (LADDER LOUVAIN)"},
    {"id": "V03", "name": "Roger Fabre", "age": 82, "persons": 1, "location": "flat 4A window (Prado side)",
     "x": -5, "y": 0, "floor": 4, "caller": "CALL-02", "triage": "green-watch",
     "resolved": "03:05:30", "resolution": "ladder rescue #2 (LADDER LOUVAIN)",
     "transported": "03:40:00", "destination": "Hôpital Européen"},
    {"id": "V04", "name": "Fatima Belkacem", "age": 67, "persons": 1, "location": "flat 5C window (rue Borde side)",
     "x": 3, "y": -5, "floor": 5, "caller": "CALL-04", "triage": "green-watch",
     "resolved": "03:10:20", "resolution": "ladder rescue #3 (LADDER SAINT-PIERRE)",
     "transported": "03:40:00", "destination": "Hôpital Européen"},
    {"id": "V05", "name": "Nguyen couple", "age": None, "persons": 2, "location": "flat 5A window (Prado side)",
     "x": -5, "y": 2, "floor": 5, "caller": False, "triage": "white",
     "resolved": "03:13:40", "resolution": "ladder rescue #4 (LADDER LOUVAIN)"},
    {"id": "V06", "name": "Leïla Benali + Yanis (8) + Lina (5)", "age": 34, "persons": 3,
     "location": "flat 6C corner window", "x": 0, "y": -5, "floor": 6,
     "caller": "CALL-01", "triage": "green (children green-watch)",
     "resolved": "03:18:10", "resolution": "ladder rescue #5 (LADDER SAINT-PIERRE)",
     "transported": "03:58:40", "destination": "Hôpital Européen"},
    {"id": "V07", "name": "Berthe Roux", "age": 88, "persons": 1, "location": "flat 5B (courtyard side)",
     "x": 8, "y": 2, "floor": 5, "caller": False, "triage": "yellow",
     "found": "03:24:00", "resolved": "03:27:00", "resolution": "interior extraction, smoke hood",
     "transported": "03:36:00", "destination": "La Timone"},
    {"id": "V08", "name": "Dylan Girard", "age": 24, "persons": 1, "location": "flat 7B (courtyard side)",
     "x": 8, "y": 0, "floor": 7, "caller": "CALL-03", "triage": "green",
     "resolved": "03:30:20", "resolution": "escorted down with smoke hood (search pair 2)"},
    {"id": "V09", "name": "42 other residents", "age": None, "persons": 42, "location": "floors 1-8",
     "x": 2, "y": 2, "floor": None, "caller": False, "triage": "19 green-minor / 26 white (incl. above)",
     "resolved": "03:47:00", "resolution": "controlled evacuation to 163 lobby reception point"},
]

FIRE = [
    {"t": "02:40:00", "extent": "flat 3B kitchen", "floors": [3]},
    {"t": "02:46:30", "extent": "flat 3B flashover, courtyard windows failed", "floors": [3]},
    {"t": "03:09:30", "extent": "extension flat 4B (2 rooms)", "floors": [3, 4]},
    {"t": "03:34:30", "extent": "SURROUNDED", "floors": [3, 4]},
    {"t": "04:05:40", "extent": "UNDER CONTROL", "floors": [3, 4]},
    {"t": "05:45:00", "extent": "EXTINGUISHED", "floors": []},
]


def main():
    DATA.mkdir(exist_ok=True)
    (DATA / "unit_positions.json").write_text(json.dumps({
        "crs": "local metres from 43.278230,5.388545 (x=east,y=north); WGS84 included",
        "date": "2026-03-14",
        "units": UNITS,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATA / "victims.json").write_text(json.dumps({
        "event": "PRADO-167",
        "building_local_origin": {"lat": LAT0, "lon": LON0},
        "victims": VICTIMS,
        "fire_state": FIRE,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    n = sum(len(u["track"]) for u in UNITS)
    print(f"unit_positions.json: {len(UNITS)} units, {n} waypoints")
    print(f"victims.json: {len(VICTIMS)} victim entries, {len(FIRE)} fire states")


if __name__ == "__main__":
    main()
