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

/** Types dont la valeur cible une autre entité (⇒ génèrent une arête). */
export const RELATION_TYPES: DataType[] = ['reference', 'object']

export interface Entity {
  id: string
  name: string
  is_subobject: boolean
  position_x: number
  position_y: number
  color: string | null
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
