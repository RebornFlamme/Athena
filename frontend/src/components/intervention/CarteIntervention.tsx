import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STATUTS, type Entite } from '../../typesAthena'

/** Fonds de carte officiel IGN (tuiles vectorielles Géoplateforme, gratuit). */
const STYLE_IGN =
  'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json'

/** Centre France par défaut tant que l'intervention n'est pas localisée. */
const CENTRE_FRANCE: [number, number] = [2.42, 46.6]

/** Élément DOM d'un marqueur (défini hors composant — référence stable). */
function creerElementMarqueur(entite: Entite): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'marqueur-entite'
  appliquerStyleMarqueur(el, entite)
  return el
}

function appliquerStyleMarqueur(el: HTMLElement, entite: Entite) {
  const s = STATUTS[entite.statut] ?? STATUTS.presume
  el.style.background = s.couleur
  el.title = `${entite.libelle} — ${s.libelle}`
}

export function CarteIntervention({
  entites,
  centre,
}: {
  entites: Entite[]
  centre?: { lon: number | null; lat: number | null } | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const marqueursRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const dejaCentreRef = useRef(false)

  // Création de la carte (une seule fois ; cleanup compatible StrictMode).
  useEffect(() => {
    if (!containerRef.current) return
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_IGN,
      center: CENTRE_FRANCE,
      zoom: 5.4,
      attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    setMap(m)
    return () => {
      marqueursRef.current.forEach((mk) => mk.remove())
      marqueursRef.current.clear()
      dejaCentreRef.current = false
      m.remove()
      setMap(null)
    }
  }, [])

  // Centrage initial sur l'intervention dès qu'elle est localisée.
  useEffect(() => {
    if (!map || dejaCentreRef.current) return
    if (centre?.lon != null && centre?.lat != null) {
      map.jumpTo({ center: [centre.lon, centre.lat], zoom: 14 })
      dejaCentreRef.current = true
    }
  }, [map, centre])

  // Synchronisation des marqueurs avec la projection `entites` (idempotent).
  useEffect(() => {
    if (!map) return
    const marqueurs = marqueursRef.current
    const idsVus = new Set<string>()

    for (const entite of entites) {
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
          .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(entite.libelle))
          .addTo(map)
        marqueurs.set(entite.id, marker)
      }
    }

    // Retire les marqueurs des entités disparues.
    for (const [id, marker] of marqueurs) {
      if (!idsVus.has(id)) {
        marker.remove()
        marqueurs.delete(id)
      }
    }
  }, [map, entites])

  return <div ref={containerRef} className="carte-conteneur" />
}
