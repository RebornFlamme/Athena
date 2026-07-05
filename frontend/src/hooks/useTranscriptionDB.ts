import { useEffect, useState } from 'react'
import {
  listTranscriptions,
  subscribeTranscriptions,
  type Transcription,
} from '../data/transcriptionsApi'
import { isSupabaseConfigured } from '../lib/supabase'
import { useSimulationPlayback } from '../store/useSimulationPlayback'

/**
 * Lit en direct les segments de transcription d'un appel depuis Supabase :
 * chargement initial + abonnement Realtime. Aucune STT ici — pur consommateur
 * de la base (produite par le job serveur).
 *
 * Astuce « recalcul » : un segment `ordinal === 0` marque le début d'un nouveau
 * run → on réinitialise la liste (évite de mélanger l'ancien et le nouveau run).
 */
export function useTranscriptionDB(appelId: string | null): Transcription[] {
  const [segments, setSegments] = useState<Transcription[]>([])
  const resetToken = useSimulationPlayback((s) => s.resetToken)

  useEffect(() => {
    if (!appelId || !isSupabaseConfigured) {
      setSegments([])
      return
    }

    setSegments([]) // reset immédiat (couper / relancer) avant resynchro
    let annule = false
    listTranscriptions(appelId)
      .then((s) => {
        if (!annule) setSegments(s)
      })
      .catch(() => {})

    const unsub = subscribeTranscriptions(appelId, (t) => {
      setSegments((prev) => {
        if (t.ordinal === 0) return [t] // nouveau run : on repart de zéro
        if (prev.some((p) => p.id === t.id)) return prev
        return [...prev, t].sort((a, b) => a.ordinal - b.ordinal)
      })
    })

    return () => {
      annule = true
      unsub()
    }
  }, [appelId, resetToken])

  return segments
}
