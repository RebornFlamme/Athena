import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useSchemaStore } from '../../store/useSchemaStore'
import type { Attribute } from '../../types'

// La sélection est pilotée par le store (pas par la sélection interne de
// React Flow) : chaque node lit lui-même son état sélectionné.

/** Libellé court affiché dans le badge de type d'un champ. */
function typeLabel(attr: Attribute, entityName: (id: string) => string): string {
  const list = attr.is_list ? '[]' : ''
  switch (attr.data_type) {
    case 'reference':
      return `→ ${attr.target_entity_id ? entityName(attr.target_entity_id) : '?'}${list}`
    case 'object':
      return `⊂ ${attr.target_entity_id ? entityName(attr.target_entity_id) : '?'}${list}`
    case 'enum':
      return `enum${list}`
    default:
      return `${attr.data_type}${list}`
  }
}

export function EntityNode({ id }: NodeProps) {
  const entity = useSchemaStore((s) => s.entities.find((e) => e.id === id))
  const attributes = useSchemaStore((s) =>
    s.attributes.filter((a) => a.entity_id === id).sort((a, b) => a.ordinal - b.ordinal),
  )
  const entities = useSchemaStore((s) => s.entities)
  const select = useSchemaStore((s) => s.select)
  const selected = useSchemaStore((s) => s.selectedEntityId === id)

  if (!entity) return null

  const nameOf = (eid: string) => entities.find((e) => e.id === eid)?.name ?? '?'
  const accent = entity.color ?? '#6366f1'

  return (
    <div
      className={`entity-node${selected ? ' selected' : ''}`}
      onClick={() => select(entity.id)}
    >
      <Handle type="target" position={Position.Left} id="in" />

      <div className="entity-node__head" style={{ borderTopColor: accent }}>
        <span className="entity-node__name">{entity.name}</span>
        <span className="entity-node__badge">
          {entity.is_subobject ? 'sous-objet' : 'objet'}
        </span>
      </div>

      <div className="entity-node__fields">
        {attributes.length === 0 && (
          <div className="entity-node__empty">Aucun champ</div>
        )}
        {attributes.map((attr) => (
          <div key={attr.id} className="entity-node__field">
            <span className="entity-node__field-name">
              {attr.name}
              {attr.required && <span className="req">*</span>}
            </span>
            <span className="type-badge">{typeLabel(attr, nameOf)}</span>
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Right} id="out" />
    </div>
  )
}
