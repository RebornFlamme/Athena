import { useEffect, useState } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import { loadSchema } from '../../data/schemaApi'
import { useInstancesScrub } from '../../hooks/useScrub'
import { calculerPositions, deriverAretes } from '../../lib/grapheMemoire'
import type { Attribute, Entity } from '../../types'
import { InstanceNode } from './nodes/InstanceNode'

// Référence stable (exigée par React Flow).
const nodeTypes = { instance: InstanceNode }

/**
 * Graphe LIVE de la mémoire : les instances d'objets créées/modifiées par les
 * agents LLM, en nœuds React Flow (comme l'éditeur de schéma, mais en direct).
 * Les arêtes sont dérivées du schéma dessiné. Branché sur la timeline
 * (`useInstancesScrub`) → scruber en arrière rejoue l'apparition des objets.
 */
export function GrapheMemoire() {
  const instances = useInstancesScrub()
  const [attributs, setAttributs] = useState<Attribute[]>([])
  const [entities, setEntities] = useState<Entity[]>([])

  // Schéma chargé une fois (source des liens entre types).
  useEffect(() => {
    let annule = false
    loadSchema()
      .then((s) => {
        if (annule) return
        setAttributs(s.attributes)
        setEntities(s.entities)
      })
      .catch(() => {})
    return () => {
      annule = true
    }
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])

  // Réconcilie les nœuds : conserve les positions déjà en place (drag utilisateur
  // + auto), place les nouveaux, retire les disparus. Le `data` est réinjecté à
  // chaque changement → InstanceNode voit la modif et surligne les champs.
  useEffect(() => {
    const positions = calculerPositions(instances)
    setNodes((prev) => {
      const posConnues = new Map(prev.map((n) => [n.id, n.position]))
      return instances.map((inst) => ({
        id: inst.id,
        type: 'instance',
        position: posConnues.get(inst.id) ?? positions.get(inst.id) ?? { x: 0, y: 0 },
        data: { instance: inst },
      }))
    })
  }, [instances, setNodes])

  useEffect(() => {
    setEdges(deriverAretes(instances, attributs, entities))
  }, [instances, attributs, entities, setEdges])

  if (instances.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-transparent p-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          Aucun objet en mémoire. Lancez la simulation : les entités des agents
          apparaîtront ici en direct, avec leurs liens.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background gap={18} className="opacity-40" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
