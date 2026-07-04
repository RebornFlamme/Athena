import { supabase } from '../lib/supabase'
import type { Attribute, Entity } from '../types'

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
