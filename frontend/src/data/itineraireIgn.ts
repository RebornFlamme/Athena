// Itinéraire routier via la Géoplateforme IGN (data.geopf.fr) — API publique,
// sans clé (même fournisseur que le fond de carte). Renvoie le tracé qui suit
// les routes entre deux points + distance/durée → sert à animer le trajet d'un
// engin (caserne → lieu d'intervention).

export interface Itineraire {
  /** Points [lon, lat] du tracé, dans l'ordre départ → arrivée. */
  coords: [number, number][]
  /** Distance routière en mètres. */
  distanceM: number
  /** Durée estimée par le moteur, en secondes. */
  dureeS: number
}

const BASE = 'https://data.geopf.fr/navigation/itineraire'

/**
 * Calcule l'itinéraire routier (profil voiture, le plus rapide) entre deux
 * coordonnées.
 *
 * Args:
 *   depart: [lon, lat] de départ (caserne).
 *   arrivee: [lon, lat] d'arrivée (lieu d'intervention).
 *
 * Returns:
 *   L'itinéraire (tracé + distance + durée), ou null si aucun trajet trouvé.
 */
export async function calculerItineraire(
  depart: [number, number],
  arrivee: [number, number],
): Promise<Itineraire | null> {
  const url = new URL(BASE)
  url.searchParams.set('resource', 'bdtopo-osrm')
  url.searchParams.set('profile', 'car')
  url.searchParams.set('optimization', 'fastest')
  url.searchParams.set('start', `${depart[0]},${depart[1]}`)
  url.searchParams.set('end', `${arrivee[0]},${arrivee[1]}`)
  url.searchParams.set('geometryFormat', 'geojson')

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Itinéraire IGN indisponible (HTTP ${res.status}).`)
  }
  const data = (await res.json()) as {
    geometry?: { coordinates?: [number, number][] }
    distance?: number
    duration?: number
  }
  const coords = data.geometry?.coordinates
  if (!coords || coords.length < 2) return null

  return {
    coords,
    distanceM: data.distance ?? 0,
    dureeS: data.duration ?? 0,
  }
}
