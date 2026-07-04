import { useEffect, useState } from 'react'
import { listEntites, subscribeEntites, type EntiteCarte } from '../data/entitesApi'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Lit en direct les entités extraites d'un appel depuis Supabase : chargement
 * initial + abonnement Realtime (INSERT/UPDATE/DELETE). Pur consommateur — les
 * entités sont produites par le job d'extraction LLM serveur.
 *
 * Destiné à alimenter les marqueurs de la carte (entités avec lon/lat) et la
 * main courante. La reprise d'un run (le job efface puis réinsère par appel)
 * est absorbée par les DELETE Realtime.
 */
export function useEntitesDB(appelId: string | null): EntiteCarte[] {
  const [entites, setEntites] = useState<EntiteCarte[]>([])

  useEffect(() => {
    if (!appelId || !isSupabaseConfigured) {
      setEntites([])
      return
    }

    let annule = false
    listEntites(appelId)
      .then((e) => {
        if (!annule) setEntites(e)
      })
      .catch(() => {})

    const unsub = subscribeEntites(appelId, (c) => {
      setEntites((prev) => {
        if (c.type === 'delete') return prev.filter((e) => e.id !== c.id)
        const autres = prev.filter((e) => e.id !== c.entite.id)
        return [...autres, c.entite]
      })
    })

    return () => {
      annule = true
      unsub()
    }
  }, [appelId])

  return entites
}
