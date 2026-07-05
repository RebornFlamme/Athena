import { Link } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  History,
  MapPin,
  Radio,
  ScrollText,
  ShieldCheck,
  Siren,
  Sparkles,
  X,
} from 'lucide-react'
import { Tiles } from '@/components/ui/tiles'

// Landing page Athena — « le poste de commandement des pompiers qui se remplit
// tout seul ». Page pleine (hors shell sidebar), thème « salle de crise » sombre,
// accents rouge urgence. Style explicite (bg-slate-950…) → indépendant du thème
// clair de l'app.

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
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

const ETAPES = [
  {
    icon: Radio,
    titre: 'Écoute',
    texte: "L'appel 18/112 (et bientôt la radio) est transcrit en direct, en français, dès la première seconde.",
  },
  {
    icon: Brain,
    titre: 'Comprend',
    texte: "Un LLM en sortie structurée extrait l'adresse, la nature du sinistre, les victimes, les moyens. Rien à taper.",
  },
  {
    icon: MapPin,
    titre: 'Cartographie',
    texte: "L'adresse est géocodée (IGN), l'entité apparaît au bon endroit sur la carte tactique, en moins de 2 secondes.",
  },
  {
    icon: History,
    titre: 'Rejoue',
    texte: 'La main courante s’écrit seule, horodatée. En débriefing, on rembobine toute l’intervention en un clic.',
  },
]

const FONCTIONS = [
  {
    icon: Sparkles,
    titre: 'Extraction des appels',
    texte: "Transcription live + extraction structurée (adresse, nature, victimes, moyens). L'adresse est validée par géocodage IGN — l'IA propose, l'humain valide.",
  },
  {
    icon: MapPin,
    titre: 'Carte temps réel',
    texte: 'MapLibre + fonds IGN souverains. Victimes, moyens, zones et dangers apparaissent au bon endroit, lisibles en un coup d’œil, sur tablette comme sur desktop.',
  },
  {
    icon: ScrollText,
    titre: 'Main courante automatique',
    texte: 'Un journal d’événements horodaté qui se remplit seul. Chaque info garde sa source et sa fiabilité ; une correction s’ajoute, rien n’est effacé.',
  },
  {
    icon: History,
    titre: 'Rejeu RETEX',
    texte: 'Grâce au journal d’événements, on revoit l’état de la situation à n’importe quel instant T. Le débriefing devient une simple relecture.',
  },
]

const COMPARATIF = [
  { nom: 'Athena', ia: true, manuel: false, souv: true, fort: true },
  { nom: 'NexSIS 18-112', ia: false, manuel: true, souv: true, fort: false },
  { nom: 'Crimson (SITAC)', ia: false, manuel: true, souv: true, fort: false },
  { nom: 'Tablet Command', ia: false, manuel: true, souv: false, fort: false },
  { nom: 'Prepared / Axon', ia: true, manuel: false, souv: false, fort: false },
]

const CONFIANCE = [
  {
    icon: ShieldCheck,
    titre: 'Souverain par conception',
    texte: 'PostgreSQL, cartographie IGN, hébergement français (OVH / Scaleway), anticipation SecNumCloud. Vos données restent en France.',
  },
  {
    icon: CheckCircle2,
    titre: "L'IA propose, l'humain valide",
    texte: "Jamais de décision autonome sur une donnée critique. Une adresse au score faible déclenche une validation humaine.",
  },
  {
    icon: ScrollText,
    titre: 'Traçable et fiable',
    texte: 'Journal append-only, double horodatage (observation / remontée), niveau de fiabilité (code Admiralty) sur chaque information.',
  },
]

function Coche({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400" />
  ) : (
    <X className="mx-auto h-5 w-5 text-slate-600" />
  )
}

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh bg-slate-950 font-sans text-slate-200 antialiased">
        {/* ───────── Nav ───────── */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo-athena.png" alt="Athena" className="h-8 w-auto invert" />
              <span className="text-lg font-semibold tracking-tight text-white">Athena</span>
            </div>
            <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
              <a href="#probleme" className="transition-colors hover:text-white">Le problème</a>
              <a href="#demarche" className="transition-colors hover:text-white">Comment ça marche</a>
              <a href="#fonctions" className="transition-colors hover:text-white">Fonctionnalités</a>
              <a href="#confiance" className="transition-colors hover:text-white">Souveraineté</a>
            </nav>
            <a
              href="#contact"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition-colors hover:bg-red-500"
            >
              Demander une démo
            </a>
          </div>
        </header>

        {/* ───────── Hero ───────── */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="pointer-events-none absolute inset-0 opacity-[0.35]">
            <Tiles rows={30} cols={26} tileClassName="border-white/[0.04]" />
          </div>
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-red-600/20 blur-[120px]" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                  <Siren className="h-3.5 w-3.5 text-red-500" />
                  Dashboard de crise · Sapeurs-pompiers
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Le poste de commandement qui&nbsp;
                  <span className="text-red-500">se remplit tout seul.</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
                  Athena écoute les appels du 18/112, comprend la situation et dessine la
                  carte tactique <span className="text-slate-200">en temps réel</span>.
                  Zéro saisie au clavier — le COS garde les yeux sur le terrain.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href="#contact"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition-colors hover:bg-red-500"
                  >
                    Demander une démo <ArrowRight className="h-4 w-4" />
                  </a>
                  <Link
                    to="/tableau-de-bord"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Voir le tableau de bord
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mt-6 text-xs text-slate-500">
                  Cartographie IGN souveraine · Conforme RGPD · L'IA propose, l'humain valide
                </p>
              </Reveal>
            </div>

            {/* Mock « console de crise » */}
            <Reveal delay={0.1}>
              <ConsoleCrise />
            </Reveal>
          </div>
        </section>

        {/* ───────── Bandeau chiffres ───────── */}
        <section className="border-b border-white/5 bg-white/[0.02]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-6 py-2 sm:grid-cols-4">
            {[
              ['0', 'champ tapé pendant la démo'],
              ['< 2 s', 'pour afficher une entité sur la carte'],
              ['≥ 90 %', "d'infos clés extraites correctement"],
              ['155-250 s', 'économisées par SITAC (source IHM’19)'],
            ].map(([chiffre, label]) => (
              <div key={label} className="px-4 py-6 text-center">
                <div className="text-2xl font-bold text-white sm:text-3xl">{chiffre}</div>
                <div className="mt-1 text-xs leading-snug text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── Problème (avant) ───────── */}
        <section id="probleme" className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-red-500">Le problème</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              L'information vitale circule à la voix. Puis se ressaisit à la main.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <p className="text-lg leading-relaxed text-slate-400">
                Au poste de commandement, quatre officiers tiennent chacun leur tableau
                papier et recopient la même information — du tableau à la SITAC, de la SITAC
                à la main courante. C'est lent, faillible, et ça détourne le commandant de sa
                mission.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Ressaisie multiple de la même information',
                  'Oublis et erreurs quand tout va vite',
                  'Le COS regarde des tableaux au lieu du terrain',
                  'RETEX laborieux à reconstituer après coup',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-300">
                    <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500/80" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
                <blockquote className="text-lg leading-relaxed text-slate-300">
                  « Un témoin crie au téléphone : <span className="text-white">"une personne
                  âgée est bloquée au 3ᵉ&nbsp;!"</span>. Aujourd'hui, il faut qu'un officier le
                  note, qu'un autre le reporte sur la SITAC — 90 secondes et un risque
                  d'oubli. »
                </blockquote>
                <figcaption className="mt-6 border-t border-white/10 pt-4 text-sm text-slate-500">
                  Le PC repose sur 4 tableaux papier séparés avec recopie manuelle.
                  <span className="text-slate-400"> — Mémento Chef de Colonne, ENSOSP</span>
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ───────── Comment ça marche (après) ───────── */}
        <section id="demarche" className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">La solution</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                De la voix à la carte, sans toucher un clavier.
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {ETAPES.map((e, i) => (
                <Reveal key={e.titre} delay={i * 0.08}>
                  <div className="relative h-full rounded-2xl border border-white/10 bg-slate-900/40 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/15 text-red-400">
                        <e.icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-mono text-slate-600">0{i + 1}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-white">{e.titre}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{e.texte}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Fonctionnalités ───────── */}
        <section id="fonctions" className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-red-500">Le produit</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Une salle de crise augmentée, pas un formulaire de plus.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {FONCTIONS.map((f, i) => (
              <Reveal key={f.titre} delay={i * 0.06}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-red-500/30 hover:bg-white/[0.05]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-400">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-white">{f.titre}</h3>
                  <p className="mt-2 leading-relaxed text-slate-400">{f.texte}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────── Comparatif ───────── */}
        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Pourquoi Athena</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Le seul qui écoute, comprend et remplit tout seul.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-12 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="px-5 py-4 text-left font-semibold text-slate-400">Solution</th>
                      <th className="px-5 py-4 font-semibold text-slate-400">Extraction IA vocale</th>
                      <th className="px-5 py-4 font-semibold text-slate-400">Zéro saisie manuelle</th>
                      <th className="px-5 py-4 font-semibold text-slate-400">Souveraineté FR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARATIF.map((row) => (
                      <tr
                        key={row.nom}
                        className={`border-b border-white/5 last:border-0 ${
                          row.fort ? 'bg-red-600/10' : ''
                        }`}
                      >
                        <td className="px-5 py-4 text-left font-medium text-white">
                          <span className="flex items-center gap-2">
                            {row.fort && <Siren className="h-4 w-4 text-red-500" />}
                            {row.nom}
                          </span>
                        </td>
                        <td className="px-5 py-4"><Coche ok={row.ia} /></td>
                        <td className="px-5 py-4"><Coche ok={!row.manuel} /></td>
                        <td className="px-5 py-4"><Coche ok={row.souv} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── Confiance / souveraineté ───────── */}
        <section id="confiance" className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-red-500">Confiance</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Des données de vie ou de mort. Traitées comme telles.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {CONFIANCE.map((c, i) => (
              <Reveal key={c.titre} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{c.titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.texte}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────── CTA final ───────── */}
        <section id="contact" className="border-t border-white/5">
          <div className="relative mx-auto max-w-6xl overflow-hidden px-6 py-24">
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-red-600/20 blur-[120px]" />
            <div className="relative text-center">
              <Reveal>
                <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Faites de votre PC une salle de crise augmentée.
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400">
                  Une démo de 20 minutes suffit pour voir la carte se construire toute seule.
                  Pilote accessible par l'achat innovant (&lt; 140 k€, sans appel d'offres).
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="mailto:contact@athena-crise.fr?subject=Demande%20de%20d%C3%A9mo%20Athena"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition-colors hover:bg-red-500"
                  >
                    Demander une démo <ArrowRight className="h-4 w-4" />
                  </a>
                  <Link
                    to="/tableau-de-bord"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Explorer le tableau de bord
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ───────── Footer ───────── */}
        <footer className="border-t border-white/5">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src="/logo-athena.png" alt="" className="h-6 w-auto invert opacity-80" />
              <span className="font-semibold text-slate-300">Athena</span>
              <span className="text-slate-600">· Fait pour les SDIS</span>
            </div>
            <p>L'IA propose, l'humain valide.</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}

// ---------------------------------------------------------------------------
// Mock visuel du hero : une « console de crise » (carte tactique + appel en
// cours + main courante) — purement décoratif, aucune donnée réelle.
// ---------------------------------------------------------------------------
function ConsoleCrise() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-2xl shadow-black/50 backdrop-blur">
      {/* barre de fenêtre */}
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[11px] text-slate-500">Athena · Intervention #142 — Feu d'appartement</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-red-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          EN DIRECT
        </span>
      </div>

      {/* carte tactique factice */}
      <div className="relative h-72 overflow-hidden rounded-lg border border-white/10 bg-slate-950">
        <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden>
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <path d="M0 190 L 260 150 L 420 210" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="6" />
          <path d="M150 0 L 190 160 L 160 288" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="5" />
        </svg>

        {/* marqueurs */}
        <Marqueur x="46%" y="42%" couleur="bg-red-500" label="Sinistre" ping />
        <Marqueur x="62%" y="58%" couleur="bg-amber-400" label="Fumée" />
        <Marqueur x="34%" y="60%" couleur="bg-sky-400" label="Victime 3ᵉ" />
        <Marqueur x="70%" y="34%" couleur="bg-emerald-400" label="VSAV 12" />

        {/* carte « appel en cours » */}
        <div className="absolute right-3 top-3 w-52 rounded-lg border border-white/10 bg-slate-900/90 p-3 backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
            <Radio className="h-3.5 w-3.5 text-red-400" /> Appel en cours
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

        {/* main courante */}
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-white/10 bg-slate-900/85 p-2.5 backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Main courante</div>
          <div className="mt-1.5 space-y-1 text-[11px] text-slate-300">
            <p><span className="font-mono text-slate-500">14:02</span> · Victime signalée — 3ᵉ étage</p>
            <p><span className="font-mono text-slate-500">14:03</span> · VSAV 12 engagé sur les lieux</p>
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
        <span className={`relative h-3 w-3 rounded-full ${couleur} ring-2 ring-slate-950`} />
      </span>
      <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-300">
        {label}
      </span>
    </div>
  )
}

function ChampExtrait({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium text-slate-200">
        {valeur}
        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
      </span>
    </div>
  )
}
