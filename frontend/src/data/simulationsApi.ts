import { supabase } from '../lib/supabase'
import type { Simulation } from '../typesSimulation'

// Couche d'accès Supabase des simulations (créateur de simulation, migration 0010).
// Une simulation regroupe des appels (via `appels.simulation_id`).

export async function listSimulations(): Promise<Simulation[]> {
  const { data, error } = await supabase
    .from('simulations')
    .select('*')
    .order('cree_le', { ascending: true })
  if (error) throw error
  return (data ?? []) as Simulation[]
}

export async function insertSimulation(nom: string): Promise<Simulation> {
  const { data, error } = await supabase.from('simulations').insert({ nom }).select().single()
  if (error) throw error
  return data as Simulation
}

export async function renameSimulation(id: string, nom: string): Promise<void> {
  const { error } = await supabase.from('simulations').update({ nom }).eq('id', id)
  if (error) throw error
}

/** Supprime une simulation (ses appels cascadent via la FK `on delete cascade`). */
export async function deleteSimulation(id: string): Promise<void> {
  const { error } = await supabase.from('simulations').delete().eq('id', id)
  if (error) throw error
}
