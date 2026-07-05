import { useEffect, useState } from 'react'
import {
  listJournal,
  listSemanticEdits,
  subscribeJournal,
  subscribeSemanticEdits,
  type JournalAgent,
} from '../data/journalAgentApi'
import { isSupabaseConfigured } from '../lib/supabase'
import { useSimulationPlayback } from '../store/useSimulationPlayback'

/**
 * Journal (trace de raisonnement) d'un appel, en direct : chargement + Realtime
 * INSERT. Alimente la « stack trace » de l'agent dans le Sheet de l'appel.
 */
export function useJournalAgentDB(appelId: string | null): JournalAgent[] {
  const [rows, setRows] = useState<JournalAgent[]>([])
  const resetToken = useSimulationPlayback((s) => s.resetToken)

  useEffect(() => {
    if (!appelId || !isSupabaseConfigured) {
      setRows([])
      return
    }
    setRows([]) // reset immédiat (couper / relancer) avant resynchro
    let annule = false
    listJournal(appelId)
      .then((r) => {
        if (!annule) setRows(r)
      })
      .catch(() => {})

    const unsub = subscribeJournal(appelId, (j) => {
      setRows((prev) => (prev.some((p) => p.id === j.id) ? prev : [...prev, j]))
    })

    return () => {
      annule = true
      unsub()
    }
  }, [appelId, resetToken])

  return rows
}

/**
 * Edits sémantiques GLOBAUX (tous appels) en direct : chargement + Realtime INSERT.
 * Alimente le panneau « Semantic Layer Edit ». Les plus récents d'abord.
 */
export function useSemanticEditsDB(): JournalAgent[] {
  const [rows, setRows] = useState<JournalAgent[]>([])
  const resetToken = useSimulationPlayback((s) => s.resetToken)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    setRows([]) // reset immédiat (couper / relancer) avant resynchro
    let annule = false
    listSemanticEdits()
      .then((r) => {
        if (!annule) setRows(r)
      })
      .catch(() => {})

    const unsub = subscribeSemanticEdits((j) => {
      setRows((prev) => (prev.some((p) => p.id === j.id) ? prev : [j, ...prev]))
    })

    return () => {
      annule = true
      unsub()
    }
  }, [resetToken])

  return rows
}
