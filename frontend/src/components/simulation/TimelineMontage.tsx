import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { GripVertical, Maximize2, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { formaterMs } from '../../sim/audioMeta'
import type { Appel } from '../../typesSimulation'

// Échelle temps → pixels, réglable (façon logiciel de montage).
const PX_PER_SEC_DEFAUT = 48
const PX_PER_SEC_MIN = 2
const PX_PER_SEC_MAX = 240
const LANE_H = 56 // hauteur d'une piste (px)
const RULER_H = 24 // hauteur de la règle temporelle (px)

interface DragState {
  id: string
  startX: number
  startY: number
  baseTs: number
  basePiste: number
  curTs: number
  curPiste: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Choisit un pas de graduation « rond » adapté à l'échelle courante. */
function pasGraduation(pxPerSec: number): number {
  const cibles = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600] // secondes
  for (const s of cibles) if (s * pxPerSec >= 56) return s * 1000
  return 600_000
}

/**
 * Timeline de montage : chaque appel est un clip dont la position horizontale
 * fixe son instant de déclenchement et la ligne (piste) permet l'overlap.
 * Drag pour déplacer (mécanique en logique pure), relâcher pour persister.
 * L'échelle est réglable ; « Tout afficher » ajuste pour tout voir d'un coup.
 */
export function TimelineMontage({
  appels,
  onDeplacer,
  onSupprimer,
  positionMs,
}: {
  appels: Appel[]
  onDeplacer: (id: string, ts_debut_ms: number, piste: number) => void
  onSupprimer: (appel: Appel) => void
  positionMs?: number | null
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [pxPerSec, setPxPerSec] = useState(PX_PER_SEC_DEFAUT)
  const containerRef = useRef<HTMLDivElement>(null)
  const fitFait = useRef(false)

  const pxPerMs = pxPerSec / 1000
  const pisteMax = appels.reduce((m, a) => Math.max(m, a.piste), 0)
  const nbLanes = pisteMax + 2 // une piste vide sous la dernière pour y déposer
  const finMs = appels.reduce((m, a) => Math.max(m, a.ts_debut_ms + a.duree_ms), 0)
  const totalMs = Math.max(10000, finMs) + 4000
  const largeur = totalMs * pxPerMs
  const hauteur = RULER_H + nbLanes * LANE_H

  function toutAfficher() {
    const w = containerRef.current?.clientWidth ?? 0
    if (w <= 0 || totalMs <= 0) return
    setPxPerSec(clamp((w - 24) / (totalMs / 1000), PX_PER_SEC_MIN, PX_PER_SEC_MAX))
  }

  // Ajustement initial : tout faire tenir dès l'affichage.
  useLayoutEffect(() => {
    if (!fitFait.current && appels.length > 0) {
      fitFait.current = true
      toutAfficher()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appels.length])

  function tsAffiche(a: Appel): number {
    return drag && drag.id === a.id ? drag.curTs : a.ts_debut_ms
  }
  function pisteAffiche(a: Appel): number {
    return drag && drag.id === a.id ? drag.curPiste : a.piste
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>, a: Appel) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({
      id: a.id,
      startX: e.clientX,
      startY: e.clientY,
      baseTs: a.ts_debut_ms,
      basePiste: a.piste,
      curTs: a.ts_debut_ms,
      curPiste: a.piste,
    })
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const curTs = Math.round(clamp(drag.baseTs + dx / pxPerMs, 0, totalMs))
    const curPiste = clamp(drag.basePiste + Math.round(dy / LANE_H), 0, nbLanes - 1)
    setDrag({ ...drag, curTs, curPiste })
  }

  function onPointerUp() {
    if (!drag) return
    onDeplacer(drag.id, drag.curTs, drag.curPiste)
    setDrag(null)
  }

  const tick = pasGraduation(pxPerSec)
  const ticks: number[] = []
  for (let t = 0; t <= totalMs; t += tick) ticks.push(t)

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Scale</span>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => setPxPerSec((p) => clamp(p / 1.5, PX_PER_SEC_MIN, PX_PER_SEC_MAX))}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={() => setPxPerSec((p) => clamp(p * 1.5, PX_PER_SEC_MIN, PX_PER_SEC_MAX))}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={toutAfficher}
          title="Adjust the scale to fit everything"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Fit all
        </Button>
      </div>

      <ScrollArea className="rounded-lg border bg-card" style={{ height: hauteur + 14 }}>
        <div className="relative select-none" style={{ width: largeur, height: hauteur }}>
          {/* Règle temporelle */}
          <div className="absolute inset-x-0 top-0 border-b bg-muted/40" style={{ height: RULER_H }}>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-full items-center border-l border-border pl-1 text-[10px] tabular-nums text-muted-foreground"
                style={{ left: t * pxPerMs }}
              >
                {formaterMs(t)}
              </div>
            ))}
          </div>

          {/* Lignes de pistes */}
          {Array.from({ length: nbLanes }).map((_, i) => (
            <div
              key={i}
              className="absolute inset-x-0 border-b border-border/50"
              style={{ top: RULER_H + i * LANE_H, height: LANE_H }}
            />
          ))}

          {/* Curseur de lecture (piloté par le contrôle flottant) */}
          {positionMs != null && (
            <div
              className="pointer-events-none absolute top-0 z-20 w-0.5 bg-primary"
              style={{ left: positionMs * pxPerMs, height: hauteur }}
            />
          )}

          {/* Clips (appels) */}
          {appels.map((a) => {
            const enDrag = drag?.id === a.id
            const largeurClip = Math.max(40, a.duree_ms * pxPerMs)
            return (
              <div
                key={a.id}
                onPointerDown={(e) => onPointerDown(e, a)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className={`group absolute flex touch-none flex-col justify-center rounded-md border px-2 text-primary-foreground ${
                  enDrag ? 'z-10 cursor-grabbing shadow-lg' : 'cursor-grab'
                } bg-primary/90 hover:bg-primary`}
                style={{
                  left: tsAffiche(a) * pxPerMs,
                  top: RULER_H + pisteAffiche(a) * LANE_H + 6,
                  width: largeurClip,
                  height: LANE_H - 12,
                }}
              >
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3 w-3 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{a.titre}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 shrink-0 opacity-0 hover:bg-white/20 hover:text-white group-hover:opacity-100"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onSupprimer(a)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="truncate pl-4 text-[10px] tabular-nums opacity-80">
                  {formaterMs(tsAffiche(a))} · {formaterMs(a.duree_ms)}
                </div>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
