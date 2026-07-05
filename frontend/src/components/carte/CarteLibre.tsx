import { useEffect, useRef, useState, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Box, Boxes, Building2, Keyboard, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { construireStyle, paintFor, THEMES_UI, type ThemeKey } from './mapTheme'
import { EtagesTroisD } from '../batiment/EtagesTroisD'
import { POINT_INTERIEUR_WGS84, LEGENDE } from '../batiment/batiment'
import {
  creerCoucheEtages,
  OPTIONS_ETAGES_DEFAUT,
  type CoucheEtages,
  type OptionsEtages,
} from '../batiment/EtagesCustomLayer'

/**
 * Carte de navigation libre — fond vectoriel OpenFreeMap (schéma OpenMapTiles,
 * sans clé d'API), avec trois thèmes commutables dans la carte :
 *   • tactique (crème, défaut) · osm (coloré classique) · douce (coloré désaturé).
 * Voir `mapTheme.ts` pour les palettes. La bascule de thème permute seulement les
 * `paint` (instantané) ; elle vaut aussi bien en 2D qu'en 3D.
 *
 *  • Mode 2D : sol vu de dessus.
 *  • Mode 3D : MÊME sol + bâtiments extrudés ; couleur et transparence des volumes
 *    réglables en direct. La bascule n'affecte que l'extrusion et l'inclinaison.
 */

/** Paris 9e — 14 rue Le Peletier, près du bd Haussmann (scénario PELETIER-14). */
const CENTRE: [number, number] = [2.338184, 48.872609]
const ZOOM_INITIAL = 16
const PITCH_3D = 55

/** Cadrage « bâtiment » pour la touche C (centre + zoom rapproché, en douceur). */
const ZOOM_BATIMENT = 18
/** Avant d'ouvrir la 3D interactive : la caméra CENTRE + ZOOME (pas d'inclinaison,
 *  pas de rotation). Animation rapide. */
const DUREE_3D_INTERACTIF = 400
const ZOOM_3D_INTERACTIF = 18.5

/** Bâtiments 3D du fond : beige clair, transparence 60 % par défaut. */
const COULEUR_3D_DEFAUT = '#e0d0ad'
const TRANSPARENCE_DEFAUT = 0.6 // → opacité 0.4
const THEME_DEFAUT: ThemeKey = 'douce'

/**
 * Sensibilité de la rotation/inclinaison au Ctrl (ou clic droit) + glisser.
 * MapLibre calcule par défaut le cap d'après l'angle du curseur autour du centre,
 * ce qui donne une rotation « en miroir » de l'attente « glisser à droite = tourner
 * à droite ». On remplace par une rotation LINÉAIRE : glisser à droite augmente le
 * cap (tourne à droite), glisser vers le haut incline vers l'horizon.
 */
const SENS_ROTATION = 0.35 // degrés de cap par pixel horizontal
const SENS_INCLINAISON = 0.4 // degrés d'inclinaison par pixel vertical

const STYLE = construireStyle(THEME_DEFAUT, {
  couleur: COULEUR_3D_DEFAUT,
  opacite: 1 - TRANSPARENCE_DEFAUT,
})

/** Couche personnalisée « découpe d'étages » (Three.js). */
const CCH_ETAGES = 'etages-batiment'

/** Source vectorielle des bâtiments (définie dans mapTheme). */
const SRC_BATI = 'ofm'
const SL_BATI = 'building'
/** Couche des volumes 3D du fond OFM (définie dans mapTheme) — non utilisée :
 *  OFM fusionne des centaines de bâtiments par feature, on la remplace. */
const CH_BATI_3D = 'batiments-3d'

/**
 * Bâtiments RÉELS individuels (dérivés des tuiles OFM par décomposition des
 * MultiPolygons fusionnés, ~2000 bâtiments dans 650 m, `public/batiments_peletier.json`).
 * Même densité/hauteurs qu'OFM mais un polygone par bâtiment → on peut EXCLURE le
 * seul sinistré (`incident:true`) pour l'afficher en découpe d'étages. Sert de
 * couche 3D unique (les deux modes), donc rien ne « disparaît » en passant en étages.
 */
const SRC_BATI_REEL = 'bati-reel'
const CH_BATI_REEL = 'batiments-reel-3d'
const URL_BATI_REEL = '/batiments_peletier.json'

/** Test point-dans-polygone (ray casting) sur un anneau [lon,lat][]. */
function pointDansAnneau(pt: [number, number], ring: number[][]): boolean {
  let dedans = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      dedans = !dedans
    }
  }
  return dedans
}

function featureContient(f: maplibregl.GeoJSONFeature, pt: [number, number]): boolean {
  const g = f.geometry
  const polys =
    g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polys.some((poly) => pointDansAnneau(pt, poly[0] as number[][]))
}

/** Touche stylée (rendu clavier). */
function Touche({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

/** Panneau des raccourcis, calqué sur ceux de Google Earth. */
function AideRaccourcis({ onFermer }: { onFermer: () => void }) {
  const lignes: { action: string; touches: ReactNode }[] = [
    { action: 'Se déplacer', touches: <>Flèches <span className="text-muted-foreground">ou</span> glisser</> },
    { action: 'Zoomer', touches: <>Molette · <Touche>Page ↑</Touche> · double-clic</> },
    { action: 'Dézoomer', touches: <><Touche>Page ↓</Touche> · double-clic droit</> },
    { action: 'Pivoter', touches: <><Touche>Maj</Touche> + <Touche>←</Touche>/<Touche>→</Touche> · clic droit / <Touche>Ctrl</Touche> + glisser</> },
    { action: 'Incliner', touches: <><Touche>Maj</Touche> + <Touche>↑</Touche>/<Touche>↓</Touche> · clic droit / <Touche>Ctrl</Touche> + glisser</> },
    { action: 'Vue vers le nord', touches: <Touche>N</Touche> },
    { action: 'Vue de dessus', touches: <Touche>U</Touche> },
    { action: 'Réinitialiser la vue', touches: <Touche>R</Touche> },
    { action: 'Basculer 2D / 3D', touches: <Touche>O</Touche> },
    { action: 'Centrer sur le bâtiment', touches: <Touche>C</Touche> },
    { action: 'Vue étages', touches: <Touche>E</Touche> },
    { action: '3D interactive', touches: <Touche>I</Touche> },
    { action: 'Stopper le mouvement', touches: <Touche>Espace</Touche> },
    { action: 'Afficher cette aide', touches: <Touche>?</Touche> },
  ]
  return (
    <Card className="absolute bottom-10 right-14 w-80 max-w-[calc(100vw-4rem)] p-0 shadow-lg">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Contrôles (façon Google Earth)</span>
        <button
          type="button"
          onClick={onFermer}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-1">
        {lignes.map((l) => (
          <div
            key={l.action}
            className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-xs hover:bg-muted/60"
          >
            <span className="text-muted-foreground">{l.action}</span>
            <span className="flex flex-wrap items-center justify-end gap-1 text-right">{l.touches}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Sélecteur de thème de fond de carte (segmenté, laissé visible dans la carte). */
function SelecteurTheme({ theme, onChange }: { theme: ThemeKey; onChange: (t: ThemeKey) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border bg-background/95 shadow-md" role="group" aria-label="Thème de carte">
      {THEMES_UI.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          aria-pressed={theme === t.key}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium transition-colors',
            theme === t.key ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Vue initiale : `?vue=3d` dans l'URL ouvre directement en 3D (deep-link). */
function vueInitiale3D(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('vue') === '3d'
}

/** `?etages=1` ouvre directement sur la découpe d'étages (deep-link). */
function etagesInitial(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('etages') === '1'
}

export function CarteLibre({ onCarte }: { onCarte?: (map: maplibregl.Map) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onCarteRef = useRef(onCarte)
  onCarteRef.current = onCarte
  const [is3D, setIs3D] = useState(vueInitiale3D)
  const [couleur, setCouleur] = useState(COULEUR_3D_DEFAUT)
  const [transparence, setTransparence] = useState(TRANSPARENCE_DEFAUT)
  const [aide, setAide] = useState(false)
  const [theme, setTheme] = useState<ThemeKey>(THEME_DEFAUT)
  const [etages, setEtages] = useState(etagesInitial)
  const [interactif3D, setInteractif3D] = useState(false)
  const [cap3D, setCap3D] = useState(0) // cap carte hérité par la vue 3D interactive
  const [optEtages, setOptEtages] = useState<OptionsEtages>(OPTIONS_ETAGES_DEFAUT)
  const coucheEtagesRef = useRef<CoucheEtages | null>(null)
  const rebuildVoisRef = useRef<(() => void) | null>(null)
  const interactif3DRef = useRef(interactif3D)
  interactif3DRef.current = interactif3D
  const is3DRef = useRef(is3D)
  is3DRef.current = is3D
  const etagesRef = useRef(etages)
  etagesRef.current = etages
  const couleurRef = useRef(couleur)
  couleurRef.current = couleur
  const transparenceRef = useRef(transparence)
  transparenceRef.current = transparence

  /** Applique une opération quand le style est prêt (sinon au prochain `load`). */
  function quandPret(m: maplibregl.Map, fn: () => void) {
    if (m.isStyleLoaded()) fn()
    else m.once('load', fn)
  }

  /**
   * Volumes 3D. Le fond OFM (`CH_BATI_3D`) fusionne des centaines de bâtiments par
   * feature — impossible d'en isoler un — donc on ne l'affiche jamais et on le
   * REMPLACE par nos bâtiments individuels réels (`CH_BATI_REEL`, dérivés des mêmes
   * tuiles OFM mais décomposés). Ces derniers sont visibles dès qu'on est en 3D,
   * dans les deux modes → aucun bâtiment ne « disparaît » quand on passe en étages.
   */
  function majVisibiliteBati3D(m: maplibregl.Map) {
    if (m.getLayer(CH_BATI_3D)) m.setLayoutProperty(CH_BATI_3D, 'visibility', 'none')
    if (m.getLayer(CH_BATI_REEL)) {
      m.setLayoutProperty(CH_BATI_REEL, 'visibility', is3DRef.current ? 'visible' : 'none')
    }
  }

  /** Filtre des bâtiments réels : en mode étages, on EXCLUT le sinistré (rendu en
   *  découpe d'étages à sa place) ; sinon on affiche tous les bâtiments. */
  function majFiltreBatiReel(m: maplibregl.Map) {
    if (!m.getLayer(CH_BATI_REEL)) return
    m.setFilter(
      CH_BATI_REEL,
      etagesRef.current ? (['!=', ['get', 'incident'], true] as unknown as maplibregl.FilterSpecification) : null,
    )
  }

  /** Couleur/transparence des volumes réels (identiques au réglage utilisateur). */
  function majPeintureBatiReel(m: maplibregl.Map) {
    if (!m.getLayer(CH_BATI_REEL)) return
    m.setPaintProperty(CH_BATI_REEL, 'fill-extrusion-color', couleurRef.current)
    m.setPaintProperty(CH_BATI_REEL, 'fill-extrusion-opacity', 1 - transparenceRef.current)
  }

  /** Ouvre la 3D interactive : la caméra glisse vers la pose cible, PUIS l'overlay
   *  apparaît (au terme de l'animation). */
  function ouvrir3DInteractif() {
    const m = mapRef.current
    if (!m) {
      setInteractif3D(true)
      return
    }
    // La vue 3D interactive hérite du cap actuel (on ne fait donc PAS tourner la
    // carte) : seuls centre + zoom bougent.
    setCap3D(m.getBearing())
    m.easeTo({
      center: CENTRE,
      zoom: Math.max(m.getZoom(), ZOOM_3D_INTERACTIF),
      duration: DUREE_3D_INTERACTIF,
      essential: true,
    })
    m.once('moveend', () => setInteractif3D(true))
  }

  /** Bascule la 3D interactive (glisse-puis-ouvre, ou ferme instantanément). */
  function basculer3DInteractif() {
    if (interactif3DRef.current) setInteractif3D(false)
    else ouvrir3DInteractif()
  }

  // Création de la carte (une seule fois ; cleanup compatible React StrictMode).
  useEffect(() => {
    if (!containerRef.current) return
    const depart3D = vueInitiale3D()
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: CENTRE,
      zoom: ZOOM_INITIAL,
      pitch: depart3D ? PITCH_3D : 0,
      bearing: 0,
      maxPitch: 75,
      attributionControl: { compact: true },
      // Rotation souris native désactivée : remplacée par un handler linéaire
      // (voir plus bas) pour un sens intuitif « glisser à droite = tourner à droite ».
      dragRotate: false,
    })
    m.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }),
      'top-left',
    )
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Raccourcis façon Google Earth. Les déplacements (flèches), rotation/inclinaison
    // (Maj + flèches), zoom (molette, +/-) et rotation à la souris (clic droit ou
    // Ctrl + glisser) sont déjà natifs MapLibre ; on ajoute ci-dessous les touches
    // de vue de Google Earth, le zoom Page ↑/↓, l'arrêt du mouvement et l'aide.
    const conteneur = m.getContainer()
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return
      switch (e.key) {
        case 'n': case 'N': m.easeTo({ bearing: 0, duration: 400 }); break // vue nord
        case 'u': case 'U': m.easeTo({ pitch: 0, duration: 400 }); break // vue de dessus
        case 'r': case 'R': m.easeTo({ bearing: 0, pitch: 0, duration: 500 }); break // réinit
        case 'o': case 'O': setIs3D((v) => !v); break // bascule 2D/3D
        case 'c': case 'C': // centre + zoom rapproché, en douceur
          m.easeTo({ center: CENTRE, zoom: Math.max(m.getZoom(), ZOOM_BATIMENT), duration: 900, essential: true })
          break
        case 'e': case 'E': setEtages((v) => !v); break // vue étages
        case 'i': case 'I': basculer3DInteractif(); break // 3D interactive (glisse puis ouvre)
        case 'PageUp': m.zoomIn(); e.preventDefault(); break
        case 'PageDown': m.zoomOut(); e.preventDefault(); break
        case ' ': m.stop(); e.preventDefault(); break // stoppe l'animation en cours
        case '?': setAide((v) => !v); break
        default: return
      }
    }
    conteneur.addEventListener('keydown', surTouche)

    // Double-clic droit = dézoomer vers le curseur (le double-clic gauche natif zoome).
    let dernierClicDroit = 0
    const surClicDroit = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault()
      const t = e.originalEvent.timeStamp
      if (t - dernierClicDroit < 350) {
        m.zoomTo(m.getZoom() - 1, { around: e.lngLat, duration: 200 })
      }
      dernierClicDroit = t
    }
    m.on('contextmenu', surClicDroit)

    // Rotation / inclinaison LINÉAIRE au Ctrl + glisser (ou clic droit + glisser) :
    // remplace le handler natif « en miroir ». Horizontal → cap, vertical → inclinaison.
    const canvas = m.getCanvas()
    let pivote = false
    let x0 = 0
    let y0 = 0
    const estDeclencheur = (e: MouseEvent) => (e.button === 0 && e.ctrlKey) || e.button === 2
    const debutPivot = (e: MouseEvent) => {
      if (!estDeclencheur(e)) return
      pivote = true
      x0 = e.clientX
      y0 = e.clientY
      canvas.style.cursor = 'grabbing'
      e.preventDefault()
    }
    const pendantPivot = (e: MouseEvent) => {
      if (!pivote) return
      const dx = e.clientX - x0
      const dy = e.clientY - y0
      x0 = e.clientX
      y0 = e.clientY
      const cap = m.getBearing() + dx * SENS_ROTATION // glisser à droite → tourne à droite
      const inclinaison = Math.max(0, Math.min(m.getMaxPitch(), m.getPitch() - dy * SENS_INCLINAISON))
      m.setBearing(cap)
      m.setPitch(inclinaison)
      e.preventDefault()
    }
    const finPivot = () => {
      if (!pivote) return
      pivote = false
      canvas.style.cursor = ''
    }
    canvas.addEventListener('mousedown', debutPivot)
    window.addEventListener('mousemove', pendantPivot)
    window.addEventListener('mouseup', finPivot)

    // Focus au chargement pour que le clavier réponde sans clic préalable.
    m.once('load', () => m.getCanvas().focus())

    // Expose la carte prête (permet à un parent d'ajouter des couches : engins…).
    m.once('load', () => onCarteRef.current?.(m))

    // Bâtiments réels individuels (dérivés d'OFM). Chargés en asynchrone puis posés
    // comme couche 3D unique ; le fond OFM fusionné est masqué. Le sinistré est
    // exclu en mode étages (via le filtre) et rendu en découpe d'étages à sa place.
    m.once('load', async () => {
      try {
        const data = await fetch(URL_BATI_REEL).then((r) => r.json())
        if (!mapRef.current || m.getSource(SRC_BATI_REEL)) return
        m.addSource(SRC_BATI_REEL, { type: 'geojson', data })
        m.addLayer({
          id: CH_BATI_REEL,
          type: 'fill-extrusion',
          source: SRC_BATI_REEL,
          minzoom: 13,
          layout: { visibility: 'none' },
          paint: {
            'fill-extrusion-color': couleurRef.current,
            'fill-extrusion-height': ['get', 'hauteur'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 1 - transparenceRef.current,
          },
        })
        // Applique l'état courant (visibilité selon 3D, filtre selon étages, couleur).
        majVisibiliteBati3D(m)
        majFiltreBatiReel(m)
        majPeintureBatiReel(m)
      } catch {
        /* fichier absent → pas de bâtiments réels ; le reste de la carte fonctionne */
      }
    })

    // Cale la maquette d'étages sur le bâtiment RÉEL des tuiles (même empreinte
    // et même `render_height` que le fond 3D). Rejoué quand les tuiles chargent.
    const calerCible = () => {
      const couche = coucheEtagesRef.current
      if (!couche) return
      const feats = m.querySourceFeatures(SRC_BATI, { sourceLayer: SL_BATI })
      for (const f of feats) {
        if (!featureContient(f, POINT_INTERIEUR_WGS84)) continue
        const g = f.geometry
        // OFM fusionne parfois des centaines de bâtiments dans une seule feature
        // MultiPolygon : on retient le SOUS-polygone contenant le point intérieur
        // (le sinistré), pas `coordinates[0]` (un bâtiment quelconque des 120).
        let ring: number[][] | null = null
        if (g.type === 'Polygon') ring = g.coordinates[0] as number[][]
        else if (g.type === 'MultiPolygon') {
          const sous = g.coordinates.find((poly) =>
            pointDansAnneau(POINT_INTERIEUR_WGS84, poly[0] as number[][]),
          )
          ring = sous ? (sous[0] as number[][]) : null
        }
        if (!ring) continue
        const h = Number(f.properties?.render_height) || 27
        couche.majCible(ring as [number, number][], h)
        return
      }
    }
    rebuildVoisRef.current = calerCible

    mapRef.current = m
    if (import.meta.env.DEV) (window as unknown as { __carte?: maplibregl.Map }).__carte = m
    return () => {
      conteneur.removeEventListener('keydown', surTouche)
      canvas.removeEventListener('mousedown', debutPivot)
      window.removeEventListener('mousemove', pendantPivot)
      window.removeEventListener('mouseup', finPivot)
      m.off('contextmenu', surClicDroit)
      m.remove()
      mapRef.current = null
    }
  }, [])

  // Bascule 2D / 3D : révèle/masque UNIQUEMENT les volumes du fond. On ne touche
  // PAS à la caméra (ni pitch, ni bearing, ni centre) → aucun déplacement au clic.
  // L'inclinaison reste manuelle (clic-droit / Ctrl+glisser, ou touche U).
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    quandPret(m, () => majVisibiliteBati3D(m))
  }, [is3D])

  // Réglages live de la couleur / transparence des volumes 3D.
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    quandPret(m, () => majPeintureBatiReel(m))
  }, [couleur, transparence])

  // Changement de thème de fond : permute seulement les `paint` (2D et 3D).
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    quandPret(m, () => {
      const pf = paintFor(theme)
      for (const [couche, props] of Object.entries(pf)) {
        if (!m.getLayer(couche)) continue
        for (const [prop, valeur] of Object.entries(props)) {
          m.setPaintProperty(couche, prop, valeur as never)
        }
      }
    })
  }, [theme])

  // Découpe d'étages : masque tout le fond 3D (le sinistré est fusionné avec ses
  // voisins dans une même feature OFM — impossible d'en isoler un) et ajoute la
  // couche d'étages, calée sur le sous-polygone réel du sinistré.
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    quandPret(m, () => {
      if (etages) {
        if (!is3D) setIs3D(true) // la découpe n'a de sens qu'en 3D
        majVisibiliteBati3D(m)
        majFiltreBatiReel(m) // exclut le sinistré → il passe en découpe d'étages
        if (!coucheEtagesRef.current) {
          const couche = creerCoucheEtages(CCH_ETAGES, optEtages)
          coucheEtagesRef.current = couche
          m.addLayer(couche)
        }
        // Cale la maquette sur le sous-polygone réel du sinistré (tuiles OFM).
        rebuildVoisRef.current?.()
        m.once('idle', () => rebuildVoisRef.current?.())
      } else {
        if (coucheEtagesRef.current && m.getLayer(CCH_ETAGES)) m.removeLayer(CCH_ETAGES)
        coucheEtagesRef.current = null
        majFiltreBatiReel(m) // réaffiche le sinistré comme bâtiment normal
        majVisibiliteBati3D(m)
      }
    })
  }, [etages]) // eslint-disable-line react-hooks/exhaustive-deps

  // Réglages live des étages (éclatement, transparence, pointillés, arêtes).
  useEffect(() => {
    coucheEtagesRef.current?.maj(optEtages)
  }, [optEtages])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Vue 3D interactive (Three.js) — overlay plein écran par-dessus la carte.
          Le cap hérite de la caméra carte (`cap3D`) → même orientation. */}
      {interactif3D && (
        <div className="absolute inset-0">
          <EtagesTroisD bearing={cap3D} />
        </div>
      )}

      {/* Colonne de contrôles en haut à droite : vue, thème, réglages 3D. */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        {!interactif3D && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIs3D((v) => !v)}
              className="gap-2 shadow-md"
              title={is3D ? 'Repasser en vue 2D' : 'Passer en vue 3D'}
            >
              {is3D ? <Square className="size-4" /> : <Box className="size-4" />}
              {is3D ? 'Vue 2D' : 'Vue 3D'}
            </Button>

            <SelecteurTheme theme={theme} onChange={setTheme} />
          </>
        )}

        <div className="flex gap-2">
          {!interactif3D && (
            <Button
              type="button"
              variant={etages ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setEtages((v) => !v)}
              className="gap-2 shadow-md"
              title="Découpe par étages sur la carte (touche E)"
            >
              <Building2 className="size-4" />
              Étages
            </Button>
          )}
          <Button
            type="button"
            variant={interactif3D ? 'default' : 'secondary'}
            size="sm"
            onClick={() => (interactif3D ? setInteractif3D(false) : ouvrir3DInteractif())}
            className="gap-2 shadow-md"
            title="Bâtiment éclaté interactif (touche I)"
          >
            <Boxes className="size-4" />
            {interactif3D ? 'Fermer' : '3D interactive'}
          </Button>
        </div>

        {!interactif3D && etages && (
          <Card className="w-60 space-y-2.5 p-3 shadow-md">
            <div className="space-y-1">
              <Label htmlFor="et-eclat" className="text-xs">
                Éclatement — {optEtages.explosion.toFixed(1)} m
              </Label>
              <input
                id="et-eclat"
                type="range"
                min={0}
                max={16}
                step={0.5}
                value={optEtages.explosion}
                onChange={(e) => setOptEtages((o) => ({ ...o, explosion: Number(e.target.value) }))}
                className="w-full cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="et-sol" className="text-xs">
                Transparence des sols — {Math.round((1 - optEtages.opaciteSol) * 100)} %
              </Label>
              <input
                id="et-sol"
                type="range"
                min={0.03}
                max={0.6}
                step={0.01}
                value={optEtages.opaciteSol}
                onChange={(e) => setOptEtages((o) => ({ ...o, opaciteSol: Number(e.target.value) }))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="space-y-1 border-t pt-2">
              <Label htmlFor="et-mur-c" className="text-xs">
                Couleur des murs latéraux
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="et-mur-c"
                  type="color"
                  value={optEtages.couleurMur}
                  onChange={(e) => setOptEtages((o) => ({ ...o, couleurMur: e.target.value }))}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <span className="font-mono text-xs text-muted-foreground">{optEtages.couleurMur}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="et-mur-o" className="text-xs">
                Transparence des murs — {Math.round((1 - optEtages.opaciteMur) * 100)} %
              </Label>
              <input
                id="et-mur-o"
                type="range"
                min={0.0}
                max={0.6}
                step={0.01}
                value={optEtages.opaciteMur}
                onChange={(e) => setOptEtages((o) => ({ ...o, opaciteMur: Number(e.target.value) }))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <Label htmlFor="et-aretes" className="text-xs">
                Arêtes
              </Label>
              <input
                id="et-aretes"
                type="checkbox"
                checked={optEtages.aretes}
                onChange={(e) => setOptEtages((o) => ({ ...o, aretes: e.target.checked }))}
                className="size-4 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="et-clignote" className="text-xs">
                Clignotement danger
              </Label>
              <input
                id="et-clignote"
                type="checkbox"
                checked={optEtages.clignotementDanger}
                onChange={(e) =>
                  setOptEtages((o) => ({ ...o, clignotementDanger: e.target.checked }))
                }
                className="size-4 cursor-pointer"
              />
            </div>

            <ul className="space-y-1 border-t pt-2 text-[11px]">
              {LEGENDE.filter((l) => l.statut !== 'commerce' && l.statut !== 'blanc').map((l) => (
                <li key={l.statut} className="flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: l.couleur }} />
                  <span className="text-muted-foreground">{l.libelle}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!interactif3D && is3D && (
          <Card className="w-56 space-y-3 p-3 shadow-md">
            <div className="space-y-1.5">
              <Label htmlFor="couleur-bati" className="text-xs">
                Couleur des bâtiments
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="couleur-bati"
                  type="color"
                  value={couleur}
                  onChange={(e) => setCouleur(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <span className="font-mono text-xs text-muted-foreground">{couleur}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transparence-bati" className="text-xs">
                Transparence — {Math.round(transparence * 100)} %
              </Label>
              <input
                id="transparence-bati"
                type="range"
                min={0}
                max={0.9}
                step={0.02}
                value={transparence}
                onChange={(e) => setTransparence(Number(e.target.value))}
                style={{ accentColor: couleur }}
                className="w-full cursor-pointer"
              />
            </div>
          </Card>
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        onClick={() => setAide((v) => !v)}
        className="absolute bottom-10 right-3 size-9 shadow-md"
        title="Raccourcis clavier (touche ?)"
        aria-label="Afficher les raccourcis clavier"
      >
        <Keyboard className="size-4" />
      </Button>

      {aide && <AideRaccourcis onFermer={() => setAide(false)} />}
    </div>
  )
}
