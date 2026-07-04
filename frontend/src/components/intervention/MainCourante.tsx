import { Badge } from '@/components/ui/badge'
import { useInterventionStore } from '../../store/useInterventionStore'
import type { Evenement } from '../../typesAthena'
import { BadgeFiabilite } from './BadgeFiabilite'

/** « VICTIME_SIGNALEE » → « Victime signalee » */
function libelleEventType(eventType: string): string {
  const txt = eventType.replace(/_/g, ' ').toLowerCase()
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/** Résumé lisible du payload d'un événement. */
function resumePayload(payload: Record<string, unknown>): string {
  if (typeof payload.libelle === 'string' && payload.libelle) return payload.libelle
  if (typeof payload.extrait_source === 'string' && payload.extrait_source) {
    return `« ${payload.extrait_source} »`
  }
  return Object.entries(payload)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k} : ${String(v)}`)
    .join(' · ')
}

function heureDe(ts: string): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * La main courante : le journal d'événements en chronologie inversée
 * (le plus récent en haut). Elle s'écrit toute seule — c'est le produit.
 */
export function MainCourante() {
  const evenements = useInterventionStore((s) => s.evenements)
  const parPlusRecent = evenements.slice().sort((a, b) => b.event_id - a.event_id)

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Main courante
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {evenements.length}
        </Badge>
      </div>
      {parPlusRecent.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          Aucun événement pour l'instant. Le journal s'écrira ici en direct, au fil de
          l'intervention.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {parPlusRecent.map((evt) => (
            <LigneEvenement key={evt.event_id} evt={evt} />
          ))}
        </div>
      )}
    </aside>
  )
}

function LigneEvenement({ evt }: { evt: Evenement }) {
  const description = resumePayload(evt.payload)
  return (
    <div className="border-b px-4 py-2.5 text-sm">
      <div className="mb-0.5 flex items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {heureDe(evt.ts_declaration)}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {libelleEventType(evt.event_type)}
        </span>
        <BadgeFiabilite statut={evt.statut} fiabilite={evt.fiabilite} />
      </div>
      {description && <div className="leading-snug">{description}</div>}
      <div className="mt-0.5 text-[11px] text-muted-foreground">source : {evt.source}</div>
    </div>
  )
}
