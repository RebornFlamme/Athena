import { useEntitesRun } from '../../hooks/useEntitesRun'
import { Carte } from './Carte'

/**
 * Carte alimentée par les entités réelles du run de simulation (extraction LLM).
 * Se recentre sur la zone du sinistre dès qu'elle est géolocalisée.
 */
export function CarteRun() {
  const entites = useEntitesRun()
  const geolocalisees = entites.filter((e) => e.lon != null && e.lat != null)
  const centreEntite = geolocalisees.find((e) => e.type === 'zone') ?? geolocalisees[0] ?? null
  return (
    <Carte
      entites={entites}
      centre={centreEntite ? { lon: centreEntite.lon, lat: centreEntite.lat } : null}
    />
  )
}
