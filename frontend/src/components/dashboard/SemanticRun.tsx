import { useMemo } from 'react'
import { useEntitesRun } from '../../hooks/useEntitesRun'
import { useEvenementsRun } from '../../hooks/useEvenementsRun'
import { construireLignesSemantiques } from '../../lib/coucheSemantique'
import { PanneauSemanticLayer, type LigneSemantic } from './PanneauSemanticLayer'

/**
 * Couche sémantique alimentée par le journal `evenements` réel du run (chaîne de
 * raisonnement du LLM), joint aux entités pour résoudre les libellés + diffs.
 */
export function SemanticRun({
  onSelect,
  selectionId,
}: {
  onSelect?: (l: LigneSemantic) => void
  selectionId?: string | null
}) {
  const entites = useEntitesRun()
  const evenements = useEvenementsRun()
  const lignes = useMemo(
    () => construireLignesSemantiques(evenements, entites),
    [evenements, entites],
  )
  return <PanneauSemanticLayer lignes={lignes} onSelect={onSelect} selectionId={selectionId} />
}
