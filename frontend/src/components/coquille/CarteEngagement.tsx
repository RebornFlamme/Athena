import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { CarteLibre } from '../carte/CarteLibre'
import { STATUTS, type StatutInfo } from '../../typesAthena'
import { useInstancesDB } from '../../hooks/useInstancesDB'
import { useTrajetsEngins } from '../../hooks/useTrajetsEngins'

/**
 * Carte tactique branchée au RÉEL. Reprend la belle carte 3D `CarteLibre` (fond
 * IGN/OFM, navigation façon Google Earth, bâtiments 3D) et y greffe EN DIRECT ce
 * qui se passe pendant la simulation :
 *   • les objets géolocalisés produits par les agents (`useInstancesDB`) →
 *     marqueurs colorés par statut, ajout/maj/retrait réactif (Realtime) ;
 *   • un trajet d'engin depuis la caserne réelle la plus proche vers chaque lieu
 *     d'intervention géolocalisé (`useTrajetsEngins`).
 * La caméra plonge (vue inclinée) sur le premier objet géolocalisé qui apparaît.
 *
 * Utilisée dans le panneau « Map » du tableau de bord ET en pleine page (/coquille).
 * Le parent doit être positionné (`relative`) et dimensionné.
 */

/** Forme minimale d'un objet géolocalisable (satisfaite par `ObjectInstance`). */
interface Geoloc {
  id: string
  libelle: string
  lon: number | null
  lat: number | null
  statut: StatutInfo
}

function appliquerStyleMarqueur(el: HTMLElement, o: Geoloc) {
  const s = STATUTS[o.statut] ?? STATUTS.presume
  el.style.background = s.couleur
  el.title = `${o.libelle} — ${s.libelle}`
}

function creerElementMarqueur(o: Geoloc): HTMLDivElement {
  const el = document.createElement('div')
  el.className =
    'h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]'
  appliquerStyleMarqueur(el, o)
  return el
}

export function CarteEngagement() {
  const objets: Geoloc[] = useInstancesDB()
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const marqueursRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const dejaCentreRef = useRef(false)

  // Trajets d'engins réels (caserne la plus proche → interventions géolocalisées).
  useTrajetsEngins(map)

  // Nouvelle carte (remount) → repart des marqueurs à zéro (l'ancienne carte a été
  // détruite avec ses marqueurs). Déclaré AVANT l'effet marqueurs → s'exécute d'abord.
  useEffect(() => {
    marqueursRef.current = new Map()
    dejaCentreRef.current = false
  }, [map])

  // Marqueurs des objets géolocalisés (ajout / maj / retrait réactif) + plongée
  // caméra sur le premier objet localisé qui apparaît.
  useEffect(() => {
    if (!map) return
    const marqueurs = marqueursRef.current
    const idsVus = new Set<string>()

    for (const o of objets) {
      if (o.lon == null || o.lat == null) continue
      idsVus.add(o.id)
      const existant = marqueurs.get(o.id)
      if (existant) {
        existant.setLngLat([o.lon, o.lat])
        appliquerStyleMarqueur(existant.getElement(), o)
        existant.getPopup()?.setText(o.libelle)
      } else {
        const marker = new maplibregl.Marker({ element: creerElementMarqueur(o) })
          .setLngLat([o.lon, o.lat])
          .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(o.libelle))
          .addTo(map)
        marqueurs.set(o.id, marker)
      }
    }

    // Plonge sur le premier objet géolocalisé (vue inclinée → les volumes 3D ressortent).
    if (!dejaCentreRef.current && idsVus.size > 0) {
      const premier = objets.find((o) => o.lon != null && o.lat != null)
      if (premier?.lon != null && premier?.lat != null) {
        map.flyTo({ center: [premier.lon, premier.lat], zoom: 17, pitch: 55, duration: 1600 })
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

  return <CarteLibre onCarte={setMap} />
}
