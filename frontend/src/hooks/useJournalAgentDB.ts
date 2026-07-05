import { useEffect, useState } from 'react'
import {
  listJournal,
  listSemanticEdits,
  subscribeJournal,
  subscribeSemanticEdits,
  type JournalAgent,
} from '../data/journalAgentApi'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Journal (trace de raisonnement) d'un appel, en direct : chargement + Realtime
 * INSERT. Alimente la « stack trace » de l'agent dans le Sheet de l'appel.
 */
export function useJournalAgentDB(appelId: string | null): JournalAgent[] {
  const [rows, setRows] = useState<JournalAgent[]>([])

  useEffect(() => {
    if (!appelId || !isSupabaseConfigured) {
      setRows([])
      return
    }
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
  }, [appelId])

  return rows
}

/**
 * Edits sémantiques GLOBAUX (tous appels) en direct : chargement + Realtime INSERT.
 * Alimente le panneau « Semantic Layer Edit ». Les plus récents d'abord.
 */
export function useSemanticEditsDB(): JournalAgent[] {
  const [rows, setRows] = useState<JournalAgent[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
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
  }, [])

  return rows
}
