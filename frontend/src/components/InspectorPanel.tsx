import { useEffect, useState } from 'react'
import { useSchemaStore } from '../store/useSchemaStore'
import { FieldEditor, type FieldFormValues } from './FieldEditor'
import type { Attribute } from '../types'

const COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899']

export function InspectorPanel() {
  const selectedId = useSchemaStore((s) => s.selectedEntityId)
  const entities = useSchemaStore((s) => s.entities)
  const entity = entities.find((e) => e.id === selectedId) ?? null
  const attributes = useSchemaStore((s) =>
    s.attributes.filter((a) => a.entity_id === selectedId).sort((a, b) => a.ordinal - b.ordinal),
  )

  const saveEntity = useSchemaStore((s) => s.saveEntity)
  const removeEntity = useSchemaStore((s) => s.removeEntity)
  const addEntity = useSchemaStore((s) => s.addEntity)
  const addAttribute = useSchemaStore((s) => s.addAttribute)
  const editAttribute = useSchemaStore((s) => s.editAttribute)
  const removeAttribute = useSchemaStore((s) => s.removeAttribute)

  // Brouillon local des propriétés de l'objet : rien n'est envoyé à Supabase
  // tant que l'utilisateur ne clique pas sur « Enregistrer ».
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Recharge le brouillon quand on sélectionne un autre objet.
  useEffect(() => {
    setName(entity?.name ?? '')
    setColor(entity?.color ?? null)
    setAdding(false)
    setEditingId(null)
    // On ne dépend que de l'id : on ne veut PAS écraser le brouillon si le store
    // change (ex. écho Realtime) pendant que l'utilisateur édite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.id])

  if (!entity) {
    return (
      <aside className="inspector">
        <p className="inspector__empty">
          Sélectionne un objet dans le graphe pour éditer son nom et ses champs,
          ou clique sur <strong>＋ Nouvel objet</strong> dans la barre du haut.
        </p>
      </aside>
    )
  }

  const dirty = name !== entity.name || (color ?? null) !== (entity.color ?? null)
  const canSave = dirty && name.trim().length > 0

  async function handleSaveEntity() {
    if (!entity || !canSave) return
    await saveEntity(entity.id, { name: name.trim(), color })
  }

  function resetDraft() {
    setName(entity?.name ?? '')
    setColor(entity?.color ?? null)
  }

  // Crée l'entité cible si nécessaire, renvoie l'id de cible à utiliser.
  async function resolveTarget(values: FieldFormValues): Promise<string | null> {
    if (values.createNewTarget) {
      const created = await addEntity({
        name: values.createNewTarget.name,
        is_subobject: values.createNewTarget.is_subobject,
        x: entity!.position_x + 320,
        y: entity!.position_y + 40,
      })
      return created?.id ?? null
    }
    return values.target_entity_id
  }

  async function handleAdd(values: FieldFormValues) {
    const target = await resolveTarget(values)
    await addAttribute(entity!.id, {
      name: values.name,
      data_type: values.data_type,
      is_list: values.is_list,
      required: values.required,
      description: values.description || null,
      enum_values: values.enum_values,
      target_entity_id: target,
    })
    setAdding(false)
  }

  async function handleEdit(attr: Attribute, values: FieldFormValues) {
    const target = await resolveTarget(values)
    await editAttribute(attr.id, {
      name: values.name,
      data_type: values.data_type,
      is_list: values.is_list,
      required: values.required,
      description: values.description || null,
      enum_values: values.data_type === 'enum' ? values.enum_values : null,
      target_entity_id: target,
    })
    setEditingId(null)
  }

  return (
    <aside className="inspector">
      <div className="field-block">
        <label>Nom de l'objet</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSaveEntity()
          }}
        />
      </div>

      <div className="field-block">
        <label>Couleur</label>
        <div className="row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: 26,
                height: 26,
                padding: 0,
                background: c,
                borderColor: color === c ? '#fff' : 'transparent',
              }}
            />
          ))}
        </div>
      </div>

      <div className="row">
        <button className="primary" disabled={!canSave} onClick={handleSaveEntity}>
          {dirty ? 'Enregistrer la modification' : 'Enregistré'}
        </button>
        {dirty && (
          <button type="button" onClick={resetDraft}>
            Annuler
          </button>
        )}
      </div>
      {dirty && <p className="hint">Modifications non enregistrées.</p>}

      <div className="divider" />

      <div className="row between">
        <span className="section-title">Champs ({attributes.length})</span>
        {!adding && (
          <button className="primary" onClick={() => setAdding(true)}>
            ＋ champ
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: 12 }}>
          <FieldEditor
            entities={entities}
            currentEntityId={entity.id}
            submitLabel="Ajouter le champ"
            onSubmit={handleAdd}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <div className="attr-list">
        {attributes.map((attr) =>
          editingId === attr.id ? (
            <FieldEditor
              key={attr.id}
              entities={entities}
              currentEntityId={entity.id}
              initial={attr}
              submitLabel="Enregistrer"
              onSubmit={(v) => handleEdit(attr, v)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={attr.id} className="attr-item">
              <span className="attr-item__name">
                {attr.name}
                <span className="attr-item__meta">
                  {' · '}
                  {attr.data_type}
                  {attr.is_list ? '[]' : ''}
                </span>
              </span>
              <button className="danger" title="Éditer" onClick={() => setEditingId(attr.id)}>
                ✎
              </button>
              <button className="danger" title="Supprimer" onClick={() => removeAttribute(attr.id)}>
                ✕
              </button>
            </div>
          ),
        )}
        {attributes.length === 0 && !adding && (
          <p className="hint">Aucun champ pour l'instant.</p>
        )}
      </div>

      <div className="divider" />

      <button
        className="danger"
        style={{ width: '100%' }}
        onClick={() => {
          if (confirm(`Supprimer l'objet « ${entity.name} » et tous ses champs ?`)) {
            removeEntity(entity.id)
          }
        }}
      >
        Supprimer l'objet
      </button>
    </aside>
  )
}
