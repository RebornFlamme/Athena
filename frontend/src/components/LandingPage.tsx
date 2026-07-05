import { Link } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  AudioLines,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  History,
  Layers,
  MonitorPlay,
  Radio,
  ShieldCheck,
  Siren,
  Truck,
  Waypoints,
} from 'lucide-react'

// Landing page Athena — thème clair, angle TECHNIQUE : décrit la pipeline réelle
// telle qu'implémentée (Chirp 3 → agent Claude schema-driven → PostgreSQL
// event-sourcing → dashboard temps réel IGN). Style explicite (indépendant du thème).

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

const PIPELINE = [
  {
    icon: AudioLines,
    titre: 'Transcription',
    texte: 'Google Speech-to-Text Chirp 3, en streaming. Le MP3 est décodé (PyAV) et poussé au rythme réel ; chaque segment final est écrit en base.',
  },
  {
    icon: Bot,
    titre: 'Agent LLM',
    texte: "Un agent Claude (tool-use natif) tourne par appel. Il lit ton schéma, crée/met à jour des objets, pose les liens et géocode les adresses (IGN).",
  },
  {
    icon: Database,
    titre: 'Event-sourcing',
    texte: 'PostgreSQL : un journal append-only (la vérité) + une projection d’objets. Chaque écriture est tracée, datée, jamais écrasée.',
  },
  {
    icon: MonitorPlay,
    titre: 'Temps réel',
    texte: 'Supabase Realtime pousse tout au dashboard — carte, graphe mémoire, couche sémantique, timeline — en moins de 2 secondes.',
  },
]

const OUTILS = ['query_schema', 'query_instances', 'create_instance', 'update_instance', 'geocoder']

const FEATURES = [
  { icon: Building2, titre: 'Carte 3D IGN', texte: 'MapLibre + fonds IGN, bâtiments en volume (BD TOPO fill-extrusion), géocodage souverain.' },
  { icon: Truck, titre: 'Engins routés', texte: "Caserne la plus proche (OSM) → itinéraire routier IGN → l'engin roule sur la carte." },
  { icon: Waypoints, titre: 'Graphe mémoire', texte: 'Les objets et leurs liens (dérivés du schéma) en direct, façon React Flow. Apparition/modif animées.' },
  { icon: History, titre: 'Rejeu RETEX', texte: 'Un curseur rembobine la chronologie — gratuit grâce au journal d’événements. On revoit tout instant T.' },
  { icon: Layers, titre: 'Couche sémantique', texte: 'Chaque écriture de l’agent est journalisée avec son diff avant/après. Une « stack trace » du raisonnement.' },
  { icon: Activity, titre: 'Schema-driven', texte: 'Tu dessines tes types dans l’éditeur ; l’agent lit ce schéma et n’instancie que ça. Zéro modèle figé.' },
]

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh bg-white font-sans text-slate-600 antialiased">
        {/* ───────── Nav ───────── */}
        <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo-athena.png" alt="Athena" className="h-7 w-auto" />
              <span className="text-lg font-semibold tracking-tight text-slate-900">Athena</span>
            </div>
            <nav className="hidden items-center gap-8 text-sm text-slate-500 md:flex">
              <a href="#pipeline" className="transition-colors hover:text-slate-900">La pipeline</a>
              <a href="#features" className="transition-colors hover:text-slate-900">Ce qui tourne</a>
            </nav>
            <a
              href="#contact"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
            >
              Demander une démo
            </a>
          </div>
        </header>

        {/* ───────── Hero ───────── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-red-500/10 blur-[110px]" />
          <div className="relative mx-auto grid max-w-5xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  <Siren className="h-3.5 w-3.5 text-red-600" />
                  Pipeline temps réel · STT → LLM → PostGIS
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
                  Le poste de commandement qui&nbsp;
                  <span className="text-red-600">se remplit tout seul.</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-500">
                  Transcription <span className="text-slate-800">Chirp 3</span>, agent{' '}
                  <span className="text-slate-800">LLM piloté par ton schéma</span>, PostgreSQL
                  temps réel, carte IGN. La voix devient une SITAC — sans une frappe.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href="#contact"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
                  >
                    Demander une démo <ArrowRight className="h-4 w-4" />
                  </a>
                  <Link
                    to="/tableau-de-bord"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    Voir le tableau de bord
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mt-6 text-xs text-slate-400">
                  Carto IGN souveraine · PostgreSQL · Journal append-only (RETEX gratuit)
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <ConsoleCrise />
            </Reveal>
          </div>

          {/* Chiffres */}
          <div className="mx-auto max-w-5xl px-6 pb-16">
            <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50/60">
              {[
                ['0', 'champ tapé au clavier'],
                ['< 2 s', 'de l’audio à la carte (Realtime)'],
                ['1', 'agent LLM par appel'],
              ].map(([c, l]) => (
                <div key={l} className="px-4 py-6 text-center">
                  <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{c}</div>
                  <div className="mt-1 text-xs text-slate-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── La pipeline ───────── */}
        <section id="pipeline" className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-red-600">La pipeline</p>
              <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Un flux « produce → store → display ».
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((e, i) => (
                <Reveal key={e.titre} delay={i * 0.07}>
                  <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <e.icon className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-xs text-slate-300">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-900">{e.titre}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{e.texte}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Schema-driven ───────── */}
        <section className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-red-600">Schema-driven</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Tu dessines ton modèle. L'IA l'instancie.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-slate-500">
                Pas de schéma figé. Dans l'éditeur, tu dessines tes types (Victime, Engin,
                Lieu…) et leurs relations. L'agent lit ce schéma via ses outils et n'extrait
                que ça — les mêmes objets, reliés, sur la carte et dans le graphe mémoire.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 font-mono text-[13px] leading-relaxed text-slate-300 shadow-xl shadow-slate-300/40">
                <p className="text-slate-500"># la boucle d'outils de l'agent (Claude)</p>
                <div className="mt-3 space-y-1.5">
                  {OUTILS.map((o) => (
                    <div key={o} className="flex items-center gap-2">
                      <span className="text-red-400">›</span>
                      <span className="text-emerald-300">{o}</span>
                      <span className="text-slate-600">()</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-white/10 pt-3 text-slate-500">
                  → écrit dans <span className="text-slate-300">object_instances</span> +{' '}
                  <span className="text-slate-300">agent_journal</span>
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── Ce qui tourne déjà ───────── */}
        <section id="features" className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-red-600">Déjà implémenté</p>
              <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Pas une roadmap. Ce qui tourne.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.titre} delay={i * 0.05}>
                  <div className="h-full rounded-2xl border border-slate-200 bg-white p-6">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 font-semibold text-slate-900">{f.titre}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.texte}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1}>
              <div className="mt-8 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p>
                  <span className="font-medium text-slate-800">Souverain là où ça compte</span> —
                  cartographie IGN et base PostgreSQL, hébergeables en France. STT et LLM sont
                  des briques interchangeables (Chirp 3 / Claude aujourd'hui, modèles FR demain).
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── CTA ───────── */}
        <section id="contact" className="mx-auto max-w-5xl px-6 py-20 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Voyez la carte se construire toute seule.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-slate-500">
              Une démo de 20 minutes sur un scénario réel. Pilote via l'achat innovant (&lt; 140 k€).
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:contact@athena-crise.fr?subject=Demande%20de%20d%C3%A9mo%20Athena"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
              >
                Demander une démo <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/tableau-de-bord"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                Explorer le tableau de bord
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ───────── Footer ───────── */}
        <footer className="border-t border-slate-200">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-400 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src="/logo-athena.png" alt="" className="h-5 w-auto opacity-80" />
              <span className="font-semibold text-slate-600">Athena</span>
              <span>· Fait pour les SDIS</span>
            </div>
            <p>L'IA propose, l'humain valide.</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}

// ---------------------------------------------------------------------------
// Mock visuel du hero (thème clair) : aperçu « produit » — carte tactique +
// appel en cours + main courante. Purement décoratif.
// ---------------------------------------------------------------------------
function ConsoleCrise() {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-300/40">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[11px] text-slate-400">Intervention #142 — Feu d'appartement</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          EN DIRECT
        </span>
      </div>

      <div className="relative h-72 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="rgba(100,116,139,0.14)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <path d="M0 190 L 260 150 L 420 210" fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="7" />
          <path d="M150 0 L 190 160 L 160 288" fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="6" />
        </svg>

        <Marqueur x="46%" y="42%" couleur="bg-red-500" label="Sinistre" ping />
        <Marqueur x="62%" y="58%" couleur="bg-amber-400" label="Fumée" />
        <Marqueur x="34%" y="60%" couleur="bg-sky-500" label="Victime 3ᵉ" />
        <Marqueur x="70%" y="34%" couleur="bg-emerald-500" label="VSAV 12" />

        <div className="absolute right-3 top-3 w-52 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
            <Radio className="h-3.5 w-3.5 text-red-600" /> Appel en cours
          </div>
          <div className="mt-2 flex h-6 items-end gap-0.5">
            {[40, 70, 30, 90, 55, 75, 35, 85, 50, 65, 25, 80, 45].map((h, i) => (
              <span
                key={i}
                className="w-1 animate-pulse rounded-full bg-red-500/70"
                style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
          <div className="mt-3 space-y-1.5 text-[11px]">
            <ChampExtrait label="Adresse" valeur="12 rue des Lilas" />
            <ChampExtrait label="Nature" valeur="Incendie" />
            <ChampExtrait label="Victimes" valeur="2" />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-slate-200 bg-white/95 p-2.5 shadow-md backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Main courante</div>
          <div className="mt-1.5 space-y-1 text-[11px] text-slate-700">
            <p><span className="font-mono text-slate-400">14:02</span> · Victime signalée — 3ᵉ étage</p>
            <p><span className="font-mono text-slate-400">14:03</span> · VSAV 12 engagé sur les lieux</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Marqueur({
  x,
  y,
  couleur,
  label,
  ping,
}: {
  x: string
  y: string
  couleur: string
  label: string
  ping?: boolean
}) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
      <span className="relative flex items-center justify-center">
        {ping && (
          <span className={`absolute inline-flex h-6 w-6 animate-ping rounded-full ${couleur} opacity-40`} />
        )}
        <span className={`relative h-3 w-3 rounded-full ${couleur} ring-2 ring-white`} />
      </span>
      <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        {label}
      </span>
    </div>
  )
}

function ChampExtrait({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium text-slate-800">
        {valeur}
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      </span>
    </div>
  )
}
