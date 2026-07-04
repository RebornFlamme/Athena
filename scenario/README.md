# PRADO-167 — Full-Scale Residential Fire Scenario (Athena demo dataset)

A complete, realistic, fully **fictional** training scenario of a major residential
building fire, built on **real open-source geography** (OpenStreetMap, Marseille,
France) and modelled on the doctrine and command structure of French fire services
(reference: **BMPM** — Bataillon de marins-pompiers de Marseille).

> **DISCLAIMER** — This is a synthetic exercise dataset for the Athena crisis-management
> software. The address and map data are real (OSM, ODbL); the fire, all persons, names,
> phone numbers, casualties and radio traffic are entirely fictional and bear no relation
> to the actual building or its occupants. Modelled on BMPM doctrine but not an official
> BMPM document.

## The incident in one paragraph

At 02:40 on Saturday 14 March 2026, a kitchen fire ignites in flat 3B (3rd floor,
courtyard side) of a 1960s R+8 residential corner building at **167 avenue du Prado /
3 rue Borde, 13008 Marseille**. The fleeing occupant leaves the flat door open; the
single stairwell smoke-logs within minutes, trapping most of the 53 residents above
the fire floor — **25+ persons potentially trapped**. The first 112 call reaches the
Fire Operations Centre at 02:46:55; the first engine (from CIS Louvain, 324 m away)
is on scene at 02:51:05. The response escalates to a full column: 4 engines, 2 aerial
ladders, 3 medic units, 2 group commanders, 1 column commander, command post, air
support unit and SAMU reinforcement. Outcome: 9 ladder rescues, 2 unconscious victims
rescued by interior teams, 53 residents accounted for, 7 transported, **0 deceased**,
one MAYDAY (resolved). Fire surrounded 03:34, under control 04:05, extinguished 05:45.

## Folder map

| Path | Contents |
|---|---|
| `01_INCIDENT_OVERVIEW.md` | Address, building, occupants, fire development, casualty outcome |
| `02_SITE_PLAN.md` | Real-geography site plan, accesses, hydrants, apparatus positioning |
| `03_COMMAND_STRUCTURE.md` | Full BMPM-style command chain, callsigns, radio channel plan |
| `04_OPERATIONAL_RESPONSE.md` | Dispatch orders, units, crewing, escalation logic, scale-up hooks |
| `05_MASTER_TIMELINE.md` | Master event timeline (single source of truth for all times) |
| `emergency_calls/` | 10 timestamped 112-call transcripts (5 trapped victims, 5 witnesses; CALL-04 Arabic, CALL-09 Spanish) |
| `radio_comms/` | Radio transcripts — **one folder per channel** (CH1 dispatch, CH2 command, CH3 attack, CH4 search & rescue, CH5 medical) |
| `maps/` | Real OSM geodata, unit-position-vs-time data, validation & rendering scripts, key-moment SVG snapshots, interactive time map |

## Consistency rules (for scale-up)

- `05_MASTER_TIMELINE.md` is the **single source of truth** for every timestamp.
  Calls, radio traffic and map data must never contradict it.
- Callsigns and channel assignments are defined once in `03_COMMAND_STRUCTURE.md`.
- Map times/positions are machine-readable in `maps/data/unit_positions.json` and are
  checked against the timeline by `maps/tools/validate_geo.py` (run it after any edit).
- Real-world layers (buildings, streets, hydrants, stations) come from OSM via
  `maps/tools/fetch_osm.py` + `build_geodata.py` — regenerate rather than hand-edit.

## Scale-up ideas

More call transcripts (23 calls are logged in the timeline, 10 transcribed), additional
sectors/channels, a second simultaneous incident, drone/aerial feeds, or replaying the
whole dataset through Athena's speech-to-text + extraction pipeline (each transcript is
written to be read aloud / TTS-friendly).
