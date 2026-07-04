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

// Placeholder : éditions de la couche sémantique produites par le LLM.
// Chaque ligne porte le diff de l'objet modifié (figé pour l'instant).
const LIGNES: LigneSemantic[] = [
  {
    id: 'l1',
    t: '14:32:04',
    texte: 'Address confirmed — 12 rue des Lilas',
    objet: 'Sinistre',
    diff: [{ champ: 'adresse', avant: null, apres: '12 rue des Lilas, Lyon' }],
  },
  {
    id: 'l2',
    t: '14:32:11',
    texte: 'New victim located — 3rd floor',
    objet: 'Victime #1',
    diff: [
      { champ: 'localisation', avant: null, apres: '3e étage' },
      { champ: 'statut', avant: null, apres: 'présumé' },
    ],
  },
  {
    id: 'l3',
    t: '14:32:19',
    texte: 'Victim status updated — conscious',
    objet: 'Victime #1',
    diff: [{ champ: 'état', avant: 'inconnu', apres: 'consciente' }],
  },
  {
    id: 'l4',
    t: '14:33:02',
    texte: 'Unit engaged — VSAV 12',
    objet: 'Moyen — VSAV 12',
    diff: [
      { champ: 'engagé', avant: 'non', apres: 'oui' },
      { champ: 'statut', avant: null, apres: 'en route' },
    ],
  },
  {
    id: 'l5',
    t: '14:33:20',
    texte: 'Danger flag raised — smoke',
    objet: 'Sinistre',
    diff: [{ champ: 'danger', avant: null, apres: 'fumée dense' }],
  },
  {
    id: 'l6',
    t: '14:34:41',
    texte: 'Casualty count updated — 2',
    objet: 'Sinistre',
    diff: [{ champ: 'nb_victimes', avant: '1', apres: '2' }],
  },
]

/**
 * Panneau « Semantic Layer Edit » : le journal des actions du LLM. Cliquer une
 * ligne ouvre le diff visuel de l'objet modifié (à droite).
 */
export function PanneauSemanticLayer({
  onSelect,
  selectionId,
}: {
  onSelect?: (ligne: LigneSemantic) => void
  selectionId?: string | null
}) {
  return (
    <aside className="flex h-full flex-col bg-card">
      <ScrollArea className="min-h-0 flex-1">
        {LIGNES.map((l) => (
          <button
            key={l.id}
            onClick={() => onSelect?.(l)}
            className={`flex w-full items-center gap-3 border-b px-4 py-2 text-left text-sm transition-colors hover:bg-accent ${
              selectionId === l.id ? 'bg-primary/10' : ''
            }`}
          >
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{l.t}</span>
            <span className="min-w-0 flex-1 truncate">{l.texte}</span>
          </button>
        ))}
      </ScrollArea>
    </aside>
  )
}
