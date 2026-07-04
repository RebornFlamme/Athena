import { supabase } from '../lib/supabase'

// Couche d'accès Supabase des transcriptions (produites par le job serveur).
// Le dashboard est un pur lecteur : select initial + abonnement Realtime.

export interface Transcription {
  id: string
  appel_id: string
  ordinal: number
  texte: string
  langue: string | null
  debut_ms: number | null
  cree_le: string
}

/** Segments déjà stockés pour un appel, ordonnés. */
export async function listTranscriptions(appelId: string): Promise<Transcription[]> {
  const { data, error } = await supabase
    .from('transcriptions')
    .select('*')
    .eq('appel_id', appelId)
    .order('ordinal', { ascending: true })
  if (error) throw error
  return (data ?? []) as Transcription[]
}

/**
 * S'abonne aux nouveaux segments d'un appel (Realtime). Retourne une fonction de
 * désabonnement.
 */
export function subscribeTranscriptions(
  appelId: string,
  onInsert: (t: Transcription) => void,
): () => void {
  const channel = supabase
    .channel(`transcriptions:${appelId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transcriptions', filter: `appel_id=eq.${appelId}` },
      (payload) => onInsert(payload.new as Transcription),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
