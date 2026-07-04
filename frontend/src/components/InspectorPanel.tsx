import { useState } from 'react'
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

  const renameEntity = useSchemaStore((s) => s.renameEntity)
  const setEntityColor = useSchemaStore((s) => s.setEntityColor)
  const removeEntity = useSchemaStore((s) => s.removeEntity)
  const addEntity = useSchemaStore((s) => s.addEntity)
  const addAttribute = useSchemaStore((s) => s.addAttribute)
  const editAttribute = useSchemaStore((s) => s.editAttribute)
  const removeAttribute = useSchemaStore((s) => s.removeAttribute)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

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
          value={entity.name}
          onChange={(e) => renameEntity(entity.id, e.target.value)}
        />
      </div>

      <div className="field-block">
        <label>Couleur</label>
        <div className="row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setEntityColor(entity.id, c)}
              title={c}
              style={{
                width: 26,
                height: 26,
                padding: 0,
                background: c,
                borderColor: entity.color === c ? '#fff' : 'transparent',
              }}
            />
          ))}
        </div>
      </div>

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
