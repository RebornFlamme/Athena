import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSemanticEditsDB } from '../../hooks/useJournalAgentDB'
import type { JournalAgent } from '../../data/journalAgentApi'

export interface DiffChamp {
  champ: string
  avant: string | null
  apres: string | null
}

export interface LigneSemantic {
  id: string
  t: string
  texte: string
  objet: string
  diff: DiffChamp[]
}

/** Convertit une ligne de journal d'agent (edit) en ligne d'affichage. */
function versLigne(j: JournalAgent): LigneSemantic {
  return {
    id: String(j.id),
    t: new Date(j.cree_le).toLocaleTimeString('fr-FR', { hour12: false }),
    texte: j.texte ?? '',
    objet: j.objet ?? '(object)',
    diff: (j.diff ?? []).map((d) => ({ champ: d.champ, avant: d.avant, apres: d.apres })),
  }
}

/** Genre d'édition : ajout (vert), suppression (rouge), modification (neutre). */
function genreDe(diff: DiffChamp[]): 'ajout' | 'suppression' | 'modif' {
  if (diff.length === 0) return 'modif'
  if (diff.every((d) => d.avant == null && d.apres != null)) return 'ajout'
  if (diff.every((d) => d.apres == null && d.avant != null)) return 'suppression'
  return 'modif'
}

// Style Vercel : une petite pastille colorée (point), pas d'icône.
const PASTILLE = {
  ajout: 'bg-emerald-500',
  suppression: 'bg-red-500',
  modif: 'bg-muted-foreground/50',
} as const

/**
 * Panneau « Semantic Layer Edit » : le journal des actions de l'agent LLM.
 * Par défaut alimenté par `useSemanticEditsDB` (journal `agent_journal`, edits
 * create/modif/suppr avec diff). Accepte aussi des `lignes` en prop (compat.
 * câblage « run » historique). Cliquer une ligne ouvre le diff visuel à droite.
 */
export function PanneauSemanticLayer({
  lignes,
  onSelect,
  selectionId,
}: {
  lignes?: LigneSemantic[]
  onSelect?: (ligne: LigneSemantic) => void
  selectionId?: string | null
}) {
  const auto = useSemanticEditsDB()
  const source = lignes ?? auto.map(versLigne)

  return (
    <aside className="flex h-full flex-col bg-card">
      {source.length === 0 && (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          No edits yet. Object creations and updates from the agents will appear
          here as the simulation runs.
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1">
        {source.map((l) => {
          const pastille = PASTILLE[genreDe(l.diff)]
          return (
            <button
              key={l.id}
              onClick={() => onSelect?.(l)}
              className={`flex w-full items-center gap-2.5 border-b px-4 py-2 text-left text-sm transition-colors hover:bg-accent ${
                selectionId === l.id ? 'bg-primary/10' : ''
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${pastille}`} />
              <span className="max-w-[45%] shrink-0 truncate font-medium">{l.objet}</span>
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                {l.diff.map((d) => (
                  <Badge
                    key={d.champ}
                    variant="outline"
                    className="h-5 shrink-0 px-1.5 text-[10px] font-normal"
                  >
                    {d.champ}
                  </Badge>
                ))}
              </div>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {l.t}
              </span>
            </button>
          )
        })}
      </ScrollArea>
    </aside>
  )
}
