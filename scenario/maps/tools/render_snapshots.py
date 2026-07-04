"""Render key-moment tactical SVG snapshots of the PRADO-167 scenario.

Reads real OSM geometry (site.geojson) + generated movement data
(unit_positions.json, victims.json) and renders one SVG per key moment into
../snapshots/. Symbology follows French SITAC conventions loosely: red = fire
apparatus, teal cross = medical, navy = command, cyan = water, orange = fire.
Identity is never colour-alone: shapes + direct labels on every unit.
"""
import json
import math
import pathlib

HERE = pathlib.Path(__file__).parent
DATA = HERE.parent / "data"
OUT = HERE.parent / "snapshots"

LAT0, LON0 = 43.278230, 5.388545
MX = 111320 * math.cos(math.radians(LAT0))
MY = 110540.0

# view window (local metres) and svg scale
XMIN, XMAX, YMIN, YMAX = -130, 130, -165, 115
S = 3.4  # px per metre
W, H = int((XMAX - XMIN) * S), int((YMAX - YMIN) * S) + 150  # +header/legend

KEY_MOMENTS = [
    ("T1_0252_first_due", "02:52:00",
     "T1 — 02:52 — First due on scene",
     "ENGINE LOUVAIN 1 four minutes after first call. Attack line entering; ladder setting up on the Prado façade. 25+ trapped, windows shown in amber."),
    ("T2_0258_group_command", "02:58:30",
     "T2 — 02:58 — Group command, first rescue done",
     "GROUP SOUTH is COS. Rescue #1 complete (3A balcony). Hose-lay running to H-ROUET. CCP opening on the tram platform. Column inbound."),
    ("T3_0312_full_column_mayday", "03:12:00",
     "T3 — 03:12 — Full column, sectors running, MAYDAY",
     "COLUMN 1 is COS; sectors ALPHA/BRAVO/MEDICAL. Ceiling collapse on 4th floor: MAYDAY, safety team committed. Extension to 4B."),
    ("T4_0335_surrounded", "03:35:00",
     "T4 — 03:35 — Fire surrounded, controlled evacuation",
     "All window rescues complete (9 by cage). Fire boxed in 3B/4B. Search and smoke-hood evacuation flowing to the 163 lobby reception point."),
]

UNIT_STYLE = {
    # type keyword -> (fill, shape, short)
    "engine": ("#C0392B", "rect", None),
    "ladder": ("#8E241D", "ladder", None),
    "medic": ("#0F766E", "cross", None),
    "SAMU": ("#0F766E", "cross", None),
    "ICU": ("#0F766E", "cross", None),
    "command post": ("#1A3E8C", "post", None),
    "commander": ("#1A3E8C", "tri", None),
    "director": ("#0F766E", "tri", None),
    "logistics": ("#5B6470", "rect", None),
}
SHORT = {
    "ENGINE LOUVAIN 1": "E·LV1", "LADDER LOUVAIN": "L·LV", "MEDIC LOUVAIN": "M·LV",
    "ENGINE SAINT-PIERRE 1": "E·SP1", "GROUP SOUTH": "GRP·S", "ENGINE ENDOUME 1": "E·ED1",
    "MEDIC SAINT-PIERRE": "M·SP", "ENGINE CANEBIERE 1": "E·CB1", "LADDER SAINT-PIERRE": "L·SP",
    "COLUMN 1": "COL·1", "MEDIC ENDOUME": "M·ED", "GROUP NORTH": "GRP·N",
    "COMMAND POST": "PC", "AIR SUPPORT": "AIR", "SMUR 1": "SMUR", "MEDICAL 1": "DSM",
}


def T(s):
    h, m, sec = map(int, s.split(":"))
    return h * 3600 + m * 60 + sec


def px(x, y):
    return (x - XMIN) * S, (YMAX - y) * S + 96  # header offset


def pos_at(track, t):
    if t <= T(track[0]["t"]):
        return track[0]
    for a, b in zip(track, track[1:]):
        if T(a["t"]) <= t <= T(b["t"]):
            f = (t - T(a["t"])) / max(1, T(b["t"]) - T(a["t"]))
            return {"x": a["x"] + f * (b["x"] - a["x"]),
                    "y": a["y"] + f * (b["y"] - a["y"]), "status": b["status"]}
    return track[-1]


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;")


def unit_style(utype):
    for k, v in UNIT_STYLE.items():
        if k in utype:
            return v
    return ("#5B6470", "rect", None)


def render(fname, t_str, title, subtitle, site, units, victims, fire_state):
    t = T(t_str)
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
               f'font-family="Segoe UI, Arial, sans-serif">')
    svg.append(f'<rect width="{W}" height="{H}" fill="#F4F1EA"/>')

    # streets
    for f in site["features"]:
        p = f["properties"]
        if p.get("kind") != "street":
            continue
        pts = [px((c[0] - LON0) * MX, (c[1] - LAT0) * MY) for c in f["geometry"]["coordinates"]]
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        wd = {"secondary": 12, "residential": 7, "unclassified": 6}.get(p.get("highway"), 3)
        col = "#DDD8CC" if p.get("highway") in ("secondary", "residential", "unclassified") else "#E6E2D8"
        svg.append(f'<path d="{d}" stroke="{col}" stroke-width="{wd}" fill="none" stroke-linecap="round"/>')

    # buildings
    for f in site["features"]:
        p = f["properties"]
        if p.get("kind") != "building":
            continue
        pts = [px((c[0] - LON0) * MX, (c[1] - LAT0) * MY) for c in f["geometry"]["coordinates"][0]]
        if not any(-40 < x < W + 40 and 40 < y < H + 40 for x, y in pts):
            continue
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
        role = p.get("scenario_role", "")
        if role == "incident_building":
            svg.append(f'<path d="{d}" fill="#E8B9A0" stroke="#8E241D" stroke-width="2.5"/>')
        elif role:
            svg.append(f'<path d="{d}" fill="#D9D3C4" stroke="#8A8474" stroke-width="1.2"/>')
        else:
            svg.append(f'<path d="{d}" fill="#E3DED2" stroke="#C9C3B2" stroke-width="0.7"/>')

    # exclusion zone
    bx, by = px(3, 1)
    svg.append(f'<circle cx="{bx:.0f}" cy="{by:.0f}" r="{35*S:.0f}" fill="none" stroke="#C0392B" stroke-width="1.6" stroke-dasharray="8 6" opacity="0.75"/>')

    # fire glyph on the building (state at t)
    state = [fs for fs in fire_state if T(fs["t"]) <= t]
    cur = state[-1] if state else None
    if cur and cur["floors"]:
        fx, fy = px(6, -2)
        r = 10 + 4 * len(cur["floors"])
        svg.append(f'<circle cx="{fx:.0f}" cy="{fy:.0f}" r="{r+8}" fill="#E67E22" opacity="0.30"/>')
        svg.append(f'<circle cx="{fx:.0f}" cy="{fy:.0f}" r="{r}" fill="#D94436" opacity="0.85"/>')
        lbl = "FIRE fl." + "+".join(str(n) for n in cur["floors"])
        if "SURROUND" in cur["extent"]:
            lbl = "FIRE (surrounded) fl.3+4"
        svg.append(f'<text x="{fx+r+34:.0f}" y="{fy-r-6:.0f}" font-size="12.5" font-weight="700" text-anchor="middle" fill="#8E241D" stroke="#F4F1EA" stroke-width="3.5" paint-order="stroke">{lbl}</text>')

    # hydrants in use — off-view ones listed in a small stacked panel top-right
    offview = []
    for hid, (hx, hy), used_from in [("H-ROUET", (163.5, 161.2), "03:06:20"),
                                     ("H-CASSIS", (207.8, 128.3), "03:29:00"),
                                     ("H-PRADO-N", (-93.9, 238.1), "03:22:00")]:
        X, Y = px(hx, hy)
        if not (0 < X < W and 90 < Y < H - 40):
            if T(used_from) <= t:
                offview.append(hid)
            continue
        svg.append(f'<circle cx="{X:.0f}" cy="{Y:.0f}" r="6" fill="#1273A6"/>')
        svg.append(f'<text x="{X+9:.0f}" y="{Y+4:.0f}" font-size="10.5" fill="#1273A6">{hid}</text>')
    for i, hid in enumerate(offview):
        svg.append(f'<text x="24" y="{104+16*i}" font-size="11" fill="#1273A6" font-weight="600">→ {hid} (off-map supply)</text>')

    # CCP + reception point (after establishment) — box offset west with a pointer
    if t >= T("02:58:30"):
        X, Y = px(-27, -45)
        BX, BY = px(-58, -45)
        svg.append(f'<line x1="{BX+27}" y1="{BY}" x2="{X-4}" y2="{Y}" stroke="#0F766E" stroke-width="1.6" stroke-dasharray="3 3"/>')
        svg.append(f'<circle cx="{X:.0f}" cy="{Y:.0f}" r="4" fill="#0F766E"/>')
        svg.append(f'<rect x="{BX-27}" y="{BY-13}" width="54" height="26" rx="5" fill="#FFFFFF" stroke="#0F766E" stroke-width="2"/>')
        svg.append(f'<text x="{BX:.0f}" y="{BY+4:.0f}" font-size="11.5" font-weight="700" text-anchor="middle" fill="#0F766E">CCP</text>')
    if t >= T("02:52:30"):
        X, Y = px(-8, 40)
        svg.append(f'<text x="{X:.0f}" y="{Y:.0f}" font-size="10.5" fill="#4A5160" font-weight="600">163 lobby = reception pt</text>')

    # victims: unresolved = amber dot with person count; resolved = small green dot.
    # Individual labels collide at this scale, so a summary card carries the detail.
    pending = []
    for v in victims:
        vx, vy = v["x"], v["y"]
        inside = "window" not in v["location"] and "balcony" not in v["location"]
        if inside and v.get("floor"):
            vx += (v["floor"] - 4) * 2.2  # display de-overlap for stacked interior positions
        X, Y = px(vx, vy)
        res = T(v["resolved"])
        n = v.get("persons", 1)
        if v["id"] == "V09":
            if t >= res:
                X, Y = px(-8, 45)
                svg.append(f'<text x="{X:.0f}" y="{Y+12:.0f}" font-size="10.5" fill="#2E7D32" font-weight="600">42 residents evacuated ✓</text>')
            continue
        if t < res:
            svg.append(f'<circle cx="{X:.0f}" cy="{Y:.0f}" r="11" fill="#E67E22" opacity="0.30"/>')
            svg.append(f'<circle cx="{X:.0f}" cy="{Y:.0f}" r="6.5" fill="#B45309" stroke="#FFFFFF" stroke-width="1.3"/>')
            svg.append(f'<text x="{X:.0f}" y="{Y+3:.0f}" font-size="8.5" font-weight="800" text-anchor="middle" fill="#FFFFFF">{n}</text>')
            loc = v["location"].split("(")[0].strip()
            pending.append((v["floor"], n, loc if not inside else loc + " — inside"))
        else:
            svg.append(f'<circle cx="{X:.0f}" cy="{Y:.0f}" r="4" fill="#2E7D32" stroke="#FFFFFF" stroke-width="1"/>')

    # summary card: who is still waiting at time t
    if pending:
        pending.sort(reverse=True)
        cx0, cy0 = W - 250, 102
        rows = len(pending) + 1
        svg.append(f'<rect x="{cx0}" y="{cy0}" width="226" height="{26+16*rows}" rx="8" fill="#FFFFFF" opacity="0.94" stroke="#B45309" stroke-width="1.5"/>')
        svg.append(f'<text x="{cx0+12}" y="{cy0+20}" font-size="11.5" font-weight="700" fill="#8a4a08">AWAITING RESCUE ({sum(n for _, n, _ in pending)} pers.)</text>')
        for i, (fl, n, loc) in enumerate(pending):
            svg.append(f'<text x="{cx0+12}" y="{cy0+38+16*i}" font-size="10.5" fill="#1F2430">{n} × {loc}</text>')

    # units
    drawn = []
    for u in units:
        p = pos_at(u["track"], t)
        st = str(p["status"])
        if st in ("at_station", "at_hospital") or st.startswith("returning"):
            continue
        X, Y = px(p["x"], p["y"])
        if not (0 < X < W and 90 < Y < H - 50):
            continue
        fill, shape, _ = unit_style(u["type"])
        short = SHORT.get(u["callsign"], u["callsign"][:6])
        opacity = "0.55" if st == "responding" else "1"
        if shape == "rect":
            svg.append(f'<rect x="{X-11}" y="{Y-7}" width="22" height="14" rx="3" fill="{fill}" opacity="{opacity}" stroke="#FFFFFF" stroke-width="1.5"/>')
        elif shape == "ladder":
            svg.append(f'<rect x="{X-13}" y="{Y-7}" width="26" height="14" rx="3" fill="{fill}" opacity="{opacity}" stroke="#FFFFFF" stroke-width="1.5"/>')
            svg.append(f'<line x1="{X-9}" y1="{Y}" x2="{X+9}" y2="{Y}" stroke="#FFFFFF" stroke-width="1.6" opacity="{opacity}"/>')
            for lx in (-6, -2, 2, 6):
                svg.append(f'<line x1="{X+lx}" y1="{Y-3.5}" x2="{X+lx}" y2="{Y+3.5}" stroke="#FFFFFF" stroke-width="1.4" opacity="{opacity}"/>')
        elif shape == "cross":
            svg.append(f'<rect x="{X-9}" y="{Y-9}" width="18" height="18" rx="4" fill="{fill}" opacity="{opacity}" stroke="#FFFFFF" stroke-width="1.5"/>')
            svg.append(f'<path d="M{X-4},{Y} h8 M{X},{Y-4} v8" stroke="#FFFFFF" stroke-width="2.4" opacity="{opacity}"/>')
        elif shape == "tri":
            svg.append(f'<path d="M{X},{Y-10} L{X+9},{Y+7} L{X-9},{Y+7} Z" fill="{fill}" opacity="{opacity}" stroke="#FFFFFF" stroke-width="1.5"/>')
        elif shape == "post":
            svg.append(f'<rect x="{X-12}" y="{Y-9}" width="24" height="18" rx="3" fill="{fill}" opacity="{opacity}" stroke="#FFFFFF" stroke-width="1.5"/>')
            svg.append(f'<path d="M{X-3},{Y-5} v10 M{X-3},{Y-5} h8 l-3,3 3,3 h-8" stroke="#FFFFFF" stroke-width="1.4" fill="none" opacity="{opacity}"/>')
        lab_dy = -13 if shape != "tri" else -14
        svg.append(f'<text x="{X:.0f}" y="{Y+lab_dy:.0f}" font-size="10.5" font-weight="700" text-anchor="middle" fill="#1F2430" stroke="#F4F1EA" stroke-width="3" paint-order="stroke">{short}</text>')
        drawn.append(short)

    # MAYDAY flag at T3 (kept clear of the FIRE label below it)
    if T("03:11:40") <= t <= T("03:17:20"):
        X, Y = px(6, -2)
        svg.append(f'<rect x="{X+28}" y="{Y-84}" width="126" height="26" rx="5" fill="#8E241D"/>')
        svg.append(f'<text x="{X+91}" y="{Y-66:.0f}" font-size="13" font-weight="800" text-anchor="middle" fill="#FFFFFF">MAYDAY — 4th fl.</text>')
        svg.append(f'<line x1="{X+40}" y1="{Y-58}" x2="{X+8}" y2="{Y-10}" stroke="#8E241D" stroke-width="2" stroke-dasharray="3 3"/>')

    # street names
    for name, (nx, ny), rot in [("AVENUE DU PRADO", (-38, -120), -63),
                                ("RUE BORDE", (58, -14), -4)]:
        X, Y = px(nx, ny)
        svg.append(f'<text x="{X:.0f}" y="{Y:.0f}" font-size="11" letter-spacing="2" fill="#9A937F" transform="rotate({rot} {X:.0f} {Y:.0f})">{name}</text>')

    # north arrow + scale bar
    X, Y = px(XMAX - 14, YMAX - 12)
    svg.append(f'<path d="M{X},{Y+12} L{X},{Y-8} M{X-5},{Y-1} L{X},{Y-8} L{X+5},{Y-1}" stroke="#4A5160" stroke-width="2" fill="none"/>')
    svg.append(f'<text x="{X:.0f}" y="{Y+26:.0f}" font-size="11" text-anchor="middle" fill="#4A5160">N</text>')
    sx, sy = px(XMIN + 10, YMIN + 10)
    svg.append(f'<line x1="{sx}" y1="{sy}" x2="{sx+50*S}" y2="{sy}" stroke="#4A5160" stroke-width="2.5"/>')
    svg.append(f'<text x="{sx+25*S:.0f}" y="{sy-6:.0f}" font-size="11" text-anchor="middle" fill="#4A5160">50 m</text>')

    # header (drawn last so map layers never overpaint it)
    svg.append(f'<rect x="0" y="0" width="{W}" height="82" fill="#F4F1EA"/>')
    svg.append(f'<line x1="0" y1="82" x2="{W}" y2="82" stroke="#D8D2C2" stroke-width="1"/>')
    svg.append(f'<text x="24" y="38" font-size="22" font-weight="700" fill="#1F2430">{esc(title)}</text>')
    svg.append(f'<text x="24" y="62" font-size="12.5" fill="#4A5160">{esc(subtitle)}</text>')

    # footer band + legend
    svg.append(f'<rect x="0" y="{H-56}" width="{W}" height="56" fill="#F4F1EA"/>')
    svg.append(f'<line x1="0" y1="{H-56}" x2="{W}" y2="{H-56}" stroke="#D8D2C2" stroke-width="1"/>')
    ly = H - 34
    legend = [("#C0392B", "engine (FPT)"), ("#8E241D", "ladder (EPA)"),
              ("#0F766E", "medic / DSM"), ("#1A3E8C", "command / CP"),
              ("#5B6470", "logistics"), ("#B45309", "awaiting rescue"),
              ("#2E7D32", "resolved"), ("#1273A6", "hydrant"),
              ("#D94436", "fire")]
    lx = 24
    for col, lab in legend:
        svg.append(f'<rect x="{lx}" y="{ly-10}" width="13" height="13" rx="3" fill="{col}"/>')
        svg.append(f'<text x="{lx+18}" y="{ly+1}" font-size="11.5" fill="#1F2430">{lab}</text>')
        lx += 32 + int(len(lab) * 6.2)
    svg.append(f'<text x="24" y="{H-10}" font-size="10" fill="#8A8474">Fictional training scenario (Athena demo) — faded unit = still responding — times local (CET), 14 March 2026.</text>')
    svg.append(f'<text x="{W-24}" y="{H-10}" font-size="10" text-anchor="end" fill="#8A8474">Map data © OpenStreetMap contributors (ODbL)</text>')

    svg.append("</svg>")
    OUT.mkdir(exist_ok=True)
    (OUT / f"{fname}.svg").write_text("\n".join(svg), encoding="utf-8")
    print(f"{fname}.svg — {len(drawn)} units drawn: {', '.join(sorted(drawn))}")


def main():
    site = json.loads((DATA / "site.geojson").read_text(encoding="utf-8"))
    up = json.loads((DATA / "unit_positions.json").read_text(encoding="utf-8"))
    vd = json.loads((DATA / "victims.json").read_text(encoding="utf-8"))
    for fname, t, title, sub in KEY_MOMENTS:
        render(fname, t, title, sub, site, up["units"], vd["victims"], vd["fire_state"])


if __name__ == "__main__":
    main()
