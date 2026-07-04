import { ScrollArea } from '@/components/ui/scroll-area'
import type { LigneSemantic } from './PanneauSemanticLayer'

/**
 * Panneau de droite : diff visuel de l'objet modifié par une action du LLM.
 * Lignes retirées en rouge, ajoutées en vert (façon diff de code).
 */
export function PanneauDiff({ ligne }: { ligne: LigneSemantic }) {
  return (
    <aside className="flex h-full flex-col bg-card">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <div className="text-sm font-medium">{ligne.objet}</div>
          <div className="text-xs text-muted-foreground">
            <span className="tabular-nums">{ligne.t}</span> · {ligne.texte}
          </div>

          <div className="space-y-3">
            {ligne.diff.map((d, i) => (
              <div key={i} className="overflow-hidden rounded-lg border font-mono text-xs">
                <div className="border-b bg-muted/40 px-2 py-1 font-sans text-[11px] font-medium text-muted-foreground">
                  {d.champ}
                </div>
                {d.avant != null && (
                  <div className="flex gap-2 bg-red-500/10 px-2 py-1 text-red-600 dark:text-red-400">
                    <span className="select-none opacity-70">-</span>
                    <span className="min-w-0 break-words line-through decoration-red-500/40">
                      {d.avant}
                    </span>
                  </div>
                )}
                {d.apres != null && (
                  <div className="flex gap-2 bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400">
                    <span className="select-none opacity-70">+</span>
                    <span className="min-w-0 break-words">{d.apres}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] italic text-muted-foreground">
            Diff illustratif — produit par la pipeline d'extraction (à venir).
          </p>
        </div>
      </ScrollArea>
    </aside>
  )
}
