// Types miroir des tables Athena (migration 0002) + constantes partagées.
// Domaine dashboard de crise — séparé des types de l'éditeur EAV (types.ts).

export type StatutInfo = 'presume' | 'confirme' | 'corrige' | 'perime'
export type TypeEntite = 'acteur' | 'moyen' | 'zone'

/**
 * Intervention « propriétaire » de la simulation. Id fixe, partagé par tous les
 * appels d'un run : le job d'extraction serveur (`extraction.py`) ancre entités
 * et événements dessus. Les panneaux globaux (carte, couche sémantique) lisent
 * tout le run via cet id. Doit rester synchronisé avec le backend.
 */
export const SIMULATION_INTERVENTION_ID = '00000000-0000-0000-0000-000000000001'

export interface Intervention {
  id: string
  titre: string
  statut: 'active' | 'terminee'
  adresse: string | null
  lon: number | null
  lat: number | null
  cree_le: string
}

export interface Evenement {
  event_id: number
  intervention_id: string
  entity_id: string | null
  entity_type: TypeEntite | 'evenement'
  event_type: string
  /** Contenu du fait + payload.extrait_source = la phrase de l'appel qui l'a produit. */
  payload: Record<string, unknown>
  ts_observation: string | null
  ts_declaration: string
  source: string
  fiabilite: string
  statut: StatutInfo
  corrige_event_id: number | null
}

export interface Entite {
  id: string
  intervention_id: string
  type: TypeEntite
  sous_type: string | null
  libelle: string
  etat: Record<string, unknown>
  lon: number | null
  lat: number | null
  fiabilite: string
  statut: StatutInfo
  maj_le: string
}

/** Libellé + couleur de chaque statut (badges de la main courante, marqueurs carte). */
export const STATUTS: Record<StatutInfo, { libelle: string; couleur: string }> = {
  presume: { libelle: 'Presumed', couleur: '#d8973c' },
  confirme: { libelle: 'Confirmed', couleur: '#22c55e' },
  corrige: { libelle: 'Corrected', couleur: '#9aa0ae' },
  perime: { libelle: 'Stale', couleur: '#6b7280' },
}
