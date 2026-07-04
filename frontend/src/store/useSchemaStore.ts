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

// Modèle LOCAL-FIRST : toutes les mutations restent en mémoire et marquent le
// schéma « dirty ». Rien n'est envoyé à Supabase tant que `saveAll()` n'est pas
// appelé (bouton « Enregistrer »). Pas de synchronisation temps réel.
interface SchemaState {
  entities: Entity[]
  attributes: Attribute[]
  selectedEntityId: string | null
  status: Status
  error: string | null
  dirty: boolean
  saving: boolean
  // ids présents en base à supprimer au prochain save.
  removedEntityIds: string[]
  removedAttributeIds: string[]

  load: () => Promise<void>
  saveAll: () => Promise<void>
  resetSchema: () => Promise<void>
  select: (id: string | null) => void

  addEntity: (opts?: { name?: string; is_subobject?: boolean; x?: number; y?: number }) => Entity
  renameEntity: (id: string, name: string) => void
  saveEntity: (id: string, patch: { name?: string; color?: string | null }) => void
  setEntityColor: (id: string, color: string) => void
  removeEntity: (id: string) => void
  setEntityPositionLocal: (id: string, x: number, y: number) => void

  addAttribute: (entityId: string, input: NewAttributeInput) => Attribute
  editAttribute: (id: string, patch: Partial<Attribute>) => void
  removeAttribute: (id: string) => void
}

function uuid(): string {
  return crypto.randomUUID()
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  entities: [],
  attributes: [],
  selectedEntityId: null,
  status: 'idle',
  error: null,
  dirty: false,
  saving: false,
  removedEntityIds: [],
  removedAttributeIds: [],

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const { entities, attributes } = await api.loadSchema()
      set({
        entities,
        attributes,
        status: 'ready',
        dirty: false,
        removedEntityIds: [],
        removedAttributeIds: [],
      })
    } catch (err) {
      set({ status: 'error', error: messageOf(err) })
    }
  },

  saveAll: async () => {
    const { entities, attributes, removedEntityIds, removedAttributeIds } = get()
    set({ saving: true, error: null })
    try {
      await api.saveSchema({ entities, attributes, removedEntityIds, removedAttributeIds })
      // Recharge l'état canonique depuis Supabase (created_at, ordre, ids) au
      // lieu de garder le local — la base est la source de vérité après un push.
      await get().load()
      set({ saving: false })
    } catch (err) {
      set({ saving: false, error: messageOf(err) })
    }
  },

  // Vide TOUT le schéma dans Supabase (objets + champs) puis remet à zéro le
  // local. Destructif et irréversible (bouton « Réinitialiser », confirmé par dialog).
  resetSchema: async () => {
    set({ saving: true, error: null })
    try {
      await api.deleteAllSchema()
      set({
        entities: [],
        attributes: [],
        selectedEntityId: null,
        dirty: false,
        saving: false,
        removedEntityIds: [],
        removedAttributeIds: [],
      })
    } catch (err) {
      set({ saving: false, error: messageOf(err) })
    }
  },

  select: (id) => set({ selectedEntityId: id }),

  addEntity: (opts) => {
    const entity: Entity = {
      id: uuid(),
      name: opts?.name ?? (opts?.is_subobject ? 'Nouveau sous-objet' : 'Nouvel objet'),
      is_subobject: opts?.is_subobject ?? false,
      position_x: opts?.x ?? 0,
      position_y: opts?.y ?? 0,
      color: null,
    }
    set((s) => ({ entities: [...s.entities, entity], selectedEntityId: entity.id, dirty: true }))
    return entity
  },

  renameEntity: (id, name) => patchEntityLocal(set, id, { name }),
  saveEntity: (id, patch) => patchEntityLocal(set, id, patch),
  setEntityColor: (id, color) => patchEntityLocal(set, id, { color }),
  setEntityPositionLocal: (id, x, y) => patchEntityLocal(set, id, { position_x: x, position_y: y }),

  removeEntity: (id) => {
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== id),
      attributes: s.attributes
        .filter((a) => a.entity_id !== id)
        .map((a) => (a.target_entity_id === id ? { ...a, target_entity_id: null } : a)),
      selectedEntityId: s.selectedEntityId === id ? null : s.selectedEntityId,
      removedEntityIds: s.removedEntityIds.includes(id)
        ? s.removedEntityIds
        : [...s.removedEntityIds, id],
      dirty: true,
    }))
  },

  addAttribute: (entityId, input) => {
    const siblings = get().attributes.filter((a) => a.entity_id === entityId)
    const isRelation = RELATION_TYPES.includes(input.data_type)
    // ordinal = max des voisins + 1 (et non `siblings.length`) : après une
    // suppression au milieu, la longueur peut réutiliser un ordinal existant.
    const nextOrdinal = siblings.reduce((m, a) => Math.max(m, a.ordinal), -1) + 1
    const attr: Attribute = {
      id: uuid(),
      entity_id: entityId,
      name: input.name,
      data_type: input.data_type,
      is_list: input.is_list ?? false,
      enum_values: input.data_type === 'enum' ? input.enum_values ?? [] : null,
      target_entity_id: isRelation ? input.target_entity_id ?? null : null,
      required: input.required ?? false,
      description: input.description ?? null,
      ordinal: nextOrdinal,
    }
    set((s) => ({ attributes: [...s.attributes, attr], dirty: true }))
    return attr
  },

  editAttribute: (id, patch) => {
    set((s) => ({
      attributes: s.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      dirty: true,
    }))
  },

  removeAttribute: (id) => {
    set((s) => ({
      attributes: s.attributes.filter((a) => a.id !== id),
      removedAttributeIds: s.removedAttributeIds.includes(id)
        ? s.removedAttributeIds
        : [...s.removedAttributeIds, id],
      dirty: true,
    }))
  },
}))

function patchEntityLocal(
  set: (fn: (s: SchemaState) => Partial<SchemaState>) => void,
  id: string,
  patch: Partial<Entity>,
) {
  set((s) => ({
    entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    dirty: true,
  }))
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return String(err)
}
