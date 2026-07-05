import { useMemo } from 'react'
import type { ObjectInstance } from '../data/instancesApi'
import type { JournalAgent } from '../data/journalAgentApi'
import { useTimeline } from '../store/useTimeline'
import { useInstancesDB } from './useInstancesDB'
import { useSemanticEditsDB } from './useJournalAgentDB'

// Filtrent les données au curseur de la timeline : en mode live (suit) on renvoie
// tout, sinon uniquement ce dont `cree_le <= curseur`. C'est ce qui fait
// « rejouer » l'apparition des entités quand on recule le curseur.

function tempsDe(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** Instances d'objets visibles à la position du curseur (toutes si live). */
export function useInstancesScrub(): ObjectInstance[] {
  const all = useInstancesDB()
  const suit = useTimeline((s) => s.suit)
  const curseur = useTimeline((s) => s.curseur)
  return useMemo(
    () => (suit ? all : all.filter((i) => tempsDe(i.cree_le) <= curseur)),
    [all, suit, curseur],
  )
}

/** Édits sémantiques visibles à la position du curseur (tous si live). */
export function useEditsScrub(): JournalAgent[] {
  const all = useSemanticEditsDB()
  const suit = useTimeline((s) => s.suit)
  const curseur = useTimeline((s) => s.curseur)
  return useMemo(
    () => (suit ? all : all.filter((j) => tempsDe(j.cree_le) <= curseur)),
    [all, suit, curseur],
  )
}
