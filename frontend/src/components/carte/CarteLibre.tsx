import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Box, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { construireStyle, paintFor, THEMES_UI, type ThemeKey } from './mapTheme'

/**
 * Carte de navigation libre — fond vectoriel OpenFreeMap (schéma OpenMapTiles,
 * sans clé d'API), avec trois thèmes commutables et une bascule 2D / 3D.
 *   • Mode 2D : sol vu de dessus.
 *   • Mode 3D : MÊME sol + bâtiments extrudés.
 * Navigation façon Google Earth (flèches, Ctrl/clic-droit + glisser pour tourner
 * et incliner, molette/Page ↑↓ pour zoomer). Un parent peut greffer des couches
 * (marqueurs, trajets…) via `onCarte`.
 */

/** Paris 9e — 14 rue Le Peletier (fond 3D détaillé du scénario PELETIER-14). */
const CENTRE: [number, number] = [2.338184, 48.872609]
const ZOOM_INITIAL = 16
const PITCH_3D = 55

/** Bâtiments 3D du fond : beige clair, transparence 60 % par défaut. */
const COULEUR_3D_DEFAUT = '#e0d0ad'
const TRANSPARENCE_DEFAUT = 0.6 // → opacité 0.4
const THEME_DEFAUT: ThemeKey = 'douce'

/**
 * Sensibilité de la rotation/inclinaison au Ctrl (ou clic droit) + glisser.
 * Rotation LINÉAIRE : glisser à droite augmente le cap (tourne à droite),
 * glisser vers le haut incline vers l'horizon.
 */
const SENS_ROTATION = 0.35 // degrés de cap par pixel horizontal
const SENS_INCLINAISON = 0.4 // degrés d'inclinaison par pixel vertical

const STYLE = construireStyle(THEME_DEFAUT, {
  couleur: COULEUR_3D_DEFAUT,
  opacite: 1 - TRANSPARENCE_DEFAUT,
})

/** Couche des volumes 3D fusionnés du fond OFM — masquée (remplacée par nos réels). */
const CH_BATI_3D = 'batiments-3d'

/**
 * Bâtiments RÉELS individuels (dérivés des tuiles OFM, `public/batiments_peletier.json`).
 * Servent de couche 3D unique, visibles dès qu'on est en 3D.
 */
const SRC_BATI_REEL = 'bati-reel'
const CH_BATI_REEL = 'batiments-reel-3d'
const URL_BATI_REEL = '/batiments_peletier.json'

/** Sélecteur de thème de fond de carte (segmenté, laissé visible dans la carte). */
function SelecteurTheme({ theme, onChange }: { theme: ThemeKey; onChange: (t: ThemeKey) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border bg-background/95 shadow-md" role="group" aria-label="Map theme">
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

export function CarteLibre({ onCarte }: { onCarte?: (map: maplibregl.Map) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onCarteRef = useRef(onCarte)
  onCarteRef.current = onCarte
  const [is3D, setIs3D] = useState(vueInitiale3D)
  const [theme, setTheme] = useState<ThemeKey>(THEME_DEFAUT)
  const is3DRef = useRef(is3D)
  is3DRef.current = is3D

  /** Applique une opération quand le style est prêt (sinon au prochain `load`). */
  function quandPret(m: maplibregl.Map, fn: () => void) {
    if (m.isStyleLoaded()) fn()
    else m.once('load', fn)
  }

  /** Le fond OFM fusionné (`CH_BATI_3D`) est toujours masqué ; nos bâtiments réels
   *  (`CH_BATI_REEL`) apparaissent seulement en 3D. */
  function majVisibiliteBati3D(m: maplibregl.Map) {
    if (m.getLayer(CH_BATI_3D)) m.setLayoutProperty(CH_BATI_3D, 'visibility', 'none')
    if (m.getLayer(CH_BATI_REEL)) {
      m.setLayoutProperty(CH_BATI_REEL, 'visibility', is3DRef.current ? 'visible' : 'none')
    }
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
      // Rotation souris native désactivée : remplacée par un handler linéaire (sens intuitif).
      dragRotate: false,
    })
    m.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }),
      'top-left',
    )
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Raccourcis façon Google Earth (vue nord/dessus/réinit, bascule 2D/3D, zoom, arrêt).
    const conteneur = m.getContainer()
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return
      switch (e.key) {
        case 'n': case 'N': m.easeTo({ bearing: 0, duration: 400 }); break // vue nord
        case 'u': case 'U': m.easeTo({ pitch: 0, duration: 400 }); break // vue de dessus
        case 'r': case 'R': m.easeTo({ bearing: 0, pitch: 0, duration: 500 }); break // réinit
        case 'o': case 'O': setIs3D((v) => !v); break // bascule 2D/3D
        case 'PageUp': m.zoomIn(); e.preventDefault(); break
        case 'PageDown': m.zoomOut(); e.preventDefault(); break
        case ' ': m.stop(); e.preventDefault(); break // stoppe l'animation en cours
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

    // Rotation / inclinaison LINÉAIRE au Ctrl + glisser (ou clic droit + glisser).
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

    // Expose la carte prête (permet à un parent d'ajouter des couches : marqueurs…).
    m.once('load', () => onCarteRef.current?.(m))

    // Bâtiments réels individuels (dérivés d'OFM). Chargés en asynchrone puis posés
    // comme couche 3D unique ; le fond OFM fusionné est masqué.
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
            'fill-extrusion-color': COULEUR_3D_DEFAUT,
            'fill-extrusion-height': ['get', 'hauteur'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 1 - TRANSPARENCE_DEFAUT,
          },
        })
        majVisibiliteBati3D(m)
      } catch {
        /* fichier absent → pas de bâtiments réels ; le reste de la carte fonctionne */
      }
    })

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

  // Bascule 2D / 3D : révèle/masque UNIQUEMENT les volumes du fond (caméra intacte).
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    quandPret(m, () => majVisibiliteBati3D(m))
  }, [is3D])

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

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Contrôles essentiels en haut à droite : bascule 2D/3D + thème de fond. */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setIs3D((v) => !v)}
          className="gap-2 shadow-md"
          title={is3D ? 'Back to 2D' : 'Switch to 3D'}
        >
          {is3D ? <Square className="size-4" /> : <Box className="size-4" />}
          {is3D ? '2D view' : '3D view'}
        </Button>
        <SelecteurTheme theme={theme} onChange={setTheme} />
      </div>
    </div>
  )
}
