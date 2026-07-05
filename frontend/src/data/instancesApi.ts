import { supabase } from '../lib/supabase'

// Instances d'objets produites par l'agent LLM serveur (un agent par appel) : il
// interroge le schéma dessiné (`entities`/`attributes`), déduplique entre appels
// et écrit ces lignes. Le dashboard est pur lecteur : select initial + Realtime
// (INSERT/UPDATE/DELETE). Vue GLOBALE (tous appels confondus) — la carte et le
// panneau Objets agrègent la crise entière, pas un seul appel.

export interface ObjectInstance {
  id: string
  schema_entity_id: string | null
  type_name: string
  libelle: string
  fields: Record<string, unknown>
  lon: number | null
  lat: number | null
  appel_id: string | null
  statut: 'presume' | 'confirme' | 'corrige' | 'perime'
  cree_le: string
  maj_le: string
}

/** Toutes les instances d'objets (les plus récentes d'abord). */
export async function listInstances(): Promise<ObjectInstance[]> {
  const { data, error } = await supabase
    .from('object_instances')
    .select('*')
    .order('maj_le', { ascending: false })
  if (error) throw error
  return (data ?? []) as ObjectInstance[]
}

/** Supprime TOUTES les instances d'objets (bouton « Reset database »). Supabase
 *  exige un filtre sur un delete → `neq` sur un uuid impossible = tout supprimer. */
export async function deleteAllInstances(): Promise<void> {
  const { error } = await supabase
    .from('object_instances')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}

type ChangementInstance =
  | { type: 'upsert'; instance: ObjectInstance }
  | { type: 'delete'; id: string }

// Compteur → nom de canal unique par abonnement. Sinon `supabase.channel(nom)`
// renvoie un canal déjà souscrit (StrictMode / remount) et rappeler `.on()`
// après `subscribe()` lève « cannot add postgres_changes callbacks after subscribe ».
let compteurCanal = 0

/** S'abonne à toutes les instances (Realtime : INSERT/UPDATE/DELETE). */
export function subscribeInstances(onChange: (c: ChangementInstance) => void): () => void {
  const channel = supabase
    .channel(`object_instances:all:${++compteurCanal}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'object_instances' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ type: 'delete', id: (payload.old as { id: string }).id })
        } else {
          onChange({ type: 'upsert', instance: payload.new as ObjectInstance })
        }
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
