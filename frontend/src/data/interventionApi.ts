import { supabase } from '../lib/supabase'
import type { Entite, Evenement, Intervention, StatutInfo, TypeEntite } from '../typesAthena'

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

/** Recentre l'intervention (adresse géocodée) — la carte se cale dessus. */
export async function majCentreIntervention(
  id: string,
  lon: number,
  lat: number,
  adresse?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { lon, lat }
  if (adresse) patch.adresse = adresse
  const { error } = await supabase.from('interventions').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Insère/positionne une entité de la projection (id fourni côté client pour
 * pouvoir la lier à un événement dans le même flux).
 */
export async function upsertEntite(entite: {
  id: string
  intervention_id: string
  type: TypeEntite
  sous_type?: string | null
  libelle: string
  etat?: Record<string, unknown>
  lon?: number | null
  lat?: number | null
  fiabilite?: string
  statut?: StatutInfo
}): Promise<Entite> {
  const { data, error } = await supabase.from('entites').upsert(entite).select().single()
  if (error) throw error
  return data as Entite
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
