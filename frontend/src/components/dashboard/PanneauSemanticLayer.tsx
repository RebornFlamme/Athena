import { Layers } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

// Placeholder : les éditions de la couche sémantique (déductions de la pipeline).
// Sera alimenté par le traitement des appels ; contenu figé pour l'instant.
const LIGNES: { t: string; texte: string }[] = [
  { t: '14:32:04', texte: 'Address confirmed — 12 rue des Lilas' },
  { t: '14:32:11', texte: 'New victim located — 3rd floor' },
  { t: '14:32:19', texte: 'Victim status updated — conscious' },
  { t: '14:33:02', texte: 'Unit engaged — VSAV 12' },
  { t: '14:33:20', texte: 'Danger flag raised — smoke' },
  { t: '14:34:05', texte: 'Perimeter defined — 50 m' },
  { t: '14:34:41', texte: 'Casualty count updated — 2' },
]

/** Panneau bas du dashboard : le journal des éditions de la couche sémantique. */
export function PanneauSemanticLayer() {
  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers className="h-3.5 w-3.5" /> Semantic Layer Edit
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {LIGNES.map((l, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-2 text-sm">
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{l.t}</span>
            <span className="min-w-0 flex-1 truncate">{l.texte}</span>
          </div>
        ))}
      </ScrollArea>
    </aside>
  )
}
