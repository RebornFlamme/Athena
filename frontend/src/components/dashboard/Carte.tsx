import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STATUTS, type StatutInfo } from '../../typesAthena'
import { useInstancesDB } from '../../hooks/useInstancesDB'

/** Fonds de carte officiel IGN (tuiles vectorielles Géoplateforme, gratuit). */
const STYLE_IGN =
  'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json'

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
 * Carte MapLibre + fonds IGN. Affiche les objets géolocalisés (marqueurs). Par
 * défaut alimentée par TOUTES les instances d'objets des agents LLM
 * (`useInstancesDB`, vue globale) ; accepte aussi une liste `entites` en prop
 * (compat. câblage « run » historique).
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

  useEffect(() => {
    if (!map || dejaCentreRef.current) return
    if (centre?.lon != null && centre?.lat != null) {
      map.jumpTo({ center: [centre.lon, centre.lat], zoom: 14 })
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

    // Recentre automatiquement sur le premier objet géolocalisé qui apparaît.
    if (!dejaCentreRef.current && idsVus.size > 0) {
      const premier = objets.find((i) => i.lon != null && i.lat != null)
      if (premier?.lon != null && premier?.lat != null) {
        map.jumpTo({ center: [premier.lon, premier.lat], zoom: 13 })
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
