import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import type { PhaseSim } from '../../sim/useSimulation'
import type { TranscriptSegment } from '../../typesFlux'

/**
 * Transcript de l'appel qui défile en direct pendant la simulation.
 * Opérateur à gauche, appelant à droite (façon fil de conversation).
 */
export function PanneauTranscript({
  heureDebut,
  segments,
  phase,
}: {
  heureDebut: string
  segments: TranscriptSegment[]
  phase: PhaseSim
}) {
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [segments.length])

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Transcription
        <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] font-normal">
          {heureDebut}
        </Badge>
        {phase === 'en_cours' ? (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal normal-case text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> en direct
          </span>
        ) : (
          <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground">
            appel terminé
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {segments.length === 0 ? (
          <p className="p-2 text-sm italic text-muted-foreground">En attente de l'appel…</p>
        ) : (
          segments.map((seg, i) => {
            const estOperateur = seg.locuteur === 'operateur'
            return (
              <div
                key={i}
                className={`flex flex-col ${estOperateur ? 'items-start' : 'items-end'}`}
              >
                <span className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {estOperateur ? 'Opérateur 18' : 'Appelant'}
                </span>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm leading-snug ${
                    estOperateur
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {seg.texte}
                </div>
              </div>
            )
          })
        )}
        <div ref={finRef} />
      </div>
    </div>
  )
}
