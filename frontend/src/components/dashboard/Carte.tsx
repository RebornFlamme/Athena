import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STATUTS, type StatutInfo } from '../../typesAthena'
import { useInstancesDB } from '../../hooks/useInstancesDB'

/** Fonds de carte officiel IGN (tuiles vectorielles Géoplateforme, gratuit). */
const STYLE_IGN =
  'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json'

/** Tuiles vectorielles BD TOPO® (IGN, sans clé) — porte la hauteur des bâtiments. */
const SOURCE_BDTOPO = 'https://data.geopf.fr/tms/1.0.0/BDTOPO/metadata.json'

/** Centre France par défaut. */
const CENTRE_FRANCE: [number, number] = [2.42, 46.6]

/**
 * Forme minimale d'un objet géolocalisable. Satisfaite aussi bien par les
 * `ObjectInstance` (agents LLM, source par défaut) que par les `Entite`
 * héritées (câblage « run » dormant) → la carte accepte les deux.
 */
export interface MarqueurEntite {
  id: string
  libelle: string
  lon: number | null
  lat: number | null
  statut: StatutInfo
}

/**
 * Ajoute les bâtiments en 3D (extrusion selon la hauteur réelle BD TOPO). Placés
 * sous les libellés pour garder les textes lisibles ; n'apparaissent qu'en zoom
 * rapproché (z ≥ 14) et « poussent » entre z14 et z15.5. Idempotent.
 */
function ajouterBatiments3D(m: maplibregl.Map) {
  if (!m.getSource('bdtopo')) {
    m.addSource('bdtopo', { type: 'vector', url: SOURCE_BDTOPO, attribution: 'IGN – BD TOPO®' })
  }
  if (m.getLayer('batiments-3d')) return

  // Hauteur en mètres ; 0 si absente (le bâtiment reste alors à plat).
  const hauteur: maplibregl.ExpressionSpecification = ['to-number', ['get', 'hauteur'], 0]
  const premierSymbole = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id

  m.addLayer(
    {
      id: 'batiments-3d',
      type: 'fill-extrusion',
      source: 'bdtopo',
      'source-layer': 'batiment',
      minzoom: 14,
      paint: {
        // Dégradé selon la hauteur → lecture du volume sur le fond clair IGN.
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          hauteur,
          0, '#dcd8d0',
          10, '#c7c2b8',
          30, '#a8a298',
          80, '#877f74',
        ],
        // Pousse les volumes entre z14 et z15.5 (transition douce à l'approche).
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, hauteur],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
      },
    },
    premierSymbole,
  )
}

function creerElementMarqueur(entite: MarqueurEntite): HTMLDivElement {
  const el = document.createElement('div')
  el.className =
    'h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]'
  appliquerStyleMarqueur(el, entite)
  return el
}

function appliquerStyleMarqueur(el: HTMLElement, entite: MarqueurEntite) {
  const s = STATUTS[entite.statut] ?? STATUTS.presume
  el.style.background = s.couleur
  el.title = `${entite.libelle} — ${s.libelle}`
}

/**
 * Carte MapLibre + fonds IGN, avec bâtiments en 3D (extrusion BD TOPO). Affiche
 * les objets géolocalisés (marqueurs). Par défaut alimentée par TOUTES les
 * instances d'objets des agents LLM (`useInstancesDB`, vue globale) ; accepte
 * aussi une liste `entites` en prop (compat. câblage « run » historique). Plonge
 * en vue inclinée sur le premier objet géolocalisé → les immeubles en volume.
 */
export function Carte({
  entites,
  centre,
}: {
  entites?: MarqueurEntite[]
  centre?: { lon: number | null; lat: number | null } | null
}) {
  const auto = useInstancesDB()
  const objets: MarqueurEntite[] = entites ?? auto
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const marqueursRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const dejaCentreRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_IGN,
      center: CENTRE_FRANCE,
      zoom: 5.4,
      // Autorise l'inclinaison (vue 3D) ; bornée pour ne pas passer sous l'horizon.
      maxPitch: 70,
      attributionControl: { compact: true },
    })
    // Compas + jauge de pitch : affordance 3D (glisser-droit/ctrl pour incliner).
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-left',
    )
    // Bâtiments 3D une fois le style chargé (la source `plan_ign` + la nôtre existent).
    m.on('load', () => ajouterBatiments3D(m))
    setMap(m)
    return () => {
      marqueursRef.current.forEach((mk) => mk.remove())
      marqueursRef.current.clear()
      dejaCentreRef.current = false
      m.remove()
      setMap(null)
    }
  }, [])

  useEffect(() => {
    if (!map || dejaCentreRef.current) return
    if (centre?.lon != null && centre?.lat != null) {
      // Arrivée en vol inclinée sur le sinistre → les bâtiments 3D deviennent visibles.
      map.flyTo({ center: [centre.lon, centre.lat], zoom: 16, pitch: 55, duration: 1600 })
      dejaCentreRef.current = true
    }
  }, [map, centre])

  useEffect(() => {
    if (!map) return
    const marqueurs = marqueursRef.current
    const idsVus = new Set<string>()

    for (const entite of objets) {
      if (entite.lon == null || entite.lat == null) continue
      idsVus.add(entite.id)
      const existant = marqueurs.get(entite.id)
      if (existant) {
        existant.setLngLat([entite.lon, entite.lat])
        appliquerStyleMarqueur(existant.getElement(), entite)
        existant.getPopup()?.setText(entite.libelle)
      } else {
        const marker = new maplibregl.Marker({ element: creerElementMarqueur(entite) })
          .setLngLat([entite.lon, entite.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14, closeButton: false }).setText(entite.libelle),
          )
          .addTo(map)
        marqueurs.set(entite.id, marker)
      }
    }

    // Recentre automatiquement sur le premier objet géolocalisé qui apparaît,
    // en vol incliné → les bâtiments 3D deviennent visibles.
    if (!dejaCentreRef.current && idsVus.size > 0) {
      const premier = objets.find((i) => i.lon != null && i.lat != null)
      if (premier?.lon != null && premier?.lat != null) {
        map.flyTo({ center: [premier.lon, premier.lat], zoom: 16, pitch: 55, duration: 1600 })
        dejaCentreRef.current = true
      }
    }

    for (const [id, marker] of marqueurs) {
      if (!idsVus.has(id)) {
        marker.remove()
        marqueurs.delete(id)
      }
    }
  }, [map, objets])

  return <div ref={containerRef} className="absolute inset-0" />
}
