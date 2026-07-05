import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { calculerItineraire } from '../data/itineraireIgn'
import { bboxTrace, ControleurTrajet } from '../lib/trajetEngin'

// DÉMO (étape 2) : anime un camion d'une « caserne » vers un « lieu
// d'intervention » sur des coordonnées lyonnaises fixes, en boucle, pour
// valider le rendu (routing + tracé + animation) avant tout branchement aux
// vraies instances « engin » (étape 3). À retirer une fois le branchement fait.

const DEMO_CASERNE: [number, number] = [4.832, 45.77]
const DEMO_INTERVENTION: [number, number] = [4.85, 45.758]
const DUREE_MS = 15000

/**
 * Joue le trajet de démonstration dès que la carte est prête. No-op si `map`
 * est nul. Nettoie le marqueur/tracé au démontage.
 */
export function useTrajetDemo(map: maplibregl.Map | null) {
  useEffect(() => {
    if (!map) return

    let annule = false
    const ctrl = new ControleurTrajet(map, 'demo')

    const lancer = async () => {
      const itin = await calculerItineraire(DEMO_CASERNE, DEMO_INTERVENTION).catch(() => null)
      if (annule || !itin) return
      // Le contrôleur gère lui-même l'attente du style pour le tracé ; le
      // marqueur + l'animation démarrent tout de suite.
      map.fitBounds(bboxTrace(itin.coords), { padding: 80, duration: 1500 })
      ctrl.animer(itin.coords, { dureeMs: DUREE_MS, boucle: true })
    }

    void lancer()

    return () => {
      annule = true
      ctrl.detruire()
    }
  }, [map])
}
