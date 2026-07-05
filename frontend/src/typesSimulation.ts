// Types du créateur de simulation (Phase F2).
// Un MP3 = un « appel » (une communication). L'agencement des appels sur la
// timeline = la simulation active. La pipeline de traitement (STT/extraction)
// consommera ces appels plus tard.

/** Une simulation nommée = un ensemble d'appels sur une timeline. On peut en
 *  créer plusieurs ; le bouton Play joue la simulation ACTIVE (choisie côté UI). */
export interface Simulation {
  id: string
  nom: string
  cree_le: string
}

export interface Appel {
  id: string
  /** Simulation à laquelle appartient l'appel (null = appels hérités pré-0010). */
  simulation_id: string | null
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
  /** Nom de l'opérateur au téléphone (saisi à l'upload). */
  operateur: string | null
  /** Localisation de l'appel (adresse / lieu de l'intervention). */
  localisation: string | null
  /** Caserne qui reçoit / traite l'appel. */
  caserne: string | null
  cree_le: string
}
