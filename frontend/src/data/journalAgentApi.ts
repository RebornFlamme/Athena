import { supabase } from '../lib/supabase'

// Journal de l'agent LLM (table `agent_journal`, append-only). Deux usages :
//  - la TRACE de raisonnement d'un appel (« stack trace » du Sheet) : toutes les
//    lignes de l'appel, dans l'ordre (raisonnement + actions) ;
//  - la COUCHE SÉMANTIQUE (globale) : uniquement les edits (create/modif/suppr)
//    avec leur diff champ par champ.
// Lecture seule + Realtime.

export interface DiffChampDB {
  champ: string
  avant: string | null
  apres: string | null
}

export interface JournalAgent {
  id: number
  appel_id: string | null
  instance_id: string | null
  kind: 'raisonnement' | 'creation' | 'modification' | 'suppression' | 'outil'
  objet: string | null
  texte: string | null
  diff: DiffChampDB[] | null
  cree_le: string
}

const KINDS_EDIT = ['creation', 'modification', 'suppression']

// Compteur → nom de canal unique par abonnement (évite « cannot add
// postgres_changes callbacks after subscribe » au remount / StrictMode).
let compteurCanal = 0

/** Journal complet d'un appel (trace de raisonnement), dans l'ordre. */
export async function listJournal(appelId: string): Promise<JournalAgent[]> {
  const { data, error } = await supabase
    .from('agent_journal')
    .select('*')
    .eq('appel_id', appelId)
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as JournalAgent[]
}

/** S'abonne au journal d'un appel (Realtime INSERT). */
export function subscribeJournal(
  appelId: string,
  onInsert: (j: JournalAgent) => void,
): () => void {
  const channel = supabase
    .channel(`agent_journal:${appelId}:${++compteurCanal}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'agent_journal', filter: `appel_id=eq.${appelId}` },
      (payload) => onInsert(payload.new as JournalAgent),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** Supprime TOUT le journal de l'agent (bouton « Reset database »). `id` est un
 *  bigint identity (≥ 1) → `gte 0` = tout supprimer (filtre requis par Supabase). */
export async function deleteAllJournal(): Promise<void> {
  const { error } = await supabase.from('agent_journal').delete().gte('id', 0)
  if (error) throw error
}

/** Edits sémantiques, tous appels confondus (les plus récents d'abord). */
export async function listSemanticEdits(limite = 200): Promise<JournalAgent[]> {
  const { data, error } = await supabase
    .from('agent_journal')
    .select('*')
    .in('kind', KINDS_EDIT)
    .order('id', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as JournalAgent[]
}

/** S'abonne à TOUS les edits sémantiques (Realtime INSERT, filtré client-side sur kind). */
export function subscribeSemanticEdits(onInsert: (j: JournalAgent) => void): () => void {
  const channel = supabase
    .channel(`agent_journal:semantic:${++compteurCanal}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'agent_journal' },
      (payload) => {
        const row = payload.new as JournalAgent
        if (KINDS_EDIT.includes(row.kind)) onInsert(row)
      },
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
