import { useState } from 'react'
import { DATA_TYPES, RELATION_TYPES, type Attribute, type DataType, type Entity } from '../types'

export interface FieldFormValues {
  name: string
  data_type: DataType
  is_list: boolean
  required: boolean
  description: string
  enum_values: string[]
  target_entity_id: string | null
  /** Si renseigné, l'appelant doit d'abord créer cette entité cible. */
  createNewTarget: { name: string; is_subobject: boolean } | null
}

interface Props {
  entities: Entity[]
  /** Entité en cours d'édition — exclue de la liste des cibles possibles. */
  currentEntityId: string
  initial?: Attribute
  submitLabel: string
  onSubmit: (values: FieldFormValues) => void
  onCancel: () => void
}

const NEW_TARGET = '__new__'

export function FieldEditor({
  entities,
  currentEntityId,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [dataType, setDataType] = useState<DataType>(initial?.data_type ?? 'string')
  const [isList, setIsList] = useState(initial?.is_list ?? false)
  const [required, setRequired] = useState(initial?.required ?? false)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [enumText, setEnumText] = useState((initial?.enum_values ?? []).join(', '))
  const [targetChoice, setTargetChoice] = useState<string>(initial?.target_entity_id ?? '')
  const [newTargetName, setNewTargetName] = useState('')

  const isRelation = RELATION_TYPES.includes(dataType)
  const targetOptions = entities.filter((e) => e.id !== currentEntityId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    let target_entity_id: string | null = null
    let createNewTarget: FieldFormValues['createNewTarget'] = null

    if (isRelation) {
      if (targetChoice === NEW_TARGET) {
        if (!newTargetName.trim()) return
        createNewTarget = {
          name: newTargetName.trim(),
          is_subobject: dataType === 'object',
        }
      } else if (targetChoice) {
        target_entity_id = targetChoice
      }
    }

    onSubmit({
      name: name.trim(),
      data_type: dataType,
      is_list: isList,
      required,
      description: description.trim(),
      enum_values:
        dataType === 'enum'
          ? enumText
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : [],
      target_entity_id,
      createNewTarget,
    })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="field-block">
        <label>Nom du champ</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. telephone"
          autoFocus
        />
      </div>

      <div className="field-block">
        <label>Type</label>
        <select value={dataType} onChange={(e) => setDataType(e.target.value as DataType)}>
          {DATA_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {dataType === 'enum' && (
        <div className="field-block">
          <label>Valeurs (séparées par des virgules)</label>
          <input
            value={enumText}
            onChange={(e) => setEnumText(e.target.value)}
            placeholder="vert, jaune, rouge, noir"
          />
        </div>
      )}

      {isRelation && (
        <div className="field-block">
          <label>{dataType === 'object' ? 'Sous-objet cible' : 'Objet référencé'}</label>
          <select value={targetChoice} onChange={(e) => setTargetChoice(e.target.value)}>
            <option value="">— choisir —</option>
            {targetOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
            <option value={NEW_TARGET}>＋ Créer un nouvel objet…</option>
          </select>
          {targetChoice === NEW_TARGET && (
            <input
              style={{ marginTop: 8 }}
              value={newTargetName}
              onChange={(e) => setNewTargetName(e.target.value)}
              placeholder="Nom du nouvel objet"
            />
          )}
        </div>
      )}

      <div className="checkbox-row">
        <input
          id="is_list"
          type="checkbox"
          checked={isList}
          onChange={(e) => setIsList(e.target.checked)}
        />
        <label htmlFor="is_list">Liste ({isRelation ? 'plusieurs cibles' : 'plusieurs valeurs'})</label>
      </div>

      <div className="checkbox-row">
        <input
          id="required"
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <label htmlFor="required">Obligatoire</label>
      </div>

      <div className="field-block">
        <label>Description (optionnel)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ex. Numéro de téléphone au format E.164"
        />
      </div>

      <div className="row">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  )
}
