import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useInterventionStore } from '../store/useInterventionStore'
import type { Entite, Evenement, Intervention } from '../typesAthena'

/**
 * S'abonne aux changements Postgres de l'intervention donnée (journal,
 * projection, dossier) et les applique au store — c'est ce qui fait
 * apparaître un événement sur la carte < 2 s après son INSERT.
 */
export function useRealtimeIntervention(interventionId: string | undefined) {
  const applyEvenementInsert = useInterventionStore((s) => s.applyEvenementInsert)
  const applyEntiteChange = useInterventionStore((s) => s.applyEntiteChange)
  const applyInterventionChange = useInterventionStore((s) => s.applyInterventionChange)

  useEffect(() => {
    if (!isSupabaseConfigured || !interventionId) return

    const filter = `intervention_id=eq.${interventionId}`
    const channel = supabase
      .channel(`intervention-${interventionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evenements', filter },
        (payload) => {
          applyEvenementInsert(payload.new as Evenement)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entites', filter },
        (payload) => {
          const row = (payload.new ?? payload.old) as Entite
          applyEntiteChange(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', row)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interventions',
          filter: `id=eq.${interventionId}`,
        },
        (payload) => {
          applyInterventionChange(payload.new as Intervention)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [interventionId, applyEvenementInsert, applyEntiteChange, applyInterventionChange])
}
