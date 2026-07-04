import { useEffect, useState } from 'react'
import {
  listEntitesIntervention,
  subscribeEntitesIntervention,
  type EntiteCarte,
} from '../data/entitesApi'
import { isSupabaseConfigured } from '../lib/supabase'
import { SIMULATION_INTERVENTION_ID } from '../typesAthena'

/**
 * Lit en direct TOUTES les entités du run de simulation courant (agrégées sur
 * l'intervention fixe), pour les panneaux globaux du dashboard : marqueurs de la
 * carte, couche sémantique. Chargement initial + Realtime (INSERT/UPDATE/DELETE).
 *
 * Pur lecteur : les entités sont produites par le job d'extraction LLM serveur.
 * La reprise d'un run (le job efface puis réinsère par appel) est absorbée par
 * les DELETE Realtime.
 */
export function useEntitesRun(): EntiteCarte[] {
  const [entites, setEntites] = useState<EntiteCarte[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEntites([])
      return
    }

    let annule = false
    listEntitesIntervention(SIMULATION_INTERVENTION_ID)
      .then((e) => {
        if (!annule) setEntites(e)
      })
      .catch(() => {})

    const unsub = subscribeEntitesIntervention(SIMULATION_INTERVENTION_ID, (c) => {
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
  }, [])

  return entites
}
