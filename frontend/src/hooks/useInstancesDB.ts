import { useEffect, useState } from 'react'
import { listInstances, subscribeInstances, type ObjectInstance } from '../data/instancesApi'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Lit en direct TOUTES les instances d'objets depuis Supabase : chargement initial
 * + Realtime (INSERT/UPDATE/DELETE). Pur consommateur — les instances sont
 * produites par les jobs agent LLM serveur (un par appel).
 *
 * Vue globale : alimente les marqueurs de la carte (instances avec lon/lat) et le
 * panneau Objets. Le reset d'un run (le backend purge par appel au lancement) est
 * absorbé par les DELETE Realtime.
 */
export function useInstancesDB(): ObjectInstance[] {
  const [instances, setInstances] = useState<ObjectInstance[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let annule = false
    listInstances()
      .then((i) => {
        if (!annule) setInstances(i)
      })
      .catch(() => {})

    const unsub = subscribeInstances((c) => {
      setInstances((prev) => {
        if (c.type === 'delete') return prev.filter((i) => i.id !== c.id)
        const autres = prev.filter((i) => i.id !== c.instance.id)
        return [c.instance, ...autres]
      })
    })

    return () => {
      annule = true
      unsub()
    }
  }, [])

  return instances
}
