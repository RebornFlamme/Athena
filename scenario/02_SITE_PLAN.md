# 02 — Site Plan (real geography, OpenStreetMap)

All geometry in this file comes from real OSM data (`maps/data/site.geojson`,
ODbL). Local coordinates are metres from the incident-building centroid
(43.278230 N, 5.388545 E): **x = east, y = north**.

## Urban context

The incident building stands on the **east side of avenue du Prado**, Marseille's
major north–south boulevard (8th arrondissement), at the corner of **rue Borde**
(narrow one-way residential street running east). The avenue here has, from west
to east: west service road — main carriageway (3+ lanes) — **central platform
carrying the "Prado Borde" bus/tram stop** (real OSM platform, x ≈ −33…−20) —
main carriageway — **east service road** (serving the building's entrance) —
sidewalk. Total right-of-way ≈ 50 m: exceptional working room for apparatus,
but the boulevard must be closed to traffic.

```
                 N ↑                     (local metres, x east / y north)
     y=+40 ┤  ░ office bldg 163 Prado ░   ← night guard (CALL-07)
           │  ░ (R+7, party wall)     ░
     y=+10 ┤  ▓ 165 Prado (R+3) ▓  party wall
           │  ┌────────────────────┐
 AVENUE    │  │  ██ 167 AV. DU     │   inner courtyard (no vehicle access)
 DU PRADO  │  │  ██ PRADO  (R+8)   │   ← fire flat 3B faces courtyard (east)
 (west of  │  │  ██ x:-6..+11      │
  x≈-10)   │  │  ██ y:-5..+8       │
     y=-5  ┤  └────────────────────┘
           │  ═══ RUE BORDE ═══ (y≈-10, one-way, 4 m wide)  → CIS LOUVAIN 550 m by road
     y=-20 ┤  ▒ 5-7 rue Borde (R+5/R+6) ▒
           │
   x:  -70˧-30 ˧-20     0      +20     +40
   174 Prado (R+10, witness CALL-06) is at x≈-68 across the avenue; 172 Prado (witness CALL-09) adjoins it.
```

## Incident building — 167 avenue du Prado

- Footprint polygon (local m): (−5.9, 2.3) (−3.9, −2.6) (−3.4, −3.9) (−0.4, −5.1)
  (11.3, −0.6) (8.1, 7.5) — an angled corner block, long axis WSW–ENE.
- **Façade P (west, avenue du Prado)** — entrance hall, flats A balconies.
  Aerial ladder access: excellent (east service road, 9–12 m from wall).
- **Façade B (south, rue Borde)** — flats C windows. Ladder access: good
  (street is narrow: outriggers span kerb-to-kerb, street must be cleared).
- **Façade C (east, courtyard)** — flats B windows, **fire façade**. No ladder
  access (closed courtyard) → interior attack only. This drives the whole tactic.
- North: party wall with 165 (R+3) then office building 163 (R+7).

## Water supply (real mapped hydrants)

Nearest hydrants **as mapped in OSM** (coverage is incomplete in reality, the
exercise uses only mapped ones — a realistic worst case):

| ID | Local (x, y) | Distance | Use in scenario |
|---|---|---|---|
| H-ROUET (node/13135727288) | (163.5, 161.2) | 230 m NE | Supply line 1 — hose-layer run by ENGINE SAINT-PIERRE 1 support pair via rue Borde → rue du Rouet, charged 03:06 |
| H-CASSIS (node/13135715940) | (207.8, 128.3) | 245 m NE | Reserve / secondary feed for LADDER SAINT-PIERRE, charged 03:29 |
| H-PRADO-N (node/13284554762) | (−93.9, 238.1) | 257 m NW | Supply line 2 — ENGINE CANEBIÈRE 1, west side, charged 03:22 |

First 15 minutes are fought on tank water (2 × 2,000 L engines) — a deliberate,
realistic constraint that the supply pairs resolve.

## Apparatus positions at full deployment (~03:20)

Doctrine: ladders own the façades; engines keep clear of ladder scrub area;
medics and CP uphill/upwind, out of the collapse and debris zone (h + h/3 ≈ 35 m
exclusion under the fire façades).

| Unit | Local (x, y) | Position |
|---|---|---|
| LADDER LOUVAIN (EPA) | (−14, +6) | East service road, centred on Prado façade |
| ENGINE LOUVAIN 1 (FPT) | (−14, −22) | East service road south of ladder, at corner |
| LADDER SAINT-PIERRE (EPA) | (8, −11) | Rue Borde, south façade |
| ENGINE SAINT-PIERRE 1 (FPT) | (30, −11) | Rue Borde east of ladder (supply + 2nd line) |
| ENGINE ENDOUME 1 (FPT) | (−14, +32) | East service road north — safety/RIT team + exposure protection 165/163 |
| ENGINE CANEBIÈRE 1 (FPT) | (−45, −95) → (−48, +25) | Staging, then west side supply line 2 |
| MEDIC LOUVAIN (VSAV) | (−16, −35) | East service road, clear of corner |
| MEDIC SAINT-PIERRE / MEDIC ENDOUME / SMUR 1 | (−26, −48) / (−28, −58) / (−30, −68) | Ambulance nose-out queue, west service road southbound |
| **CCP (casualty collection point)** | (−27, −45) | "Prado Borde" central platform, south end — sheltered, lit, 40 m from building |
| GROUP SOUTH (command car) | (−20, −16) | Corner Prado/Borde |
| GROUP NORTH (command car) | (14, −18) | Rue Borde |
| COLUMN 1 (command car) | (−32, −78) | Near CP |
| **COMMAND POST vehicle (PC)** | (−36, −85) | West service road, 90 m south — out of smoke, sight of both façades |
| AIR SUPPORT (BA logistics) | (−16, +48) | East service road north |
| Staging area (CRM) | (−40, −110…−140) | Avenue du Prado southbound, south of CP |

## Traffic & perimeter

- 02:53 — Police requested; avenue du Prado closed both ways between rue Jean
  Mermoz junction (north) and rue Florac (south) from 03:05.
- Rue Borde closed at Prado corner and at rue du Rouet end (supply line on ground).
- Exclusion zone (red): 35 m radius around building + courtyard block interior.
  Warm zone: service roads + platform. Public/press line at 100 m.
- Evacuee reception: lobby of office building **163 avenue du Prado** (opened by
  night guard, CALL-07), then RTM bus (requested 03:35, on scene 04:05).

## Real fire stations engaged (straight-line distances from OSM)

| Station (real, BMPM) | Distance | Units in scenario |
|---|---|---|
| CIS **Louvain** | **324 m** | ENGINE LOUVAIN 1, LADDER LOUVAIN, MEDIC LOUVAIN |
| CIS **Saint-Pierre** | 1.94 km | ENGINE SAINT-PIERRE 1, LADDER SAINT-PIERRE, MEDIC SAINT-PIERRE, GROUP SOUTH |
| CIS **Canebière** | 2.26 km | ENGINE CANEBIÈRE 1 |
| CIS **Endoume** | 2.40 km | ENGINE ENDOUME 1, MEDIC ENDOUME |
| CIS **Saint-Lazare** | 3.31 km | AIR SUPPORT (BA logistics vehicle) |
| **Battalion HQ (état-major)** | 3.37 km | COLUMN 1, COMMAND POST vehicle, GROUP NORTH |

Hospitals for the noria: La Timone (2.6 km), Hôpital Européen, Sainte-Marguerite.

Machine-readable versions: `maps/data/site.geojson`, `maps/data/site_meta.json`,
`maps/data/unit_positions.json`.
