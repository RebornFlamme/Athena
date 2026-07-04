# 03 — Command Structure & Radio Plan

Modelled on the French fire-service command doctrine (GOC — *Gestion Opérationnelle
et Commandement*) as practised by the BMPM (naval ranks). Everything is written in
English; the table below fixes the French ↔ English mapping used throughout the
dataset.

## Doctrine mapping (French reference → this dataset)

| French doctrine | This dataset | Commands | Radio |
|---|---|---|---|
| CTA/CODIS (BMPM: COSSIM) | Fire Operations Centre — **CENTRAL** | Dispatch, resources, logging | CH1 |
| Chef d'équipe (team leader) | **Team leader** (leads a 2-person pair: attack pair / supply pair / search pair) | 1 firefighter | Sector channel (CH3/CH4) |
| Chef d'agrès (crew commander) | **Crew commander** — one per vehicle | Their vehicle + 1–2 pairs | CH2 + sector channel |
| Chef de groupe (group commander) | **Group commander** (GROUP SOUTH / GROUP NORTH) | 2–4 vehicles = a *group* | CH1 + CH2 |
| Chef de colonne (column commander) | **Column commander** (COLUMN 1) | 2–4 groups = a *column* | CH1 + CH2 |
| Chef de site (site commander) | *(scale-up hook — not reached in this scenario)* | Multiple columns | — |
| COS (Commandant des Opérations de Secours) | **Incident Commander (COS)** — role, not a person; transfers upward | Whole incident | CH1 + CH2 |
| DSM (Directeur des Secours Médicaux) | **MEDICAL 1** (senior medical officer) | Medical sector | CH2 + CH5 |
| Message d'ambiance (SOIEC) | **Situation report**: "I am / I see / I foresee / I am doing / I request" | — | CH1 |
| Feu circonscrit / maîtrisé / éteint | Fire **surrounded** / **under control** / **extinguished** | — | CH1 |
| Détresse ("détresse, détresse, détresse") | **MAYDAY, MAYDAY, MAYDAY** | — | any (here CH3) |

## Command chain of this incident (at full deployment, ~03:20)

```
CENTRAL (Fire Operations Centre — dispatch, not on scene)
│
└── COS: COLUMN 1 — LCDR Antoine Verne (column commander, assumed command 03:04:00)
    │        supported by COMMAND POST (PC) crew — PO1 M. Adler +2 (operational 03:15)
    │
    ├── SECTOR ALPHA — Fire attack (GROUP SOUTH — LT Claire Aubry, COS 02:55:40→03:04:00)
    │   ├── ENGINE LOUVAIN 1        — crew cdr CPO Malik Bouzid
    │   │   ├── Attack pair 1: TL PO3 A. Costa + FF L. Nowak
    │   │   └── Supply pair 1: TL PO3 K. Diallo + FF T. Roussel
    │   ├── ENGINE SAINT-PIERRE 1   — crew cdr CPO Yann Le Goff
    │   │   ├── Attack pair 2: TL PO3 D. Osei + FF N. Petit      ← MAYDAY 03:11
    │   │   └── Supply pair 2: TL PO3 C. Fontana + FF R. Meyer   (230 m hose-lay)
    │   ├── ENGINE CANEBIÈRE 1      — crew cdr CPO A. Fischer (3rd line + supply line 2)
    │   └── ENGINE ENDOUME 1        — crew cdr CPO R. Santini
    │       └── Safety team (RIT): TL PO3 V. Leroy + FF O. Diop  ← committed on MAYDAY
    │
    ├── SECTOR BRAVO — Search, rescue & ladders (GROUP NORTH — LT Hugo Reyes, from 03:08)
    │   │   (interim 02:55–03:08: LADDER LOUVAIN crew cdr)
    │   ├── LADDER LOUVAIN          — crew cdr PO1 Victor Lange, op PO2 S. Muller, FF H. Ba
    │   ├── LADDER SAINT-PIERRE     — crew cdr PO1 G. Moreau (+2)
    │   └── Search pairs (drawn from engine crews on rotation)
    │
    ├── SECTOR MEDICAL (MEDIC LOUVAIN crew cdr, then MEDICAL 1 — LCDR (MD) Sarah Bonnet from 03:16)
    │   ├── MEDIC LOUVAIN           — crew cdr PO2 Inès Robert (+2)
    │   ├── MEDIC SAINT-PIERRE      — crew cdr PO2 L. Pons (+2)
    │   ├── MEDIC ENDOUME           — crew cdr PO2 B. Sila (+2)
    │   └── SMUR 1 (SAMU medical team, liaison)
    │
    └── LOGISTICS (reports direct to CP)
        └── AIR SUPPORT             — BA cylinder logistics, PO1 J. Brun (+1)
```

**Command transfers** (always announced on CH1 and CH2):
first crew commander on scene (02:51:05, ENGINE LOUVAIN 1) → **GROUP SOUTH**
02:55:40 → **COLUMN 1** 03:04:00 → (post-fire watch) GROUP SOUTH 06:10.

## Radio channel plan — one folder per channel in `radio_comms/`

| Channel | Name / folder | Who talks | Purpose |
|---|---|---|---|
| **CH1** | OPS-DISPATCH (`CH1_OPS_DISPATCH`) | CENTRAL ↔ crew cdrs (status only) + COS | Dispatch, en-route/on-scene status, situation reports, resource requests, milestone declarations |
| **CH2** | COMMAND TAC-2 (`CH2_COMMAND_TAC2`) | COS ↔ sector cdrs ↔ crew cdrs | Tactical command net |
| **CH3** | TAC-3 SECTOR ALPHA (`CH3_TAC3_SECTOR_ALPHA_FIRE_ATTACK`) | ALPHA crew cdrs ↔ team leaders | Interior attack net; **MAYDAY happens here** |
| **CH4** | TAC-4 SECTOR BRAVO (`CH4_TAC4_SECTOR_BRAVO_SEARCH_RESCUE`) | BRAVO cdr ↔ ladders ↔ search pairs | Rescue & search net |
| **CH5** | TAC-5 MEDICAL (`CH5_TAC5_SECTOR_MEDICAL`) | MEDICAL 1 ↔ medic crews ↔ CCP | Triage, transport noria |

Radio equipment rule (French practice): every **team leader**, **crew commander**
and above carries a radio; pair members do not (they stay in voice/touch contact
with their team leader).

## Voice procedure conventions used in the transcripts

- Calling order — *"«receiver» from «sender»"*: `COLUMN 1 from ENGINE LOUVAIN 1`.
  Answer: `ENGINE LOUVAIN 1 from COLUMN 1, send`. End of exchange: `received` / `out`.
- Status keywords (CH1): `responding`, `on scene`, `available`, `returning`.
- Situation report skeleton (SOIEC): **I am** (position/role) / **I see** (facts) /
  **I foresee** (risk evolution) / **I am doing** (actions) / **I request** (resources).
- Milestones only the COS may declare: `fire surrounded`, `fire under control`,
  `fire extinguished`, `search complete — all clear`.
- Emergency: `MAYDAY MAYDAY MAYDAY` + LUNAR (Location, Unit, Name, Air, Resources).
  Channel is frozen for the emergency; all other traffic moves to the command net.
- Numbers read digit by digit; times in 24 h; no tens codes — plain language.
