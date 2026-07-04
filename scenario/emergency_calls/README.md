# Emergency Calls — 112/18 to the Fire Operations Centre (CENTRAL)

23 calls reached the centre between 02:46:55 and 02:57 for this incident; the 10
most operationally significant are transcribed here (per scenario spec: 5 callers
trapped **inside** the incident building, 5 witnesses in **other** buildings).
Two calls are in a foreign language with an operator who is not fluent
(CALL-04 Arabic, CALL-09 Spanish) — realistic for Marseille and a stress test
for Athena's multilingual speech pipeline.

## Call index

| # | Answered | Caller | Where | Type | Operator | Language |
|---|---|---|---|---|---|---|
| CALL-01 | 02:47:12 | Leïla Benali, 34 (+2 children) | flat 6C, 167 Prado | trapped | Op 2 — L. Ferry | English |
| CALL-02 | 02:48:26 | Roger Fabre, 82 | flat 4A, 167 Prado | trapped | Op 3 — M. Lopez | English |
| CALL-03 | 02:49:41 | Dylan Girard, 24 | flat 7B, 167 Prado | trapped | Op 5 — A. Marchand | English |
| CALL-04 | 02:50:58 | Fatima Belkacem, 67 | flat 5C, 167 Prado | trapped | Op 4 — D. Reeves | **Arabic** (operator not fluent) |
| CALL-05 | 02:52:20 | Théo Marchal, 31 (+ Emma Costa) | flat 3A balcony, 167 Prado | trapped | Op 11 — D. Okafor | English |
| CALL-06 | 02:47:40 | Nadia Ferrand, 41 | 174 av. du Prado, 7th fl (facing) | witness | Op 7 — E. Rossi | English |
| CALL-07 | 02:49:05 | Marc Djemba, 52 | office 163 av. du Prado (north) | witness | Op 10 — K. Ben Salem | English |
| CALL-08 | 02:51:15 | Sami Haddad, 38 | taxi, av. du Prado roadway | witness | Op 6 — R. Fontaine | English |
| CALL-09 | 02:53:36 | Rosa Delgado, 58 | 172 av. du Prado, 6th fl (facing) | witness | Op 9 — S. Klein | **Spanish** (operator schoolbook-level) |
| CALL-10 | 02:55:02 | Bruno Keller, 45 | 165 av. du Prado (adjacent) | witness→evacuee | Op 8 — J. Carvalho | English |

Duty watch officer (supervisor): LT(jg) Paul Vidal. Cross-checks between calls
(same building corner, same windows) are intentional — they let Athena demo
entity resolution: CALL-09 sees CALL-01's family at the 6C corner window;
CALL-08 sees CALL-05 on the 3A balcony.

## Operator protocol reflected in transcripts (French CTA practice)

1. **Location first** ("Fire service, what is the address of the emergency?") —
   confirm street + number + floor + flat before anything else.
2. Nature, then **people**: how many, where, mobility.
3. Survival instructions for trapped callers (doctrine: shelter > flight once
   stairwell is smoke-logged): stay inside, close doors, wet cloth at door
   gaps, low to the floor, show yourself at the window, do NOT break windows
   wide open, NEVER take the lift or a smoke-filled staircase.
4. Reassurance loop: "help is on the way / engines are on scene" + call-back
   promise. Operators log CAD entries (shown as `[CAD]` lines).
5. Witnesses: extract facts (what floor, how many windows, people visible,
   direction of spread), keep them out of danger, use them as remote eyes.

## File format

Each `CALL-xx_*.md` has: metadata table (times, numbers, CAD id), full
timestamped dialogue (`[hh:mm:ss] SPEAKER:`), `[CAD]` dispatch-action lines,
outcome cross-reference to `../05_MASTER_TIMELINE.md`. Foreign-language calls
carry an *(EN: …)* gloss line under each non-English utterance.

## Folder layout (audio)

Each call is a **folder** holding the generated audio and, beside it, the script:

```
CALL-01_trapped_6C_mother_children/
├── CALL-01_trapped_6C_mother_children.mp3   ← two-voice dialogue + SFX (Gradium TTS)
└── script/
    └── CALL-01_trapped_6C_mother_children.md ← this transcript
```

The MP3 uses one consistent voice per person (operator vs caller, gender-matched),
a telephone-line colour on the caller, and scenario SFX (smoke-detector chirp for
trapped callers, approaching siren). See `../audio_tools/` for the generator.
All 10 call MP3s are generated.
