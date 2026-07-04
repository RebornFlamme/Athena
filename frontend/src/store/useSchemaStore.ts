import { create } from 'zustand'
import * as api from '../data/schemaApi'
import type { Attribute, DataType, Entity } from '../types'
import { RELATION_TYPES } from '../types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface NewAttributeInput {
  name: string
  data_type: DataType
  is_list?: boolean
  enum_values?: string[] | null
  target_entity_id?: string | null
  required?: boolean
  description?: string | null
}

interface SchemaState {
  entities: Entity[]
  attributes: Attribute[]
  selectedEntityId: string | null
  status: Status
  error: string | null

  load: () => Promise<void>
  select: (id: string | null) => void

  addEntity: (opts?: { name?: string; is_subobject?: boolean; x?: number; y?: number }) => Promise<Entity | null>
  renameEntity: (id: string, name: string) => Promise<void>
  setEntityColor: (id: string, color: string) => Promise<void>
  removeEntity: (id: string) => Promise<void>

  // Position : mise à jour locale pendant le drag, persistée au drag stop.
  setEntityPositionLocal: (id: string, x: number, y: number) => void
  persistEntityPosition: (id: string) => Promise<void>

  addAttribute: (entityId: string, input: NewAttributeInput) => Promise<Attribute | null>
  editAttribute: (id: string, patch: Partial<Attribute>) => Promise<void>
  removeAttribute: (id: string) => Promise<void>

  // Réconciliation Realtime (idempotente, par id).
  applyEntityChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: Entity) => void
  applyAttributeChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: Attribute) => void
}

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const idx = list.findIndex((x) => x.id === row.id)
  if (idx === -1) return [...list, row]
  const next = list.slice()
  next[idx] = row
  return next
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  entities: [],
  attributes: [],
  selectedEntityId: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const { entities, attributes } = await api.loadSchema()
      set({ entities, attributes, status: 'ready' })
    } catch (err) {
      set({ status: 'error', error: messageOf(err) })
    }
  },

  select: (id) => set({ selectedEntityId: id }),

  addEntity: async (opts) => {
    try {
      const entity = await api.insertEntity({
        name: opts?.name ?? (opts?.is_subobject ? 'Nouveau sous-objet' : 'Nouvel objet'),
        is_subobject: opts?.is_subobject ?? false,
        position_x: opts?.x ?? 0,
        position_y: opts?.y ?? 0,
      })
      set((s) => ({ entities: upsertById(s.entities, entity), selectedEntityId: entity.id }))
      return entity
    } catch (err) {
      set({ error: messageOf(err) })
      return null
    }
  },

  renameEntity: async (id, name) => {
    patchEntityLocal(set, id, { name })
    try {
      await api.updateEntity(id, { name })
    } catch (err) {
      set({ error: messageOf(err) })
    }
  },

  setEntityColor: async (id, color) => {
    patchEntityLocal(set, id, { color })
    try {
      await api.updateEntity(id, { color })
    } catch (err) {
      set({ error: messageOf(err) })
    }
  },

  removeEntity: async (id) => {
    // Retire l'entité, ses champs, et les champs d'autres entités qui la ciblaient.
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== id),
      attributes: s.attributes
        .filter((a) => a.entity_id !== id)
        .map((a) => (a.target_entity_id === id ? { ...a, target_entity_id: null } : a)),
      selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
    }))
    try {
      await api.deleteEntity(id)
    } catch (err) {
      set({ error: messageOf(err) })
    }
  },

  setEntityPositionLocal: (id, x, y) => {
    patchEntityLocal(set, id, { position_x: x, position_y: y })
  },

  persistEntityPosition: async (id) => {
    const entity = get().entities.find((e) => e.id === id)
    if (!entity) return
    try {
      await api.updateEntity(id, {
        position_x: entity.position_x,
        position_y: entity.position_y,
      })
    } catch (err) {
      set({ error: messageOf(err) })
    }
  },

  addAttribute: async (entityId, input) => {
    const siblings = get().attributes.filter((a) => a.entity_id === entityId)
    const ordinal = siblings.length
    const isRelation = RELATION_TYPES.includes(input.data_type)
    try {
      const attr = await api.insertAttribute({
        entity_id: entityId,
        name: input.name,
        data_type: input.data_type,
        is_list: input.is_list ?? false,
        enum_values: input.data_type === 'enum' ? input.enum_values ?? [] : null,
        target_entity_id: isRelation ? input.target_entity_id ?? null : null,
        required: input.required ?? false,
        description: input.description ?? null,
        ordinal,
      })
      set((s) => ({ attributes: upsertById(s.attributes, attr) }))
      return attr
    } catch (err) {
      set({ error: messageOf(err) })
      return null
    }
  },

  editAttribute: async (id, patch) => {
    set((s) => ({
      attributes: s.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }))
    try {
      await api.updateAttribute(id, patch)
    } catch (err) {
      set({ error: messageOf(err) })
    }
  },

  removeAttribute: async (id) => {
    set((s) => ({ attributes: s.attributes.filter((a) => a.id !== id) }))
    try {
      await api.deleteAttribute(id)
    } catch (err) {
      set({ error: messageOf(err) })
    }
  },

  applyEntityChange: (eventType, row) => {
    set((s) => {
      if (eventType === 'DELETE') {
        return { entities: s.entities.filter((e) => e.id !== row.id) }
      }
      return { entities: upsertById(s.entities, row) }
    })
  },

  applyAttributeChange: (eventType, row) => {
    set((s) => {
      if (eventType === 'DELETE') {
        return { attributes: s.attributes.filter((a) => a.id !== row.id) }
      }
      return { attributes: upsertById(s.attributes, row) }
    })
  },
}))

function patchEntityLocal(
  set: (fn: (s: SchemaState) => Partial<SchemaState>) => void,
  id: string,
  patch: Partial<Entity>,
) {
  set((s) => ({
    entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }))
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return String(err)
}
