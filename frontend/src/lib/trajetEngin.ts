import maplibregl from 'maplibre-gl'

// Animation d'un engin le long d'un tracé routier (itinéraire IGN). Deux parties :
//   - logique PURE : interpolation à vitesse constante le long de la polyligne ;
//   - un CONTRÔLEUR qui dessine le tracé et déplace un marqueur camion sur une
//     carte MapLibre (rAF), indépendant de React.

type Coord = [number, number]

/** Distance approx (équirectangulaire) en mètres entre deux lon/lat. */
function distanceM(a: Coord, b: Coord): number {
  const R = 6371000
  const rad = Math.PI / 180
  const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad)
  const y = (b[1] - a[1]) * rad
  return Math.sqrt(x * x + y * y) * R
}

/** Distances cumulées le long du tracé (le dernier élément = longueur totale). */
export function longueursCumulees(coords: Coord[]): number[] {
  const cumul = [0]
  for (let i = 1; i < coords.length; i++) {
    cumul.push(cumul[i - 1] + distanceM(coords[i - 1], coords[i]))
  }
  return cumul
}

/** Cap (degrés, 0 = nord, sens horaire) du segment a → b. */
function capEntre(a: Coord, b: Coord): number {
  const rad = Math.PI / 180
  const dLon = (b[0] - a[0]) * rad
  const y = Math.sin(dLon) * Math.cos(b[1] * rad)
  const x =
    Math.cos(a[1] * rad) * Math.sin(b[1] * rad) -
    Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dLon)
  return (Math.atan2(y, x) / rad + 360) % 360
}

/**
 * Position sur le tracé à la fraction `t` (0→1) de la longueur totale, à vitesse
 * constante (indépendant de la densité des points). Renvoie aussi le cap, utile
 * pour orienter l'icône.
 */
export function positionSurTrace(
  coords: Coord[],
  cumul: number[],
  t: number,
): { lonlat: Coord; cap: number } {
  const total = cumul[cumul.length - 1] || 1
  const cible = Math.max(0, Math.min(1, t)) * total

  let i = 1
  while (i < cumul.length && cumul[i] < cible) i++
  i = Math.min(i, coords.length - 1)

  const a = coords[i - 1]
  const b = coords[i]
  const segLen = cumul[i] - cumul[i - 1] || 1
  const f = (cible - cumul[i - 1]) / segLen
  const lonlat: Coord = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  return { lonlat, cap: capEntre(a, b) }
}

/** Boîte englobante du tracé (pour cadrer la caméra). */
export function bboxTrace(coords: Coord[]): maplibregl.LngLatBoundsLike {
  const b = new maplibregl.LngLatBounds(coords[0], coords[0])
  for (const c of coords) b.extend(c)
  return b
}

// --- Contrôleur d'animation --------------------------------------------------

// Icône camion (lucide `truck`), injectée dans un marqueur HTML.
const SVG_CAMION =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
  '<path d="M15 18H9"/>' +
  '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
  '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'

function creerMarqueurCamion(): HTMLDivElement {
  const el = document.createElement('div')
  el.className =
    'flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_2px_8px_rgba(0,0,0,0.55)] ring-2 ring-white'
  el.innerHTML = SVG_CAMION
  return el
}

export interface OptionsTrajet {
  /** Durée de parcours du tracé entier, en ms (défaut 15 s). */
  dureeMs?: number
  /** Rejouer en boucle (démo). */
  boucle?: boolean
  /** Appelé quand l'engin atteint la destination. */
  onArrive?: () => void
}

/**
 * Anime un marqueur camion le long d'un tracé sur une carte MapLibre, et dessine
 * le tracé. Un contrôleur = un engin. `detruire()` retire tout (marqueur, tracé).
 */
export class ControleurTrajet {
  private raf = 0
  private marqueur: maplibregl.Marker | null = null
  private readonly idSource: string
  private readonly idLigne: string

  constructor(
    private map: maplibregl.Map,
    id = 'engin',
  ) {
    this.idSource = `trajet-${id}`
    this.idLigne = `trajet-${id}-ligne`
  }

  animer(coords: Coord[], opts: OptionsTrajet = {}) {
    this.stopRaf()
    const dureeMs = opts.dureeMs ?? 15000
    const cumul = longueursCumulees(coords)

    // Le tracé (couche vectorielle) exige le style prêt ; le marqueur et
    // l'animation, non → on les lance tout de suite, la ligne se dessine quand
    // le style est chargé (robuste à un fond de carte lent).
    this.dessinerTrace(coords)

    if (!this.marqueur) {
      this.marqueur = new maplibregl.Marker({ element: creerMarqueurCamion() })
        .setLngLat(coords[0])
        .addTo(this.map)
    }

    const debut = performance.now()
    const tick = () => {
      const t = (performance.now() - debut) / dureeMs
      const { lonlat } = positionSurTrace(coords, cumul, t)
      this.marqueur?.setLngLat(lonlat)
      if (t < 1) {
        this.raf = requestAnimationFrame(tick)
      } else {
        opts.onArrive?.()
        if (opts.boucle) this.raf = requestAnimationFrame(() => this.animer(coords, opts))
      }
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** Dessine (ou met à jour) le tracé. Attend le style si pas encore prêt. */
  private dessinerTrace(coords: Coord[]) {
    const trace: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    }
    const source = this.map.getSource(this.idSource) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(trace)
      return
    }
    if (!this.map.isStyleLoaded()) {
      this.map.once('styledata', () => this.dessinerTrace(coords))
      return
    }
    this.map.addSource(this.idSource, { type: 'geojson', data: trace })
    this.map.addLayer({
      id: this.idLigne,
      type: 'line',
      source: this.idSource,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#dc2626', 'line-width': 4, 'line-opacity': 0.85 },
    })
  }

  private stopRaf() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  detruire() {
    this.stopRaf()
    this.marqueur?.remove()
    this.marqueur = null
    // La carte peut déjà être détruite (démontage) → getLayer/removeLayer lèvent.
    try {
      if (this.map.getLayer(this.idLigne)) this.map.removeLayer(this.idLigne)
      if (this.map.getSource(this.idSource)) this.map.removeSource(this.idSource)
    } catch {
      /* carte déjà retirée */
    }
  }
}
