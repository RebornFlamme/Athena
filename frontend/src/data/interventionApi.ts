import { supabase } from '../lib/supabase'
import type { Entite, Evenement, Intervention } from '../typesAthena'

// Couche d'accès Supabase du dashboard de crise.
// Règle projet : le journal `evenements` est append-only — cette couche
// n'expose QUE l'insertion (jamais d'update/delete ; la base les refuse aussi).

export async function listInterventions(): Promise<Intervention[]> {
  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .order('cree_le', { ascending: false })
  if (error) throw error
  return (data ?? []) as Intervention[]
}

export async function insertIntervention(input: {
  titre: string
  adresse?: string | null
  lon?: number | null
  lat?: number | null
}): Promise<Intervention> {
  const { data, error } = await supabase
    .from('interventions')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Intervention
}

export async function loadIntervention(id: string): Promise<{
  intervention: Intervention
  evenements: Evenement[]
  entites: Entite[]
}> {
  const [interventionRes, evenementsRes, entitesRes] = await Promise.all([
    supabase.from('interventions').select('*').eq('id', id).single(),
    supabase
      .from('evenements')
      .select('*')
      .eq('intervention_id', id)
      .order('event_id', { ascending: true }),
    supabase.from('entites').select('*').eq('intervention_id', id),
  ])
  if (interventionRes.error) throw interventionRes.error
  if (evenementsRes.error) throw evenementsRes.error
  if (entitesRes.error) throw entitesRes.error
  return {
    intervention: interventionRes.data as Intervention,
    evenements: (evenementsRes.data ?? []) as Evenement[],
    entites: (entitesRes.data ?? []) as Entite[],
  }
}

/** INSERT uniquement — le journal ne se modifie jamais (corrections par ajout). */
export async function insererEvenement(evt: {
  intervention_id: string
  entity_id?: string | null
  entity_type: Evenement['entity_type']
  event_type: string
  payload?: Record<string, unknown>
  ts_observation?: string | null
  source?: string
  fiabilite?: string
  statut?: Evenement['statut']
  corrige_event_id?: number | null
}): Promise<Evenement> {
  const { data, error } = await supabase
    .from('evenements')
    .insert(evt)
    .select()
    .single()
  if (error) throw error
  return data as Evenement
}
