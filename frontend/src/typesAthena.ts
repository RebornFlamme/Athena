// Types miroir des tables Athena (migration 0002) + constantes partagées.
// Domaine dashboard de crise — séparé des types de l'éditeur EAV (types.ts).

export type StatutInfo = 'presume' | 'confirme' | 'corrige' | 'perime'
export type TypeEntite = 'acteur' | 'moyen' | 'zone'

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
  presume: { libelle: 'Présumé', couleur: '#d8973c' },
  confirme: { libelle: 'Confirmé', couleur: '#22c55e' },
  corrige: { libelle: 'Corrigé', couleur: '#9aa0ae' },
  perime: { libelle: 'Périmé', couleur: '#6b7280' },
}
