// Types de l'onglet Flux (simulation d'appels) — voir plan_base_webapp.md.
// Domaine « appels / simulation », séparé du socle dashboard (typesAthena.ts).

/** Un segment de transcription révélé à `t_ms` après le début de l'appel. */
export interface TranscriptSegment {
  t_ms: number
  locuteur: 'operateur' | 'appelant'
  texte: string
}

/** Entité créée/positionnée par un pas d'extraction (projetée sur la carte). */
export interface ExtractionEntite {
  /** Clé locale au scénario (rattacher d'éventuelles mises à jour ultérieures). */
  ref: string
  type: 'acteur' | 'moyen' | 'zone'
  sous_type?: string
  libelle: string
  /** Adresse à géocoder via IGN (F1.a2) pour obtenir lon/lat. */
  adresse?: string
}

/**
 * Un fait extrait de l'appel à l'instant `t_ms`. Devient un `evenement`
 * (append-only) avec `payload.extrait_source` = la phrase qui l'a produit,
 * et — si `entite` est présent — une `entite` géolocalisée sur la carte.
 */
export interface ExtractionStep {
  t_ms: number
  event_type: string
  extrait_source: string
  fiabilite?: string
  /** Géocoder l'adresse de l'intervention et centrer/positionner dessus. */
  geocode?: boolean
  entite?: ExtractionEntite
}

/** Un scénario d'appel préenregistré (manifeste public/audio_demo/scenarios.json). */
export interface Scenario {
  id: string
  titre: string
  /** Heure de début affichée, format "HH:MM". */
  heure_debut: string
  duree_s: number
  adresse_intervention: string
  /** Chemin d'un enregistrement dans /audio_demo, ou null tant qu'aucun (F4). */
  audio?: string | null
  transcript: TranscriptSegment[]
  extractions: ExtractionStep[]
}

/**
 * Un appel ajouté par upload (F1.a1). Sans STT (F1.c) il n'a pas de transcript
 * exploitable : il est listé et lisible, mais non simulable pour l'instant.
 */
export interface AppelUploade {
  id: string
  titre: string
  heure_debut: string
  taille_octets: number
  /** Object URL local pour la lecture audio (non persisté). */
  url: string
}
