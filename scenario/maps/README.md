# Maps — PRADO-167 (real OSM geography + fictional operations layer)

Everything geographic here is **real open data** (OpenStreetMap, ODbL): building
footprints, streets, fire hydrants, BMPM fire stations, hospitals. Everything
operational (unit movements, victims, fire state) is **fictional**, generated and
consistency-checked against `../05_MASTER_TIMELINE.md`.

## Contents

| Path | What |
|---|---|
| `interactive_map.html` | **Time-slider operations map** — open in a browser (internet needed for OSM tiles). Play/pause, speed, key-moment jumps, event log, unit/victim/fire markers with popups. |
| `snapshots/T1_0252_first_due.svg` | Key moment 1 — first engine on scene (02:52) |
| `snapshots/T2_0258_group_command.svg` | Key moment 2 — group command, first rescue, CCP (02:58) |
| `snapshots/T3_0312_full_column_mayday.svg` | Key moment 3 — full column, sectors, MAYDAY (03:12) |
| `snapshots/T4_0335_surrounded.svg` | Key moment 4 — fire surrounded, evacuation (03:35) |
| `data/site.geojson` | Real OSM layer: 591 buildings, 122 street segments, 11 hydrants, 8 BMPM stations (with scenario roles tagged) |
| `data/site_meta.json` | Incident building footprint, local metric CRS definition, station distances |
| `data/unit_positions.json` | 16 units × timestamped waypoints (local metres + WGS84 + status) |
| `data/victims.json` | Victim positions/triage/resolution + fire-state timeline |
| `tools/` | The full generation & test pipeline (below) |

## Pipeline (reproducible)

```
tools/fetch_osm.py           # 1. download raw OSM data (Overpass API) -> osm_raw.json
tools/build_geodata.py       # 2. osm_raw.json -> data/site.geojson + site_meta.json
tools/make_positions.py      # 3. author unit tracks & victims -> data/*.json
tools/validate_geo.py        # 4. TEST: chronology, speeds, arrival times vs master
                             #    timeline, spacing, WGS84/local match, radio
                             #    transcript order & milestones, call files
tools/render_snapshots.py    # 5. data -> snapshots/*.svg
tools/build_interactive_map.py # 6. data -> interactive_map.html (self-contained)
```

Run `python tools/validate_geo.py` after ANY edit to timeline, radio, calls or
map data — it exits non-zero on any inconsistency.

## Local CRS

`x = (lon − 5.388545) × 111320 × cos(43.27823°)` metres east,
`y = (lat − 43.278230) × 110540` metres north (origin = incident building
centroid). Sub-metre accurate over the scenario extent; both local and WGS84
coordinates are stored in the JSON files.

Map data © OpenStreetMap contributors, ODbL 1.0 — openstreetmap.org/copyright.
