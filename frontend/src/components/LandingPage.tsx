import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  AudioLines,
  Bot,
  Building2,
  Database,
  History,
  Layers,
  MapPin,
  MonitorPlay,
  Truck,
  Waypoints,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tiles } from '@/components/ui/tiles'

// Landing page Athena — thème NOIR & BLANC (via le thème zinc clair de shadcn),
// en anglais, composée au maximum de composants shadcn. Hero en deux colonnes
// (titre à gauche, capture du dashboard à droite). La section « problème »
// affiche un champ chaotique de formes d'onde audio (appels simultanés).

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
  { icon: AudioLines, titre: 'Listen', texte: 'Emergency calls are transcribed live, word by word (streaming speech-to-text).' },
  { icon: Bot, titre: 'Understand', texte: 'An LLM agent reads your data model and extracts entities, links and locations.' },
  { icon: Database, titre: 'Remember', texte: 'Every fact lands in an append-only event log. Nothing is ever overwritten.' },
  { icon: MonitorPlay, titre: 'See', texte: 'Tactical map, memory graph and timeline update in real time.' },
]

const CAPACITES = [
  { icon: MapPin, texte: 'Real-time IGN map' },
  { icon: Building2, texte: '3D buildings' },
  { icon: Truck, texte: 'Routed units' },
  { icon: Waypoints, texte: 'Live memory graph' },
  { icon: History, texte: 'RETEX replay' },
  { icon: Layers, texte: 'Sovereign data' },
]

// Appels simultanés, positionnés « au hasard » (valeurs figées → stable + pas de
// re-layout). Certains masqués en mobile pour ne pas déborder.
const APPELS = [
  { top: '2%', left: '1%', rot: -4, w: 240, label: '112 · Incoming', time: '10:39:02', n: 20, mobile: true },
  { top: '30%', left: '15%', rot: 3, w: 214, label: 'Radio · Unit 4', time: '10:39:05', n: 17, mobile: true },
  { top: '60%', left: '3%', rot: -2, w: 232, label: 'Call #002', time: '10:39:07', n: 21, mobile: false },
  { top: '7%', left: '37%', rot: 5, w: 206, label: 'Dispatch', time: '10:39:09', n: 16, mobile: true },
  { top: '46%', left: '41%', rot: -3, w: 242, label: 'Engine 3', time: '10:39:11', n: 20, mobile: false },
  { top: '2%', left: '68%', rot: 2, w: 220, label: 'Medical-2', time: '10:39:12', n: 17, mobile: true },
  { top: '34%', left: '73%', rot: -5, w: 214, label: 'Patrol-6', time: '10:39:14', n: 18, mobile: false },
  { top: '63%', left: '60%', rot: 4, w: 226, label: '112 · Incoming', time: '10:39:16', n: 17, mobile: true },
]

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh bg-white font-sans text-neutral-600 antialiased">
        {/* ───────── Nav ───────── */}
        <header className="sticky top-0 z-50 border-b border-neutral-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo-athena.png" alt="Athena" className="h-7 w-auto" />
              <span className="text-lg font-semibold tracking-tight text-neutral-900">Athena</span>
            </div>
            <nav className="hidden items-center gap-8 text-sm text-neutral-500 md:flex">
              <a href="#problem" className="transition-colors hover:text-neutral-900">The problem</a>
              <a href="#solution" className="transition-colors hover:text-neutral-900">How it works</a>
            </nav>
            <Button asChild size="sm">
              <a href="#contact">Request a demo</a>
            </Button>
          </div>
        </header>

        {/* ───────── Hero (deux colonnes) ───────── */}
        <section className="relative overflow-hidden">
          {/* Fond animé PixelBlast (WebGL, three.js) — tramage monochrome */}
          <HeroBackground />
          <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-neutral-900/[0.06] blur-[110px]" />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
            {/* Carte glassmorphism → le texte ressort au-dessus de la trame animée */}
            <Card className="border-white/60 bg-white/70 p-8 shadow-xl shadow-neutral-300/40 backdrop-blur-md sm:p-10">
              <Reveal>
                <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                  AI-powered crisis intelligence
                </Badge>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tighter text-neutral-900 sm:text-5xl">
                  AI-powered Intelligence for crisis situations.
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-neutral-500">
                  Supreme situational awareness in the field for any team.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <a href="#contact">
                      Request a demo <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/tableau-de-bord">See the dashboard</Link>
                  </Button>
                </div>
              </Reveal>
            </Card>

            <Reveal delay={0.1}>
              <HeroImage />
            </Reveal>
          </div>
        </section>

        {/* ───────── Problème : chaos de formes d'onde ───────── */}
        <section id="problem" className="border-y border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <Badge variant="outline" className="font-medium uppercase tracking-widest">
                  The problem
                </Badge>
                <h2 className="mt-5 text-3xl font-bold tracking-tighter text-neutral-900 sm:text-4xl">
                  In critical moments, miscommunication costs lives and money.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-neutral-500">
                  Orders are misheard, radio communications get missed, and crucial details
                  slip through the cracks — often on many calls at once.
                </p>
              </Reveal>
            </div>

            {/* Champ chaotique d'appels simultanés */}
            <Reveal delay={0.1}>
              <div className="relative mt-12 h-[26rem] overflow-hidden sm:h-[32rem]">
                {APPELS.map((a, i) => (
                  <AppelWidget key={i} appel={a} />
                ))}
                {/* léger voile pour fondre les bords */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-50 via-transparent to-neutral-50" />
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mx-auto mt-8 max-w-2xl text-center text-2xl font-semibold tracking-tighter text-neutral-900">
                Our AI never mishears, never mispeaks, and never forgets.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ───────── Solution + pipeline (DA du dashboard : grille + glass) ───────── */}
        <section id="solution" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <Tiles rows={26} cols={30} tileClassName="border-neutral-200/60" />
          </div>
          <div className="relative mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <Reveal>
                <Badge variant="outline" className="font-medium uppercase tracking-widest">
                  The solution
                </Badge>
                <h2 className="mt-5 text-3xl font-bold tracking-tighter text-neutral-900 sm:text-4xl">
                  We make clarity emerge from chaos.
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-500">
                  One pipeline turns raw voice into a live tactical picture — no keyboard, no
                  manual entry.
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <div className="mt-14 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
                {PIPELINE.map((s, i) => (
                  <Fragment key={s.titre}>
                    <Card className="flex-1 border-white/60 bg-white/70 shadow-lg backdrop-blur-md">
                      <CardHeader className="p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
                            <s.icon className="h-5 w-5" />
                          </span>
                          <span className="font-mono text-xs text-neutral-400">0{i + 1}</span>
                        </div>
                        <CardTitle className="pt-3 text-lg tracking-tight">{s.titre}</CardTitle>
                        <CardDescription className="leading-relaxed">{s.texte}</CardDescription>
                      </CardHeader>
                    </Card>
                    {i < PIPELINE.length - 1 && (
                      <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-neutral-300 lg:rotate-0" />
                    )}
                  </Fragment>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                {['Streaming STT', 'LLM agent · tool-use', 'Schema-driven', 'PostgreSQL · event-sourcing', 'Realtime', 'MapLibre + IGN'].map(
                  (t) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {t}
                    </Badge>
                  ),
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── Section finale : capacités + CTA (fond radar animé) ───────── */}
        <section id="contact" className="relative overflow-hidden border-t border-neutral-200 bg-neutral-950">
          {/* Radar animé (WebGL/ogl) en fond — blanc sur noir (thème N&B) */}
          <RadarBackground />
          <div className="relative z-10 mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {CAPACITES.map((c) => (
                  <Badge
                    key={c.texte}
                    variant="outline"
                    className="gap-1.5 border-white/15 bg-white/5 font-normal text-neutral-300 backdrop-blur-sm"
                  >
                    <c.icon className="h-3.5 w-3.5" />
                    {c.texte}
                  </Badge>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="mx-auto mt-10 max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl">
                  See clarity emerge from chaos.
                </h2>
                <p className="mx-auto mt-4 max-w-md text-lg text-neutral-400">
                  A 20-minute demo on a real scenario is all it takes.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button asChild size="lg" className="bg-white text-neutral-900 hover:bg-neutral-200">
                    <a href="mailto:contact@athena-crise.fr?subject=Athena%20demo%20request">
                      Request a demo <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to="/tableau-de-bord">Explore the dashboard</Link>
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── Footer ───────── */}
        <Separator />
        <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-neutral-400 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/logo-athena.png" alt="" className="h-5 w-auto opacity-80" />
            <span className="font-semibold text-neutral-600">Athena</span>
            <span>· Crisis intelligence</span>
          </div>
          <p>The AI proposes, the human validates.</p>
        </footer>
      </div>
    </MotionConfig>
  )
}

// Fond animé du hero : tramage (dithering) monochrome piloté par WebGL.
// Décoratif → pointer-events-none (les boutons du hero restent cliquables).
// Coupé si l'utilisateur préfère réduire les animations (prefers-reduced-motion).
// three.js + postprocessing (~lourd) sont importés à la demande APRÈS le montage
// (import dynamique dans un effet → code-splitting sans jamais suspendre le rendu,
// donc pas d'erreur « suspended while responding to synchronous input »).
function HeroBackground() {
  const reduce = useReducedMotion()
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    if (reduce) return
    let vivant = true
    import('@/components/PixelBlast').then((m) => {
      if (vivant) setComp(() => m.default)
    })
    return () => {
      vivant = false
    }
  }, [reduce])

  if (reduce || !Comp) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.55]">
      <Comp
        variant="square"
        pixelSize={9}
        color="#525252"
        patternScale={2.4}
        patternDensity={1}
        speed={1}
        edgeFade={0.35}
        enableRipples={false}
        transparent
        autoPauseOffscreen
      />
    </div>
  )
}

// Fond animé de la section finale : radar WebGL (ogl), blanc sur noir.
// Même approche que HeroBackground (import dynamique après montage → code-split,
// pas de suspension du rendu ; coupé si prefers-reduced-motion).
function RadarBackground() {
  const reduce = useReducedMotion()
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    if (reduce) return
    let vivant = true
    import('@/components/Radar').then((m) => {
      if (vivant) setComp(() => m.default)
    })
    return () => {
      vivant = false
    }
  }, [reduce])

  if (reduce || !Comp) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-80">
      <Comp
        color="#ffffff"
        backgroundColor="#000000"
        speed={1}
        scale={0.6}
        ringCount={9}
        spokeCount={12}
        ringThickness={0.04}
        spokeThickness={0.008}
        sweepSpeed={1}
        sweepWidth={2.2}
        sweepLobes={1}
        falloff={2}
        brightness={0.65}
        enableMouseInteraction={false}
      />
    </div>
  )
}

// Capture du tableau de bord, avec repli propre si le fichier n'est pas déposé.
function HeroImage() {
  const [ok, setOk] = useState(true)
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-2xl shadow-neutral-400/40 ring-1 ring-black/5">
      {ok ? (
        <img
          src="/hero_image.png"
          alt="Tableau de bord Athena — carte tactique 3D en temps réel"
          className="block w-full"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-neutral-100 text-neutral-400">
          <div className="flex flex-col items-center gap-2">
            <MapPin className="h-8 w-8" />
            <span className="text-sm">Aperçu du tableau de bord</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Une « carte d'appel » flottante avec une forme d'onde animée.
function AppelWidget({
  appel,
}: {
  appel: (typeof APPELS)[number]
}) {
  return (
    <div
      className={`absolute rounded-xl border border-neutral-200 bg-white/90 p-3.5 shadow-lg shadow-neutral-300/50 backdrop-blur ${
        appel.mobile ? '' : 'hidden sm:block'
      }`}
      style={{
        top: appel.top,
        left: appel.left,
        width: appel.w,
        transform: `rotate(${appel.rot}deg)`,
      }}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-900/50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-900" />
        </span>
        <span className="font-medium text-neutral-700">{appel.label}</span>
        <span className="ml-auto font-mono text-neutral-400">{appel.time}</span>
      </div>
      <Waveform n={appel.n} />
    </div>
  )
}

// Forme d'onde audio : barres qui pulsent (scaleY), désynchronisées via des
// durées/délais déterministes → effet « live » sans JS.
function Waveform({ n }: { n: number }) {
  return (
    <div className="mt-2 flex h-8 items-end justify-center gap-1">
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="wave-bar w-1.5 rounded-full bg-neutral-800"
          style={{
            height: `${50 + ((i * 41) % 50)}%`,
            animationDuration: `${640 + ((i * 97) % 520)}ms`,
            animationDelay: `${(i * 70) % 680}ms`,
          }}
        />
      ))}
    </div>
  )
}
