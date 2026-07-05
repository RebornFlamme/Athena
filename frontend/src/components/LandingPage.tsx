import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import {
  ArrowRight,
  AudioLines,
  Bot,
  Building2,
  Database,
  Ear,
  History,
  Layers,
  MapPin,
  MessageSquare,
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
// en anglais, composée au maximum de composants shadcn. Le hero met en avant une
// vraie capture du tableau de bord 3D. Style aligné sur la DA du dashboard
// (quadrillage + cartes glassmorphism).

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

const PROMESSES = [
  {
    icon: Ear,
    titre: 'Never mishears',
    texte: 'Every word from every call and radio message is captured and transcribed, live.',
  },
  {
    icon: MessageSquare,
    titre: 'Never mispeaks',
    texte: 'Structured, verifiable output. The AI proposes, the human validates — always.',
  },
  {
    icon: Database,
    titre: 'Never forgets',
    texte: 'An append-only log keeps the full, timestamped truth — replayable at any moment.',
  },
]

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

        {/* ───────── Hero ───────── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-neutral-900/[0.06] blur-[110px]" />
          <div className="relative mx-auto max-w-4xl px-6 pt-20 text-center lg:pt-24">
            <Reveal>
              <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                AI-powered crisis intelligence
              </Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
                AI-powered Intelligence for crisis situations.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-500">
                Supreme situational awareness in the field for any team.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
          </div>

          {/* Capture du tableau de bord */}
          <Reveal delay={0.15}>
            <div className="mx-auto mt-16 max-w-6xl px-6">
              <HeroImage />
            </div>
          </Reveal>
        </section>

        {/* ───────── Problème ───────── */}
        <section id="problem" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <Badge variant="outline" className="font-medium uppercase tracking-widest">
                The problem
              </Badge>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                In critical moments, miscommunication costs lives and money.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-neutral-500">
                Orders are misheard, radio communications get missed, and crucial details slip
                through the cracks.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-12 max-w-2xl text-center text-2xl font-semibold tracking-tight text-neutral-900">
              Our AI never mishears, never mispeaks, and never forgets.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PROMESSES.map((p, i) => (
              <Reveal key={p.titre} delay={i * 0.08}>
                <Card className="h-full">
                  <CardHeader>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-white">
                      <p.icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="pt-3">{p.titre}</CardTitle>
                    <CardDescription className="leading-relaxed">{p.texte}</CardDescription>
                  </CardHeader>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────── Solution + pipeline (DA du dashboard : grille + glass) ───────── */}
        <section id="solution" className="relative overflow-hidden border-y border-neutral-200 bg-neutral-50">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <Tiles rows={26} cols={30} tileClassName="border-neutral-200/60" />
          </div>
          <div className="relative mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <Reveal>
                <Badge variant="outline" className="font-medium uppercase tracking-widest">
                  The solution
                </Badge>
                <h2 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                  We make clarity emerge from chaos.
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-500">
                  One pipeline turns raw voice into a live tactical picture — no keyboard, no
                  manual entry.
                </p>
              </Reveal>
            </div>

            {/* Pipeline : cartes glassmorphism reliées (comme le dashboard) */}
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
                        <CardTitle className="pt-3 text-lg">{s.titre}</CardTitle>
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

        {/* ───────── Section finale : capacités + CTA ───────── */}
        <section id="contact" className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CAPACITES.map((c) => (
                <Badge key={c.texte} variant="outline" className="gap-1.5 font-normal">
                  <c.icon className="h-3.5 w-3.5" />
                  {c.texte}
                </Badge>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mx-auto mt-10 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                See clarity emerge from chaos.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-lg text-neutral-500">
                A 20-minute demo on a real scenario is all it takes.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <a href="mailto:contact@athena-crise.fr?subject=Athena%20demo%20request">
                    Request a demo <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/tableau-de-bord">Explore the dashboard</Link>
                </Button>
              </div>
            </div>
          </Reveal>
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

// Capture du tableau de bord, avec repli propre si le fichier n'est pas encore
// déposé (public/hero-carte.png).
function HeroImage() {
  const [ok, setOk] = useState(true)
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-2xl shadow-neutral-300/50 ring-1 ring-black/5">
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
