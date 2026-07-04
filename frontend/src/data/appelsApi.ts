import { supabase } from '../lib/supabase'
import type { Appel } from '../typesSimulation'

// Couche d'accès Supabase des appels (créateur de simulation).

export async function listAppels(): Promise<Appel[]> {
  const { data, error } = await supabase
    .from('appels')
    .select('*')
    .order('ts_debut_ms', { ascending: true })
  if (error) throw error
  return (data ?? []) as Appel[]
}

export async function insertAppel(input: {
  titre: string
  audio_url: string
  audio_path?: string | null
  ts_debut_ms?: number
  duree_ms?: number
  piste?: number
  operateur?: string | null
  localisation?: string | null
  caserne?: string | null
}): Promise<Appel> {
  const { data, error } = await supabase.from('appels').insert(input).select().single()
  if (error) throw error
  return data as Appel
}

/** Met à jour le placement d'un appel (instant de déclenchement, piste, titre). */
export async function updateAppel(
  id: string,
  patch: Partial<Pick<Appel, 'titre' | 'ts_debut_ms' | 'piste'>>,
): Promise<void> {
  const { error } = await supabase.from('appels').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAppel(id: string): Promise<void> {
  const { error } = await supabase.from('appels').delete().eq('id', id)
  if (error) throw error
}
