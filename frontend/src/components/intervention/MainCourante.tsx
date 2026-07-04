import { useInterventionStore } from '../../store/useInterventionStore'
import type { Evenement } from '../../typesAthena'
import { BadgeFiabilite } from './BadgeFiabilite'

/** « FEU_HABITATION » → « Feu habitation » */
function libelleEventType(eventType: string): string {
  const txt = eventType.replaceAll('_', ' ').toLowerCase()
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/** Résumé lisible du payload d'un événement. */
function resumePayload(payload: Record<string, unknown>): string {
  if (typeof payload.libelle === 'string' && payload.libelle) return payload.libelle
  if (typeof payload.extrait_source === 'string' && payload.extrait_source) {
    return `« ${payload.extrait_source} »`
  }
  const morceaux = Object.entries(payload)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k} : ${String(v)}`)
  return morceaux.join(' · ')
}

function heureDe(ts: string): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * La main courante : le journal d'événements affiché en chronologie inversée
 * (le plus récent en haut). Elle s'écrit toute seule — c'est le produit.
 */
export function MainCourante() {
  const evenements = useInterventionStore((s) => s.evenements)
  const parPlusRecent = evenements.slice().sort((a, b) => b.event_id - a.event_id)

  return (
    <aside className="main-courante">
      <div className="main-courante__head">
        Main courante
        <span className="main-courante__count">{evenements.length}</span>
      </div>
      {parPlusRecent.length === 0 ? (
        <div className="mc-empty">
          Aucun événement pour l'instant. Le journal s'écrira ici en direct, au fil de
          l'intervention.
        </div>
      ) : (
        <div className="main-courante__liste">
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
    <div className="mc-item">
      <div className="mc-item__top">
        <span className="mc-item__heure">{heureDe(evt.ts_declaration)}</span>
        <span className="mc-item__type">{libelleEventType(evt.event_type)}</span>
        <BadgeFiabilite statut={evt.statut} fiabilite={evt.fiabilite} />
      </div>
      {description && <div className="mc-item__desc">{description}</div>}
      <div className="mc-item__source">source : {evt.source}</div>
    </div>
  )
}
