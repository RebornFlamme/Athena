import { useEffect, useState } from 'react'
import {
  listEvenementsIntervention,
  subscribeEvenementsIntervention,
  type EvenementLive,
} from '../data/evenementsApi'
import { isSupabaseConfigured } from '../lib/supabase'
import { SIMULATION_INTERVENTION_ID } from '../typesAthena'

/**
 * Lit en direct TOUT le journal d'événements du run de simulation courant
 * (agrégé sur l'intervention fixe) : la « chaîne de raisonnement » du LLM pour
 * l'ensemble des appels. Chargement initial + Realtime. La reprise d'un run est
 * absorbée par les DELETE Realtime.
 */
export function useEvenementsRun(): EvenementLive[] {
  const [evenements, setEvenements] = useState<EvenementLive[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEvenements([])
      return
    }

    let annule = false
    listEvenementsIntervention(SIMULATION_INTERVENTION_ID)
      .then((e) => {
        if (!annule) setEvenements(e)
      })
      .catch(() => {})

    const unsub = subscribeEvenementsIntervention(SIMULATION_INTERVENTION_ID, (c) => {
      setEvenements((prev) => {
        if (c.type === 'delete') return prev.filter((e) => e.event_id !== c.event_id)
        const autres = prev.filter((e) => e.event_id !== c.ev.event_id)
        return [...autres, c.ev].sort((a, b) => a.event_id - b.event_id)
      })
    })

    return () => {
      annule = true
      unsub()
    }
  }, [])

  return evenements
}
