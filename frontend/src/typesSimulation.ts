// Types du créateur de simulation (Phase F2).
// Un MP3 = un « appel » (une communication). L'agencement des appels sur la
// timeline = la simulation active. La pipeline de traitement (STT/extraction)
// consommera ces appels plus tard.

export interface Appel {
  id: string
  titre: string
  /** URL publique du MP3 (Supabase Storage). */
  audio_url: string
  /** Chemin interne dans le bucket (pour la suppression). */
  audio_path: string | null
  /** Instant de déclenchement depuis t0 de la simulation, en millisecondes. */
  ts_debut_ms: number
  /** Durée du clip en millisecondes (lue côté client à l'upload). */
  duree_ms: number
  /** Ligne/piste dans la timeline (permet l'overlap de plusieurs appels). */
  piste: number
  cree_le: string
}
