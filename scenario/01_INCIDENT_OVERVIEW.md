# 01 — Incident Overview

## Identification

| Field | Value |
|---|---|
| Incident name | PRADO-167 |
| Type | Residential building fire, persons trapped (multiple) |
| Address | **167 avenue du Prado / 3 rue Borde, 13008 Marseille, France** |
| Coordinates (WGS84) | 43.278230 N, 5.388545 E (building centroid, OSM way/154626611) |
| Date / time of ignition | Saturday **14 March 2026, ~02:40** (estimated) |
| First emergency call | 02:46:55 (answered 02:47:12) |
| Alert level reached | Reinforced residential fire — full column + NOVI (multiple-casualty plan) pre-alert |
| Responding service | Marseille marine fire battalion (modelled on BMPM), Fire Ops Centre callsign **CENTRAL** |

## The building

Real corner building (footprint from OSM cadastre import), fictional interior layout:

- **R+8** (ground floor + 8 upper floors; OSM `building:levels=9`), 1960s concrete
  frame, ~26 m ridge height.
- Corner plot: **west façade on avenue du Prado** (east service road of the avenue),
  **south façade on rue Borde**, north and east sides on the closed inner courtyard
  of the block (no vehicle access to courtyard).
- Footprint ~17 m × 13 m (~200 m²), party walls with 165 avenue du Prado (R+3
  offices/flats, north) and the block interior.
- Ground floor: entrance hall on avenue du Prado, pharmacy + optician storefronts.
- Floors 1–8: **3 flats per floor** — layout per floor:
  - **Flat A** — west, windows/balconies on avenue du Prado
  - **Flat B** — east, windows on inner courtyard
  - **Flat C** — south-west corner, windows on rue Borde and the Prado/Borde corner
- **Single stairwell** (central core, no smoke lobby — pre-1970 code), one lift.
  This is the critical vulnerability: once smoke-logged, all floors above the fire
  are cut off.
- 24 flats, **53 residents present** on the night (register reconstructed post-incident).

## Fire cause & development (reconstructed)

| Time | Development |
|---|---|
| ~02:40 | Ignition: unattended cooking oil pan, kitchen of **flat 3B** (3rd floor, courtyard side). Occupant asleep in living room. |
| ~02:45 | Occupant (Pavel Horak, 46) wakes, attempts to smother the pan, fails, flees — **flat door left open**. Collapses from smoke on the 3rd-floor landing. |
| ~02:46 | Flashover of kitchen/living room. Courtyard-side windows fail; external flame plume on courtyard façade. Stairwell smoke-logging accelerates (open door + stack effect). |
| 02:52–03:09 | Extension to flat **4B** via courtyard windows (auto-exposure). Smoke spread under pressure to corridors of floors 3–8. Mistral wind (NW 35 km/h gusting 55) pressurises the courtyard plume against the east/south faces. |
| 03:00–03:26 | Interior attack knocks down flat 3B; extension 4B checked before room involvement. |
| 03:34:30 | **Fire surrounded** (feu circonscrit). |
| 04:05:40 | **Fire under control** (maîtrisé). |
| 05:45:00 | **Fire extinguished** (éteint); overhaul and fire watch. |

## Weather (02:45 local)

Mistral conditions: wind **NW 35 km/h, gusts 55 km/h**, temperature 7 °C, RH 38 %,
clear sky, dry spell for 9 days. Effect: aggravated external flame lengthening on the
courtyard façade, smoke pushed SE across rue Borde; aerial ladder work on the Prado
(windward) façade unimpeded, ladder work on rue Borde in smoke intermittently.

## Persons involved — outcome summary

| Category | Count | Detail |
|---|---|---|
| Residents present | 53 | 24 flats, night-time occupancy |
| Potentially trapped (peak estimate, 02:58) | **25+** | Floors 3–8, stairwell impassable |
| Ladder rescues | 9 (5 rotations) | 3A×2 (02:56, LADDER LOUVAIN), 4A×1 (03:05, LL), 5C×1 (03:10, LADDER SAINT-PIERRE), 5A×2 (03:13, LL), 6C×3 (03:18, LSP) |
| Rescued unconscious / semi-conscious by interior teams | 2 | Pavel Horak (3rd-floor landing, 02:53) — **critical**; Berthe Roux (flat 5B, 03:24) — **serious** |
| Escorted down with smoke hoods / sheltered then walked out | 42 | Controlled evacuation 03:20–03:47 |
| Transported to hospital | 7 | 1 critical (La Timone), 1 serious, 5 moderate smoke inhalation |
| Assessed on site, not transported | 19 | Minor smoke exposure |
| **Deceased** | **0** | |
| Firefighter injuries | 2 minor | 1 contusion (MAYDAY ceiling collapse, 03:11), 1 heat stress |

## Key operational moments

1. **02:51:05** — First engine on scene 4 min 10 s after first call answered (CIS Louvain is 324 m away — real distance).
2. **02:55:40** — Group commander (GROUP SOUTH) assumes command (COS).
3. **02:58:10** — "25+ trapped" situation report; column + NOVI confirmed.
4. **03:04:00** — Column commander (COLUMN 1) assumes command; sectorisation ALPHA / BRAVO / MEDICAL.
5. **03:11:40** — **MAYDAY**: ceiling collapse traps an attack pair member on the 4th floor; safety team commitment; resolved 03:17.
6. **03:34:30** — Fire surrounded; last trapped resident escorted down 03:30.

## Related files

Site geometry: `02_SITE_PLAN.md` · Command chain: `03_COMMAND_STRUCTURE.md` ·
Means & escalation: `04_OPERATIONAL_RESPONSE.md` · All timestamps: `05_MASTER_TIMELINE.md`
