// Caserne de pompiers réelle la plus proche d'un point, via OpenStreetMap
// (Overpass, `amenity=fire_station`) — sans clé. Sert d'origine au trajet d'un
// engin quand les données métier ne fournissent pas de caserne de départ.

export interface Caserne {
  lon: number
  lat: number
  nom: string
}

const OVERPASS = 'https://overpass-api.de/api/interpreter'
/** Rayons de recherche successifs (m) : on élargit si rien de proche. */
const RAYONS = [8000, 25000]

interface ElementOsm {
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: { name?: string }
}

function versCaserne(e: ElementOsm): Caserne | null {
  const lat = e.type === 'node' ? e.lat : e.center?.lat
  const lon = e.type === 'node' ? e.lon : e.center?.lon
  if (lat == null || lon == null) return null
  return { lon, lat, nom: e.tags?.name ?? 'Caserne' }
}

/** Distance approx (m) entre deux points, pour comparer (pas besoin d'exact). */
function distanceM(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const x = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)
  const y = a.lat - b.lat
  return Math.hypot(x, y)
}

/**
 * Trouve la caserne de pompiers la plus proche d'une position.
 *
 * Args:
 *   lon, lat: position de référence (le lieu d'intervention).
 *
 * Returns:
 *   La caserne la plus proche, ou null si aucune trouvée dans les rayons testés.
 */
export async function caserneLaPlusProche(lon: number, lat: number): Promise<Caserne | null> {
  const cible = { lon, lat }
  for (const rayon of RAYONS) {
    const q =
      `[out:json][timeout:15];(` +
      `node["amenity"="fire_station"](around:${rayon},${lat},${lon});` +
      `way["amenity"="fire_station"](around:${rayon},${lat},${lon});` +
      `relation["amenity"="fire_station"](around:${rayon},${lat},${lon});` +
      `);out center;`

    let data: { elements?: ElementOsm[] }
    try {
      const res = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      })
      if (!res.ok) continue
      data = (await res.json()) as { elements?: ElementOsm[] }
    } catch {
      continue
    }

    const casernes = (data.elements ?? [])
      .map(versCaserne)
      .filter((c): c is Caserne => c !== null)
    if (casernes.length > 0) {
      return casernes.reduce((best, c) =>
        distanceM(c, cible) < distanceM(best, cible) ? c : best,
      )
    }
  }
  return null
}
