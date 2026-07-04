import { supabase } from '../lib/supabase'
import type { Entite } from '../typesAthena'

// Couche d'accès Supabase des entités extraites (produites par le job LLM
// serveur : transcript → boucle d'outils Claude → entites/evenements). Le
// dashboard est un pur lecteur : select initial + abonnement Realtime.
//
// Les entités sont rattachées à l'appel source (`appel_id`, migration 0005) et
// à l'intervention « Simulation ». Contrairement aux transcriptions, elles sont
// mises à jour (position, état) au fil de l'extraction → on écoute INSERT,
// UPDATE et DELETE.

export type EntiteCarte = Entite & { appel_id: string | null }

/** Entités déjà extraites pour un appel. */
export async function listEntites(appelId: string): Promise<EntiteCarte[]> {
  const { data, error } = await supabase
    .from('entites')
    .select('*')
    .eq('appel_id', appelId)
  if (error) throw error
  return (data ?? []) as EntiteCarte[]
}

/** Toutes les entités d'un run de simulation (agrégées sur l'intervention). */
export async function listEntitesIntervention(interventionId: string): Promise<EntiteCarte[]> {
  const { data, error } = await supabase
    .from('entites')
    .select('*')
    .eq('intervention_id', interventionId)
  if (error) throw error
  return (data ?? []) as EntiteCarte[]
}

// Compteur pour rendre chaque canal Realtime unique (plusieurs panneaux peuvent
// s'abonner au même run → éviter la collision de topic Supabase).
let seqCanal = 0

type ChangementEntite =
  | { type: 'upsert'; entite: EntiteCarte }
  | { type: 'delete'; id: string }

/**
 * S'abonne aux changements d'entités d'un appel (Realtime : INSERT/UPDATE/DELETE).
 * Retourne une fonction de désabonnement.
 */
export function subscribeEntites(
  appelId: string,
  onChange: (c: ChangementEntite) => void,
): () => void {
  const channel = supabase
    .channel(`entites:${appelId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entites', filter: `appel_id=eq.${appelId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ type: 'delete', id: (payload.old as { id: string }).id })
        } else {
          onChange({ type: 'upsert', entite: payload.new as EntiteCarte })
        }
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** S'abonne aux entités de tout un run (filtre sur l'intervention). */
export function subscribeEntitesIntervention(
  interventionId: string,
  onChange: (c: ChangementEntite) => void,
): () => void {
  const channel = supabase
    .channel(`entites-run:${interventionId}:${++seqCanal}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'entites',
        filter: `intervention_id=eq.${interventionId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ type: 'delete', id: (payload.old as { id: string }).id })
        } else {
          onChange({ type: 'upsert', entite: payload.new as EntiteCarte })
        }
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
