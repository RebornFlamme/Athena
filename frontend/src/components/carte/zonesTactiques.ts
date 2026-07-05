import type maplibregl from 'maplibre-gl'

/**
 * Zones tactiques — cercles 2D « au sol » (posés à plat, ils suivent le zoom comme
 * une empreinte géographique, contrairement à un `circle` MapLibre qui reste en
 * espace-écran et fait toujours face à la caméra).
 *
 * Chaque zone = un disque coloré translucide + un contour pointillé, servant à
 * matérialiser un périmètre (sécurité, engagement, danger…) autour d'un point.
 *
 * Rendu en DEUX couches sur une source GeoJSON unique :
 *   • `fill`  → le disque (couleur translucide) ;
 *   • `line`  → le contour, en pointillés (`line-dasharray`, indisponible sur une
 *               couche `circle`, d'où le passage par un polygone).
 *
 * La couleur est portée par chaque feature (`properties.couleur`) et lue via
 * `['get', 'couleur']` → une seule source suffit pour des zones de teintes variées.
 */

export interface ZoneTactique {
  id: string
  /** Centre [lon, lat]. */
  centre: [number, number]
  /** Rayon en mètres. */
  rayon: number
  /** Couleur du disque et du contour (ex. '#f59e0b'). */
  couleur: string
  /** Libellé optionnel (non rendu ici — réservé pour un futur label). */
  libelle?: string
}

/** Presets de teintes (repères pour la mise en valeur dangers / zones tactiques). */
export const TEINTES_ZONE = {
  danger: '#dc2626', // rouge — périmètre de danger
  tactique: '#f59e0b', // ambre — zone tactique / d'engagement
  securite: '#2563eb', // bleu — périmètre de sécurité
} as const

const SRC = 'zones-tactiques'
const CH_FOND = 'zones-tactiques-fond'
const CH_CONTOUR = 'zones-tactiques-contour'

/** Opacité du disque (assez basse pour laisser voir la carte dessous). */
const OPACITE_FOND = 0.16
/** Motif du contour pointillé (longueur du trait, longueur du vide), en multiples
 *  de la largeur de ligne. */
const POINTILLES: [number, number] = [2, 2]

/**
 * Polygone approximant un cercle géodésique par `pas` sommets. Conversion locale
 * mètres → degrés (équirectangulaire) : exacte à l'échelle tactique (< ~1 km), où
 * la courbure terrestre est négligeable.
 */
function cerclePolygone(
  centre: [number, number],
  rayonM: number,
  pas = 72,
): [number, number][] {
  const [lon, lat] = centre
  const dLat = rayonM / 110540 // mètres par degré de latitude
  const dLon = rayonM / (111320 * Math.cos((lat * Math.PI) / 180)) // idem, longitude
  const anneau: [number, number][] = []
  for (let i = 0; i <= pas; i++) {
    const a = (i / pas) * 2 * Math.PI
    anneau.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return anneau // le dernier point égale le premier → anneau fermé
}

function versFeature(z: ZoneTactique): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [cerclePolygone(z.centre, z.rayon)] },
    properties: { id: z.id, couleur: z.couleur, libelle: z.libelle ?? '' },
  }
}

function collection(zones: ZoneTactique[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: zones.map(versFeature) }
}

/**
 * Pose (ou met à jour) les zones tactiques sur la carte. Idempotent : crée la
 * source et les deux couches au premier appel, remplace seulement les données
 * ensuite. `avant` insère les couches sous une couche existante (par défaut sous
 * les libellés de rue, pour qu'ils restent lisibles au-dessus des zones).
 */
export function poserZonesTactiques(
  m: maplibregl.Map,
  zones: ZoneTactique[],
  opts?: { avant?: string },
): void {
  const data = collection(zones)
  const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }

  m.addSource(SRC, { type: 'geojson', data })

  // Couche sous laquelle insérer (labels au-dessus). Repli : au sommet de la pile.
  const avant = opts?.avant ?? 'bm-route-nom'
  const beforeId = m.getLayer(avant) ? avant : undefined

  m.addLayer(
    {
      id: CH_FOND,
      type: 'fill',
      source: SRC,
      paint: {
        'fill-color': ['get', 'couleur'],
        'fill-opacity': OPACITE_FOND,
      },
    },
    beforeId,
  )
  m.addLayer(
    {
      id: CH_CONTOUR,
      type: 'line',
      source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'couleur'],
        'line-width': 2.5,
        'line-opacity': 0.9,
        'line-dasharray': POINTILLES,
      },
    },
    beforeId,
  )
}

/** Met à jour les zones (la source doit déjà exister — sinon no-op). */
export function majZonesTactiques(m: maplibregl.Map, zones: ZoneTactique[]): void {
  const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined
  src?.setData(collection(zones))
}

/** Affiche / masque toutes les zones tactiques. */
export function basculerZonesTactiques(m: maplibregl.Map, visible: boolean): void {
  const v = visible ? 'visible' : 'none'
  for (const id of [CH_FOND, CH_CONTOUR]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', v)
  }
}

/** Retire couches et source (nettoyage). */
export function retirerZonesTactiques(m: maplibregl.Map): void {
  for (const id of [CH_CONTOUR, CH_FOND]) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  if (m.getSource(SRC)) m.removeSource(SRC)
}
