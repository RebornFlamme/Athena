# Radio Communications — PRADO-167

One folder per radio channel (per scenario spec). Message format everywhere:

```
[SOURCE CALLSIGN] [hh:mm:ss]: message
```

`>>` continuation lines belong to the same transmission. Lines starting with `--`
are net-control annotations (channel frozen, traffic moved), not transmissions.

## Channels

| Folder | Net | Traffic |
|---|---|---|
| `CH1_OPS_DISPATCH/` | Operations / dispatch (CENTRAL) | Dispatch orders, responding/on-scene status, situation reports (SOIEC), resource requests, milestone declarations, releases |
| `CH2_COMMAND_TAC2/` | Command net (COS ↔ sectors ↔ crew cdrs) | Command transfers, orders, sector reports, logistics |
| `CH3_TAC3_SECTOR_ALPHA_FIRE_ATTACK/` | Sector ALPHA | Interior attack, water supply, **MAYDAY 03:11:40** |
| `CH4_TAC4_SECTOR_BRAVO_SEARCH_RESCUE/` | Sector BRAVO | Ladder rescues #1–#5, primary/secondary search, controlled evacuation |
| `CH5_TAC5_SECTOR_MEDICAL/` | Sector MEDICAL | CCP, triage, transport noria, casualty counts |

Who carries a radio, calling conventions, SOIEC skeleton and MAYDAY procedure:
see `../03_COMMAND_STRUCTURE.md`. Every timestamp matches `../05_MASTER_TIMELINE.md`.

Realism notes: transmissions are short (< 15 s of speech), one idea per exchange,
read-backs for orders and numbers, "over/out" discipline loosens under load —
as on real incident grounds. Transcripts are written to be TTS-friendly for
replaying through Athena's speech pipeline.
