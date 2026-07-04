import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

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

/** Genre d'édition : ajout (vert), suppression (rouge), modification (neutre). */
function genreDe(diff: DiffChamp[]): 'ajout' | 'suppression' | 'modif' {
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
 * Panneau « Semantic Layer Edit » : le journal des actions du LLM. Cliquer une
 * ligne ouvre le diff visuel de l'objet modifié (à droite). Purement
 * présentationnel — les lignes viennent des `evenements` du run (extraction LLM).
 */
export function PanneauSemanticLayer({
  lignes,
  onSelect,
  selectionId,
}: {
  lignes: LigneSemantic[]
  onSelect?: (ligne: LigneSemantic) => void
  selectionId?: string | null
}) {
  if (lignes.length === 0) {
    return (
      <aside className="flex h-full flex-col items-center justify-center gap-1 bg-card p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">Aucune extraction pour l'instant</p>
        <p className="text-[11px] text-muted-foreground">
          Lance une simulation : les faits identifiés par le LLM s'afficheront ici en direct.
        </p>
      </aside>
    )
  }

  return (
    <aside className="flex h-full flex-col bg-card">
      <ScrollArea className="min-h-0 flex-1">
        {lignes.map((l) => {
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
