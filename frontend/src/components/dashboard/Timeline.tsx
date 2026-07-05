import { useEffect, useMemo, useRef, type PointerEvent } from 'react'
import { Pause, Play, Radio, SkipBack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formaterMs } from '../../sim/audioMeta'
import { useInstancesDB } from '../../hooks/useInstancesDB'
import { useSemanticEditsDB } from '../../hooks/useJournalAgentDB'
import { useTimeline } from '../../store/useTimeline'

// Timeline de montage : un curseur (playhead) balaye la chronologie d'extraction.
// Chaque édit sémantique est un repère coloré ; glisser/cliquer positionne le
// curseur → carte, objets et couche sémantique n'affichent que ce qui existait
// à cet instant (« revoir apparaître » les entités et les animations).

const COULEUR_KIND: Record<string, string> = {
  creation: '#22c55e',
  modification: '#f59e0b',
  suppression: '#ef4444',
}

function tempsDe(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

export function Timeline() {
  // Données BRUTES (non filtrées) pour tracer toute la piste et calculer les bornes.
  const edits = useSemanticEditsDB()
  const instances = useInstancesDB()

  const { t0, tMax } = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    const push = (iso?: string | null) => {
      if (!iso) return
      const t = tempsDe(iso)
      if (t === 0) return
      if (t < min) min = t
      if (t > max) max = t
    }
    for (const e of edits) push(e.cree_le)
    for (const i of instances) {
      push(i.cree_le)
      push(i.maj_le)
    }
    return min === Infinity ? { t0: 0, tMax: 0 } : { t0: min, tMax: max }
  }, [edits, instances])

  const setBornes = useTimeline((s) => s.setBornes)
  const curseur = useTimeline((s) => s.curseur)
  const suit = useTimeline((s) => s.suit)
  const enLecture = useTimeline((s) => s.enLecture)
  const setCurseur = useTimeline((s) => s.setCurseur)
  const activerSuivi = useTimeline((s) => s.activerSuivi)
  const play = useTimeline((s) => s.play)
  const pause = useTimeline((s) => s.pause)
  const revenirDebut = useTimeline((s) => s.revenirDebut)

  useEffect(() => {
    if (tMax > t0) setBornes(t0, tMax)
  }, [t0, tMax, setBornes])

  const span = tMax - t0
  const pct = (t: number) => (span > 0 ? ((t - t0) / span) * 100 : 0)

  const trackRef = useRef<HTMLDivElement>(null)
  const glisse = useRef(false)

  function tempsAuPointeur(clientX: number): number | null {
    const el = trackRef.current
    if (!el || span <= 0) return null
    const r = el.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return t0 + p * span
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (span <= 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointeur non capturable (ex. évènement synthétique) */
    }
    glisse.current = true
    const t = tempsAuPointeur(e.clientX)
    if (t != null) setCurseur(t)
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!glisse.current) return
    const t = tempsAuPointeur(e.clientX)
    if (t != null) setCurseur(t)
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    glisse.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const vide = span <= 0

  return (
    <div className="flex items-center gap-2 border-b bg-white/70 px-3 py-2 backdrop-blur-md">
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={vide}
          onClick={revenirDebut}
          title="Revenir au début"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={vide}
          onClick={() => (enLecture ? pause() : play())}
          title={enLecture ? 'Pause' : 'Rejouer la chronologie'}
        >
          {enLecture ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`relative h-8 flex-1 touch-none select-none rounded-md border bg-muted/40 ${
          vide ? 'opacity-60' : 'cursor-pointer'
        }`}
      >
        {vide ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] italic text-muted-foreground">
            Lancez une simulation pour suivre la chronologie
          </span>
        ) : (
          <>
            {/* Repères d'évènements (édits sémantiques), colorés par type. */}
            {edits.map((e) => (
              <span
                key={e.id}
                className="pointer-events-none absolute top-1.5 h-5 w-[3px] -translate-x-1/2 rounded-full opacity-80"
                style={{ left: `${pct(tempsDe(e.cree_le))}%`, background: COULEUR_KIND[e.kind] ?? '#9ca3af' }}
                title={`${e.objet ?? ''} · ${e.kind}`}
              />
            ))}
            {/* Playhead */}
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-primary"
              style={{ left: `${pct(curseur)}%` }}
            >
              <div className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow ring-2 ring-white" />
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="w-[92px] text-right text-[11px] tabular-nums text-muted-foreground">
          {vide ? '—' : `${formaterMs(Math.max(0, curseur - t0))} / ${formaterMs(span)}`}
        </span>
        <Button
          size="sm"
          variant={suit ? 'default' : 'outline'}
          className="h-7 gap-1.5 text-xs"
          disabled={vide}
          onClick={activerSuivi}
          title="Revenir au direct"
        >
          <Radio className={`h-3.5 w-3.5 ${suit ? 'animate-pulse' : ''}`} /> Live
        </Button>
      </div>
    </div>
  )
}
