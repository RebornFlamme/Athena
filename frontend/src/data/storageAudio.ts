import { supabase } from '../lib/supabase'

// Stockage des MP3 d'appels dans Supabase Storage (bucket public `appels-audio`).
// Upload direct depuis le navigateur (clé anon) — aucun serveur requis.

const BUCKET = 'appels-audio'

/**
 * Téléverse un fichier audio et renvoie son URL publique + son chemin interne.
 *
 * Args:
 *   file: Le fichier MP3 (ou autre audio) sélectionné/glissé par l'utilisateur.
 *
 * Returns:
 *   `{ url, path }` — `url` publique pour la lecture, `path` pour la suppression.
 */
export async function televerserAudio(file: File): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Supprime un fichier audio du bucket (best-effort). */
export async function supprimerAudio(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
