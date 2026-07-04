// Géocodage via la Géoplateforme IGN (data.geopf.fr) — API publique, sans clé.
// Règle produit : l'IA propose, l'humain valide. Un score < SEUIL_FIABLE
// signale une adresse « à confirmer » (bandeau + validation manuelle).

/** En dessous, l'adresse est jugée incertaine → validation humaine requise. */
export const SEUIL_FIABLE = 0.8

export interface ResultatGeocodage {
  lon: number
  lat: number
  /** Score de confiance IGN, 0 → 1. */
  score: number
  /** Libellé normalisé renvoyé par l'IGN. */
  label: string
  /** true si `score >= SEUIL_FIABLE`. */
  fiable: boolean
}

interface FeatureIgn {
  geometry?: { coordinates?: [number, number] }
  properties?: { score?: number; label?: string }
}

/**
 * Géocode une adresse en coordonnées lon/lat.
 *
 * Args:
 *   adresse: Adresse en texte libre (ex. "12 rue des Lilas, Lyon").
 *
 * Returns:
 *   Le meilleur résultat, ou null si l'adresse est introuvable.
 */
export async function geocoder(adresse: string): Promise<ResultatGeocodage | null> {
  const url = new URL('https://data.geopf.fr/geocodage/search')
  url.searchParams.set('q', adresse)
  url.searchParams.set('index', 'address')
  url.searchParams.set('limit', '1')

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Géocodage IGN indisponible (HTTP ${res.status}).`)
  }
  const data = (await res.json()) as { features?: FeatureIgn[] }
  const feature = data.features?.[0]
  const coords = feature?.geometry?.coordinates
  if (!feature || !coords) return null

  const score = feature.properties?.score ?? 0
  return {
    lon: coords[0],
    lat: coords[1],
    score,
    label: feature.properties?.label ?? adresse,
    fiable: score >= SEUIL_FIABLE,
  }
}
