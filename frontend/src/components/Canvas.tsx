import { useCallback, useEffect } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type OnConnect,
  type OnNodeDrag,
} from '@xyflow/react'
import { useSchemaStore } from '../store/useSchemaStore'
import { RELATION_TYPES } from '../types'
import { EntityNode } from './nodes/EntityNode'
import { RelationEdge } from './edges/RelationEdge'

// Références stables (exigées par React Flow, sinon warning / re-render).
const nodeTypes = { entity: EntityNode }
const edgeTypes = { relation: RelationEdge }

export function Canvas() {
  const entities = useSchemaStore((s) => s.entities)
  const attributes = useSchemaStore((s) => s.attributes)
  const editAttribute = useSchemaStore((s) => s.editAttribute)
  const setEntityPositionLocal = useSchemaStore((s) => s.setEntityPositionLocal)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Reconstruit les nodes quand l'ensemble/position des entités change.
  useEffect(() => {
    setNodes(
      entities.map((e) => ({
        id: e.id,
        type: 'entity',
        position: { x: e.position_x, y: e.position_y },
        data: {},
      })),
    )
  }, [entities, setNodes])

  // Dérive une arête par champ-relation relié. L'ancrage source est le handle
  // du champ (`f-<attrId>`) → React Flow calcule seul la bonne origine.
  useEffect(() => {
    const rels = attributes.filter(
      (a) => a.target_entity_id && RELATION_TYPES.includes(a.data_type),
    )
    setEdges(
      rels.map((a) => {
        const color = entities.find((e) => e.id === a.entity_id)?.color ?? '#a1a1aa'
        return {
          id: `attr-${a.id}`,
          type: 'relation',
          source: a.entity_id,
          target: a.target_entity_id as string,
          sourceHandle: `f-${a.id}`,
          targetHandle: 't',
          label: a.name,
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: {
            stroke: color,
            strokeWidth: 1.5,
            strokeDasharray: a.data_type === 'object' ? '5 4' : undefined,
          },
        }
      }),
    )
  }, [attributes, entities, setEdges])

  // Tirer le handle d'un champ-relation vers une carte → pose la cible SUR ce
  // champ (on modifie l'attribut, on n'en crée pas). Auto-référence permise.
  const onConnect: OnConnect = useCallback(
    (c) => {
      if (!c.source || !c.target || !c.sourceHandle?.startsWith('f-')) return
      const attrId = c.sourceHandle.slice(2)
      editAttribute(attrId, { target_entity_id: c.target })
    },
    [editAttribute],
  )

  const onNodeDragStop: OnNodeDrag<Node> = (_, node) => {
    setEntityPositionLocal(node.id, node.position.x, node.position.y)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStop={onNodeDragStop}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={18} />
      <Controls />
    </ReactFlow>
  )
}
