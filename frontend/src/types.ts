// Types du méta-schéma EAV (miroir des tables Supabase).

export type DataType =
  | 'string'
  | 'text'
  | 'boolean'
  | 'integer'
  | 'number'
  | 'datetime'
  | 'enum'
  | 'reference' // pointe vers une autre entité (edge plein)
  | 'object' // sous-objet (edge pointillé)

export const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: 'string', label: 'Chaîne (courte)' },
  { value: 'text', label: 'Texte (long)' },
  { value: 'boolean', label: 'Booléen' },
  { value: 'integer', label: 'Entier' },
  { value: 'number', label: 'Nombre' },
  { value: 'datetime', label: 'Date / heure' },
  { value: 'enum', label: 'Énumération' },
  { value: 'reference', label: 'Référence → objet' },
  { value: 'object', label: 'Sous-objet' },
]

/**
 * Types dont la valeur cible une autre entité (⇒ génèrent une arête).
 * Un champ de ce type expose un handle sur sa ligne : on le tire vers une autre
 * carte pour poser `target_entity_id` sur CE champ (pas de menu de cible).
 */
export const RELATION_TYPES: DataType[] = ['reference', 'object']

export interface Entity {
  id: string
  name: string
  is_subobject: boolean
  position_x: number
  position_y: number
  color: string | null
  width?: number | null // largeur de la carte en px (redimensionnable) ; null = défaut
  created_at?: string
  updated_at?: string
}

export interface Attribute {
  id: string
  entity_id: string
  name: string
  data_type: DataType
  is_list: boolean
  enum_values: string[] | null
  target_entity_id: string | null
  required: boolean
  description: string | null
  ordinal: number
  created_at?: string
  updated_at?: string
}

/** Contenu d'un snapshot de schéma (tout le canvas sérialisé). */
export interface SchemaPayload {
  entities: Entity[]
  attributes: Attribute[]
}

/** Métadonnées d'une version du schéma (table `schema_versions`, sans le payload). */
export interface SchemaVersion {
  id: string
  label: string | null
  created_at: string
}
