import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useSchemaStore } from '../store/useSchemaStore'
import type { Attribute, Entity } from '../types'

/**
 * S'abonne aux changements Postgres des tables `entities` et `attributes`
 * et applique chaque événement au store — garde les onglets synchronisés.
 */
export function useRealtimeSchema() {
  const applyEntityChange = useSchemaStore((s) => s.applyEntityChange)
  const applyAttributeChange = useSchemaStore((s) => s.applyAttributeChange)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('schema-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entities' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Entity
          applyEntityChange(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', row)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attributes' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Attribute
          applyAttributeChange(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', row)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [applyEntityChange, applyAttributeChange])
}
