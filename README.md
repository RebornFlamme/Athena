# 🚨 Athena

**AI copilot for firefighter crisis management.**
Athena listens to emergency calls and radio communications and builds the tactical picture — victims, vehicles, addresses, hazards — on a 3D map, **in real time, with zero manual data entry**.

### 🔗 Live demo
**https://athena-khaki.vercel.app/accueil**

---

## The problem

During a crisis (fire, major accident, mass-casualty event), the emergency call center is overwhelmed: several 112 calls and radio channels come in **at the same time**. Vital information — *where, how many victims, what hazards, which units are engaged* — gets **misheard, forgotten, or lost in the noise**. Manual note-taking can't keep up.

Orders are misunderstood, radio messages slip through the cracks, crucial details disappear — and every piece of lost information costs time, money, and sometimes lives.

## The solution

Athena **listens to everything** and makes **clarity emerge from chaos**. A single pipeline turns raw voice into a living, shared tactical picture — **no keyboard, no data entry**. The AI never mishears, never contradicts itself, and never forgets.

```
   112 calls + radio   (audio, all at once)
                    │
   ┌────────────────▼───────────────────────────────────────┐
   │ 1 · LISTEN      Streaming word-by-word transcription   │  Google Chirp 3
   │                 of several simultaneous calls          │
   ├────────────────────────────────────────────────────────┤
   │ 2 · UNDERSTAND  An LLM agent reads YOUR data model     │  Gemini / Claude
   │                 and extracts entities, links and       │  (tool-use)
   │                 positions — cross-call resolution      │
   ├────────────────────────────────────────────────────────┤
   │ 3 · REMEMBER    Every fact appended to a timestamped,  │  Supabase
   │                 append-only log — never overwritten    │  (event sourcing)
   ├────────────────────────────────────────────────────────┤
   │ 4 · SEE         3D map, memory graph, semantic layer   │  Realtime
   │                 and timeline — all live                │
   └────────────────────────────────────────────────────────┘
```

---

## 🧪 Try the demo (for the jury)

> ⏱️ **Cold start**: the backend (transcription + AI) runs on free-tier hosting. The **very first launch can take 30–60 s to "wake up."** That's normal — please be patient.

**Enter the app:** open **https://athena-khaki.vercel.app/accueil** and click **"See the dashboard."** You land on the dashboard — sidebar on the left, floating controls at the bottom right. Then take your pick:

### Option A — Instant preview (30 seconds, easiest)

To see the result right away, without waiting for real time:

1. On the **Dashboard**, at the **bottom right** of the screen, click the **🧪 (flask)** button — *"Fill with mock objects."*
   → The 3D map and the panels instantly fill with a sample situation (victims, vehicles, locations). Click again to clear.

### Option B — The real real-time simulation (the full experience) ⭐

1. Sidebar → **"Simulation."**
2. Top right, in the **"Active:"** menu, select the **demo scenario**.
3. Sidebar → **"Dashboard."**
4. Bottom right, click **▶ (Play)** — *"Start the demo."*
5. **Watch it happen** 👀: the emergency calls play in real time, the transcription scrolls in the **"Live feed"** panel, and the AI makes victims, vehicles and addresses **appear on their own** on the 3D map — while the memory graph, the semantic layer and the replay timeline fill up.
   - **↺** back to start · **■** stop.

**The Dashboard panels** (draggable, like a command post):

| Panel | Contents |
|---|---|
| **Map** | 3D IGN map, extruded buildings, geolocated entities, vehicle animation from its station |
| **Objects** | The objects extracted by the AI, grouped by type |
| **Live memory** | The AI's memory as a graph, growing live |
| **Semantic Layer Edit** | What the AI understood, with the before/after diff (click → detail) |
| **Live feed** / **Past calls** | The live audio feeds and the past calls with their transcription |

---

## ✨ What sets us apart

- **Zero manual data entry.** The operator types nothing: the AI listens and documents in their place.
- **Real time & multi-call.** Streaming transcription of several **simultaneous** 112 calls + radio channels — the real chaos of a crisis, not a clean file. Conflicts and contradictory information are resolved by prioritization within a structured database. Integrated mapping and geolocation give instant visual context to every voice communication.
- **Extraction driven by YOUR schema.** You *draw* your domain objects (Victim, Vehicle, Location…) in the schema editor; the LLM agent instantiates **exactly those types**, with **cross-call entity resolution** (the same victim mentioned twice = a single object). Compliance-friendly.
- **Sovereign 3D tactical map.** MapLibre + **IGN Géoplateforme** (French public data): 3D buildings (BD TOPO®), geocoding, vehicle routing *station → incident*.
- **Event-sourced memory + replay (after-action review).** Everything is timestamped and append-only; a timeline lets you **scrub back and forth** through the intervention (before / after) for debriefing.
- **Advanced AI-powered voice recognition** that works in noisy environments and adapts to different accents and speech patterns.
- **Explainable — "the AI proposes, the human validates."** The semantic layer shows the diff of every AI decision and its reasoning "stack trace." Nothing is silently overwritten — everything can be traced back.

---

## 🏗️ Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | Vite · React · TypeScript · Tailwind + shadcn/ui · MapLibre GL + IGN · dockview · React Flow · zustand — deployed on **Vercel** |
| **Backend** | FastAPI (Python) on **Render** — Google Cloud Speech-to-Text V2 (Chirp 3) · **Gemini & Anthropic** LLM agents (native tool-use) · PyAV |
| **Data** | **Supabase** — PostgreSQL · Realtime · Storage |

## 📁 Repository structure

- `frontend/` — the React app: schema editor, simulation builder, real-time dashboard
- `poc-stt/` — the Python backend: streaming transcription + LLM extraction agent
- `supabase/` — SQL migrations (versioned schema)
- `Ressources/` — Athena reference data model

## 💻 Run locally

**Frontend:**

```bash
cd frontend
cp .env.example .env.local     # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                    # http://localhost:5173
```

**Backend (transcription + AI), optional:**

```bash
cd poc-stt
# .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, Google Cloud credentials, ANTHROPIC_API_KEY
uv run uvicorn main:app
```

> Access is **open** (Supabase `anon` key + permissive RLS, no authentication) — to be hardened before any real production use.
