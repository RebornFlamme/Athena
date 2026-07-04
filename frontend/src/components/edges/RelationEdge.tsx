import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

// Espacement vertical entre deux racines de liens partant du même côté d'un node.
const SPACING = 16

/**
 * Arête de relation entre deux objets. Quand plusieurs liens partent (ou
 * arrivent) du même côté d'une carte, leurs points d'ancrage sont répartis
 * uniformément le long de ce côté (offset calculé depuis data.sourceIndex /
 * sourceCount et data.targetIndex / targetCount, fournis par le Canvas).
 */
export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  label,
}: EdgeProps) {
  const sIndex = Number(data?.sourceIndex ?? 0)
  const sCount = Number(data?.sourceCount ?? 1)
  const tIndex = Number(data?.targetIndex ?? 0)
  const tCount = Number(data?.targetCount ?? 1)

  const sourceOffset = (sIndex - (sCount - 1) / 2) * SPACING
  const targetOffset = (tIndex - (tCount - 1) / 2) * SPACING

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: sourceY + sourceOffset,
    sourcePosition,
    targetX,
    targetY: targetY + targetOffset,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded border bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
