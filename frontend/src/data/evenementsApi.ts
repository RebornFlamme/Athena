import { supabase } from '../lib/supabase'

// Couche d'accès Supabase du journal d'événements (produit par l'extraction LLM
// serveur). C'est la « chaîne de raisonnement » : chaque écriture d'entité laisse
// un événement (ENTITE_CREEE / ENTITE_MAJ / RELATION) avec sa phrase source.
// Lecture seule + Realtime, filtré par appel (migration 0005).

export interface EvenementLive {
  event_id: number
  appel_id: string | null
  entity_type: string
  event_type: string
  payload: Record<string, unknown>
  ts_declaration: string
}

const COLS = 'event_id, appel_id, entity_type, event_type, payload, ts_declaration'

/** Événements déjà journalisés pour un appel, dans l'ordre. */
export async function listEvenements(appelId: string): Promise<EvenementLive[]> {
  const { data, error } = await supabase
    .from('evenements')
    .select(COLS)
    .eq('appel_id', appelId)
    .order('event_id', { ascending: true })
  if (error) throw error
  return (data ?? []) as EvenementLive[]
}

type ChangementEvenement =
  | { type: 'upsert'; ev: EvenementLive }
  | { type: 'delete'; event_id: number }

/** S'abonne aux événements d'un appel (Realtime : INSERT/UPDATE/DELETE). */
export function subscribeEvenements(
  appelId: string,
  onChange: (c: ChangementEvenement) => void,
): () => void {
  const channel = supabase
    .channel(`evenements:${appelId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'evenements', filter: `appel_id=eq.${appelId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ type: 'delete', event_id: (payload.old as { event_id: number }).event_id })
        } else {
          onChange({ type: 'upsert', ev: payload.new as EvenementLive })
        }
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
