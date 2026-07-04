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
import { EntityNode } from './nodes/EntityNode'
import { RelationEdge } from './edges/RelationEdge'

// Références stables (exigées par React Flow, sinon warning / re-render).
const nodeTypes = { entity: EntityNode }
const edgeTypes = { relation: RelationEdge }

export function Canvas() {
  const entities = useSchemaStore((s) => s.entities)
  const attributes = useSchemaStore((s) => s.attributes)
  const addAttribute = useSchemaStore((s) => s.addAttribute)
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

  // Dérive les arêtes des champs-relations et répartit uniformément les racines
  // qui partagent le même côté (même node source, resp. même node cible).
  useEffect(() => {
    const rels = attributes
      .filter((a) => a.target_entity_id)
      .sort((a, b) => (a.id < b.id ? -1 : 1)) // ordre stable

    const bySource: Record<string, string[]> = {}
    const byTarget: Record<string, string[]> = {}
    for (const a of rels) {
      ;(bySource[a.entity_id] ??= []).push(a.id)
      ;(byTarget[a.target_entity_id as string] ??= []).push(a.id)
    }

    setEdges(
      rels.map((a) => {
        const sList = bySource[a.entity_id]
        const tList = byTarget[a.target_entity_id as string]
        const color = entities.find((e) => e.id === a.entity_id)?.color ?? '#a1a1aa'
        return {
          id: `attr-${a.id}`,
          type: 'relation',
          source: a.entity_id,
          target: a.target_entity_id as string,
          sourceHandle: 's',
          targetHandle: 't',
          label: a.name,
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: {
            stroke: color,
            strokeWidth: 1.5,
            strokeDasharray: a.data_type === 'object' ? '5 4' : undefined,
          },
          data: {
            sourceIndex: sList.indexOf(a.id),
            sourceCount: sList.length,
            targetIndex: tList.indexOf(a.id),
            targetCount: tList.length,
          },
        }
      }),
    )
  }, [attributes, entities, setEdges])

  // Tirer un lien d'une carte à une autre → crée une relation (référence).
  const onConnect: OnConnect = useCallback(
    (c) => {
      if (!c.source || !c.target || c.source === c.target) return
      const target = useSchemaStore.getState().entities.find((e) => e.id === c.target)
      addAttribute(c.source, {
        name: target?.name ?? 'relation',
        data_type: 'reference',
        target_entity_id: c.target,
      })
    },
    [addAttribute],
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
