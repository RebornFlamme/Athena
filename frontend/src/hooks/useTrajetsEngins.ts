import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { caserneLaPlusProche } from '../data/caserneProche'
import type { ObjectInstance } from '../data/instancesApi'
import { calculerItineraire } from '../data/itineraireIgn'
import { ControleurTrajet } from '../lib/trajetEngin'
import { useInstancesScrub } from './useScrub'

// Anime un engin (camion) de la caserne réelle la plus proche jusqu'à chaque
// lieu d'intervention géolocalisé. Branché sur les instances filtrées par la
// timeline (useInstancesScrub) → l'animation se REJOUE quand une intervention
// réapparaît en avançant le curseur.

const DUREE_MS = 15000

// Cache des tracés déjà calculés (par id d'intervention) : scruber en arrière
// retire le camion, scruber en avant le remet — sans re-solliciter Overpass/IGN.
const cacheRoutes = new Map<string, [number, number][]>()

/** Une instance « lieu d'intervention » à desservir. */
function estIntervention(i: ObjectInstance): boolean {
  return /interven/i.test(i.type_name)
}

/**
 * Pour chaque intervention géolocalisée, lance (une seule fois) l'animation d'un
 * engin depuis la caserne la plus proche. Nettoie les trajets des interventions
 * disparues et tout au démontage.
 */
export function useTrajetsEngins(map: maplibregl.Map | null) {
  const instances = useInstancesScrub()
  const ctrlsRef = useRef<Map<string, ControleurTrajet>>(new Map())

  useEffect(() => {
    if (!map) return
    const ctrls = ctrlsRef.current
    const cibles = instances.filter(
      (i) => estIntervention(i) && i.lon != null && i.lat != null,
    )
    const idsVus = new Set(cibles.map((i) => i.id))

    for (const iv of cibles) {
      if (ctrls.has(iv.id)) continue // trajet déjà lancé pour cette intervention
      const ctrl = new ControleurTrajet(map, iv.id)
      ctrls.set(iv.id, ctrl)

      void (async () => {
        let coords = cacheRoutes.get(iv.id)
        if (!coords) {
          const caserne = await caserneLaPlusProche(iv.lon!, iv.lat!).catch(() => null)
          if (!caserne) return
          const itin = await calculerItineraire(
            [caserne.lon, caserne.lat],
            [iv.lon!, iv.lat!],
          ).catch(() => null)
          if (!itin) return
          coords = itin.coords
          cacheRoutes.set(iv.id, coords)
        }
        // Le contrôleur a-t-il été remplacé/détruit entre-temps ?
        if (ctrls.get(iv.id) !== ctrl) return
        ctrl.animer(coords, { dureeMs: DUREE_MS, boucle: true })
      })()
    }

    // Retire les trajets des interventions qui ont disparu.
    for (const [id, ctrl] of ctrls) {
      if (!idsVus.has(id)) {
        ctrl.detruire()
        ctrls.delete(id)
      }
    }
  }, [map, instances])

  // Nettoyage complet au démontage de la carte.
  useEffect(() => {
    const ctrls = ctrlsRef.current
    return () => {
      ctrls.forEach((c) => c.detruire())
      ctrls.clear()
    }
  }, [])
}
