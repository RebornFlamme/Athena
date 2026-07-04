import { supabase } from '../lib/supabase'
import type { Attribute, Entity, SchemaPayload, SchemaVersion } from '../types'

// Couche d'accès Supabase. Toutes les fonctions renvoient les lignes créées /
// mises à jour pour que le store puisse refléter l'état canonique de la base.

export async function loadSchema(): Promise<{
  entities: Entity[]
  attributes: Attribute[]
}> {
  const [entitiesRes, attributesRes] = await Promise.all([
    supabase.from('entities').select('*').order('created_at', { ascending: true }),
    supabase.from('attributes').select('*').order('ordinal', { ascending: true }),
  ])
  if (entitiesRes.error) throw entitiesRes.error
  if (attributesRes.error) throw attributesRes.error
  return {
    entities: (entitiesRes.data ?? []) as Entity[],
    attributes: (attributesRes.data ?? []) as Attribute[],
  }
}

export async function insertEntity(
  entity: Partial<Entity> & { name: string },
): Promise<Entity> {
  const { data, error } = await supabase
    .from('entities')
    .insert(entity)
    .select()
    .single()
  if (error) throw error
  return data as Entity
}

export async function updateEntity(
  id: string,
  patch: Partial<Entity>,
): Promise<Entity> {
  const { data, error } = await supabase
    .from('entities')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Entity
}

export async function deleteEntity(id: string): Promise<void> {
  const { error } = await supabase.from('entities').delete().eq('id', id)
  if (error) throw error
}

export async function insertAttribute(
  attr: Partial<Attribute> & { entity_id: string; name: string },
): Promise<Attribute> {
  const { data, error } = await supabase
    .from('attributes')
    .insert(attr)
    .select()
    .single()
  if (error) throw error
  return data as Attribute
}

export async function updateAttribute(
  id: string,
  patch: Partial<Attribute>,
): Promise<Attribute> {
  const { data, error } = await supabase
    .from('attributes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Attribute
}

export async function deleteAttribute(id: string): Promise<void> {
  const { error } = await supabase.from('attributes').delete().eq('id', id)
  if (error) throw error
}

/**
 * Vide entièrement le méta-schéma : supprime tous les attributs puis toutes les
 * entités (les attributs d'abord pour la FK, même si `on delete cascade`
 * l'assurerait). Supabase exige un filtre sur un delete → on exclut un id
 * impossible pour cibler toutes les lignes.
 */
export async function deleteAllSchema(): Promise<void> {
  const ALL = '00000000-0000-0000-0000-000000000000'
  const attrs = await supabase.from('attributes').delete().neq('id', ALL)
  if (attrs.error) throw attrs.error
  const ents = await supabase.from('entities').delete().neq('id', ALL)
  if (ents.error) throw ents.error
}

// ---------------------------------------------------------------------------
// Historique de versions (table schema_versions) — snapshots JSON du canvas.
// ---------------------------------------------------------------------------

/** Liste les versions (métadonnées seules, sans le payload) — plus récentes d'abord. */
export async function listVersions(): Promise<SchemaVersion[]> {
  const { data, error } = await supabase
    .from('schema_versions')
    .select('id, label, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SchemaVersion[]
}

/** Enregistre un snapshot du schéma courant dans l'historique. */
export async function saveVersion(
  label: string | null,
  payload: SchemaPayload,
): Promise<SchemaVersion> {
  const { data, error } = await supabase
    .from('schema_versions')
    .insert({ label, payload })
    .select('id, label, created_at')
    .single()
  if (error) throw error
  return data as SchemaVersion
}

/** Récupère le payload d'une version (chargé à la demande, à la restauration). */
export async function getVersionPayload(id: string): Promise<SchemaPayload> {
  const { data, error } = await supabase
    .from('schema_versions')
    .select('payload')
    .eq('id', id)
    .single()
  if (error) throw error
  return (data?.payload ?? { entities: [], attributes: [] }) as SchemaPayload
}

export async function renameVersion(id: string, label: string): Promise<void> {
  const { error } = await supabase.from('schema_versions').update({ label }).eq('id', id)
  if (error) throw error
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from('schema_versions').delete().eq('id', id)
  if (error) throw error
}

export interface SavePayload {
  entities: Entity[]
  attributes: Attribute[]
  removedEntityIds: string[]
  removedAttributeIds: string[]
}

/**
 * Sauvegarde de tout le schéma en un seul lot (mode local-first, bouton
 * « Enregistrer ») : suppressions puis upserts. Les entités sont upsertées
 * avant les attributs pour satisfaire la FK `target_entity_id`.
 */
export async function saveSchema(p: SavePayload): Promise<void> {
  if (p.removedAttributeIds.length) {
    const { error } = await supabase.from('attributes').delete().in('id', p.removedAttributeIds)
    if (error) throw error
  }
  if (p.removedEntityIds.length) {
    const { error } = await supabase.from('entities').delete().in('id', p.removedEntityIds)
    if (error) throw error
  }
  if (p.entities.length) {
    const rows = p.entities.map((e) => ({
      id: e.id,
      name: e.name,
      is_subobject: e.is_subobject,
      position_x: e.position_x,
      position_y: e.position_y,
      color: e.color,
      width: e.width ?? null,
      height: e.height ?? null,
    }))
    const { error } = await supabase.from('entities').upsert(rows)
    if (error) throw error
  }
  if (p.attributes.length) {
    const rows = p.attributes.map((a) => ({
      id: a.id,
      entity_id: a.entity_id,
      name: a.name,
      data_type: a.data_type,
      is_list: a.is_list,
      enum_values: a.enum_values,
      target_entity_id: a.target_entity_id,
      required: a.required,
      description: a.description,
      ordinal: a.ordinal,
    }))
    const { error } = await supabase.from('attributes').upsert(rows)
    if (error) throw error
  }
}
