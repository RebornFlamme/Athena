import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STATUTS } from '../../typesAthena'
import { useInstancesDB } from '../../hooks/useInstancesDB'
import type { ObjectInstance } from '../../data/instancesApi'

/** Fonds de carte officiel IGN (tuiles vectorielles Géoplateforme, gratuit). */
const STYLE_IGN =
  'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json'

/** Centre France par défaut. */
const CENTRE_FRANCE: [number, number] = [2.42, 46.6]

function creerElementMarqueur(instance: ObjectInstance): HTMLDivElement {
  const el = document.createElement('div')
  el.className =
    'h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]'
  appliquerStyleMarqueur(el, instance)
  return el
}

function appliquerStyleMarqueur(el: HTMLElement, instance: ObjectInstance) {
  const s = STATUTS[instance.statut] ?? STATUTS.presume
  el.style.background = s.couleur
  el.title = `${instance.libelle} — ${s.libelle}`
}

/**
 * Carte MapLibre + fonds IGN. Affiche les instances d'objets géolocalisées
 * (marqueurs), tous appels confondus — produites en direct par les agents LLM.
 */
export function Carte({
  centre,
}: {
  centre?: { lon: number | null; lat: number | null } | null
}) {
  const instances = useInstancesDB()
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

    for (const instance of instances) {
      if (instance.lon == null || instance.lat == null) continue
      idsVus.add(instance.id)
      const existant = marqueurs.get(instance.id)
      if (existant) {
        existant.setLngLat([instance.lon, instance.lat])
        appliquerStyleMarqueur(existant.getElement(), instance)
        existant.getPopup()?.setText(instance.libelle)
      } else {
        const marker = new maplibregl.Marker({ element: creerElementMarqueur(instance) })
          .setLngLat([instance.lon, instance.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14, closeButton: false }).setText(instance.libelle),
          )
          .addTo(map)
        marqueurs.set(instance.id, marker)
      }
    }

    // Recentre automatiquement sur le premier objet géolocalisé qui apparaît.
    if (!dejaCentreRef.current && idsVus.size > 0) {
      const premier = instances.find((i) => i.lon != null && i.lat != null)
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
  }, [map, instances])

  return <div ref={containerRef} className="absolute inset-0" />
}
