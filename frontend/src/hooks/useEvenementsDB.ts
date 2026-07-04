import { useEffect, useState } from 'react'
import { listEvenements, subscribeEvenements, type EvenementLive } from '../data/evenementsApi'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Lit en direct le journal d'événements d'un appel (chaîne de raisonnement du
 * LLM) : chargement initial + Realtime. La reprise d'un run (le job efface puis
 * réinsère par appel) est absorbée par les DELETE Realtime.
 */
export function useEvenementsDB(appelId: string | null): EvenementLive[] {
  const [evenements, setEvenements] = useState<EvenementLive[]>([])

  useEffect(() => {
    if (!appelId || !isSupabaseConfigured) {
      setEvenements([])
      return
    }

    let annule = false
    listEvenements(appelId)
      .then((e) => {
        if (!annule) setEvenements(e)
      })
      .catch(() => {})

    const unsub = subscribeEvenements(appelId, (c) => {
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
  }, [appelId])

  return evenements
}
