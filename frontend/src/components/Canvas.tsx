import { useEffect } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import { useSchemaStore } from '../store/useSchemaStore'
import { EntityNode } from './nodes/EntityNode'

// nodeTypes défini hors composant (référence stable exigée par React Flow).
const nodeTypes = { entity: EntityNode }

export function Canvas() {
  const entities = useSchemaStore((s) => s.entities)
  const attributes = useSchemaStore((s) => s.attributes)
  const select = useSchemaStore((s) => s.select)
  const setEntityPositionLocal = useSchemaStore((s) => s.setEntityPositionLocal)
  const persistEntityPosition = useSchemaStore((s) => s.persistEntityPosition)

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

  // Dérive les arêtes des champs de type relation (reference / object).
  useEffect(() => {
    const relEdges: Edge[] = attributes
      .filter((a) => a.target_entity_id)
      .map((a) => ({
        id: `attr-${a.id}`,
        source: a.entity_id,
        target: a.target_entity_id as string,
        sourceHandle: 'out',
        targetHandle: 'in',
        label: a.name,
        animated: a.data_type === 'object',
        style:
          a.data_type === 'object'
            ? { strokeDasharray: '5 4', stroke: '#8b8ff0' }
            : { stroke: '#6366f1' },
      }))
    setEdges(relEdges)
  }, [attributes, setEdges])

  const handleNodeClick: NodeMouseHandler = (_, node) => select(node.id)

  const handleDragStop: OnNodeDrag<Node> = (_, node) => {
    setEntityPositionLocal(node.id, node.position.x, node.position.y)
    void persistEntityPosition(node.id)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDragStop={handleDragStop}
      onPaneClick={() => select(null)}
      nodesConnectable={false}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={18} color="#232838" />
      <Controls />
      <MiniMap
        pannable
        zoomable
        nodeColor={() => '#2a2f3d'}
        maskColor="#0f111799"
        style={{ background: '#171a23' }}
      />
    </ReactFlow>
  )
}
