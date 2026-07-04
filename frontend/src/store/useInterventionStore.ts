import { create } from 'zustand'
import * as api from '../data/interventionApi'
import type { Entite, Evenement, Intervention } from '../typesAthena'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface InterventionState {
  intervention: Intervention | null
  evenements: Evenement[]
  entites: Entite[]
  status: Status
  error: string | null

  load: (id: string) => Promise<void>
  clear: () => void

  // Réconciliation Realtime (idempotente, par id).
  applyEvenementInsert: (row: Evenement) => void
  applyEntiteChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: Entite) => void
  applyInterventionChange: (row: Intervention) => void
}

function upsertByKey<T>(list: T[], row: T, key: (x: T) => string | number): T[] {
  const idx = list.findIndex((x) => key(x) === key(row))
  if (idx === -1) return [...list, row]
  const next = list.slice()
  next[idx] = row
  return next
}

export const useInterventionStore = create<InterventionState>((set) => ({
  intervention: null,
  evenements: [],
  entites: [],
  status: 'idle',
  error: null,

  load: async (id) => {
    set({ status: 'loading', error: null })
    try {
      const { intervention, evenements, entites } = await api.loadIntervention(id)
      set({ intervention, evenements, entites, status: 'ready' })
    } catch (err) {
      set({ status: 'error', error: messageOf(err) })
    }
  },

  clear: () =>
    set({ intervention: null, evenements: [], entites: [], status: 'idle', error: null }),

  applyEvenementInsert: (row) => {
    set((s) => ({
      evenements: upsertByKey(s.evenements, row, (e) => e.event_id),
    }))
  },

  applyEntiteChange: (eventType, row) => {
    set((s) => {
      if (eventType === 'DELETE') {
        return { entites: s.entites.filter((e) => e.id !== row.id) }
      }
      return { entites: upsertByKey(s.entites, row, (e) => e.id) }
    })
  },

  applyInterventionChange: (row) => {
    set((s) =>
      s.intervention && s.intervention.id === row.id ? { intervention: row } : {},
    )
  },
}))

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return String(err)
}
