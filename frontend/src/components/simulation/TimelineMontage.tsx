import { useRef, useState, type PointerEvent } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formaterMs } from '../../sim/audioMeta'
import type { Appel } from '../../typesSimulation'

// Échelle temps → pixels de la timeline (façon logiciel de montage).
const PX_PER_SEC = 48
const PX_PER_MS = PX_PER_SEC / 1000
const LANE_H = 56 // hauteur d'une piste (px)
const RULER_H = 24 // hauteur de la règle temporelle (px)
const TICK_MS = 5000 // graduation toutes les 5 s

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

/**
 * Timeline de montage : chaque appel est un clip dont la position horizontale
 * fixe son instant de déclenchement et la ligne (piste) permet l'overlap.
 * Drag pour déplacer (mécanique en logique pure), relâcher pour persister.
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
  const zoneRef = useRef<HTMLDivElement>(null)

  const pisteMax = appels.reduce((m, a) => Math.max(m, a.piste), 0)
  const nbLanes = pisteMax + 2 // une piste vide sous la dernière pour y déposer
  const finMs = appels.reduce((m, a) => Math.max(m, a.ts_debut_ms + a.duree_ms), 0)
  const totalMs = Math.max(60000, finMs) + 8000
  const largeur = totalMs * PX_PER_MS

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
    const curTs = Math.round(clamp(drag.baseTs + dx / PX_PER_MS, 0, totalMs))
    const curPiste = clamp(drag.basePiste + Math.round(dy / LANE_H), 0, nbLanes - 1)
    setDrag({ ...drag, curTs, curPiste })
  }

  function onPointerUp() {
    if (!drag) return
    onDeplacer(drag.id, drag.curTs, drag.curPiste)
    setDrag(null)
  }

  const ticks: number[] = []
  for (let t = 0; t <= totalMs; t += TICK_MS) ticks.push(t)

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div
        ref={zoneRef}
        className="relative select-none"
        style={{ width: largeur, height: RULER_H + nbLanes * LANE_H }}
      >
        {/* Règle temporelle */}
        <div className="absolute inset-x-0 top-0 border-b bg-muted/40" style={{ height: RULER_H }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 flex h-full items-center border-l border-border pl-1 text-[10px] tabular-nums text-muted-foreground"
              style={{ left: t * PX_PER_MS }}
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
            style={{ left: positionMs * PX_PER_MS, height: RULER_H + nbLanes * LANE_H }}
          />
        )}

        {/* Clips (appels) */}
        {appels.map((a) => {
          const enDrag = drag?.id === a.id
          const largeurClip = Math.max(40, a.duree_ms * PX_PER_MS)
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
                left: tsAffiche(a) * PX_PER_MS,
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
    </div>
  )
}
