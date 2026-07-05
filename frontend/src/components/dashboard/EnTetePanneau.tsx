import { X } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

/**
 * En-tête d'un panneau façon onglet : icône + nom à gauche, croix de fermeture
 * à droite (+ contenu optionnel `right`, ex. compteur).
 */
export function EnTetePanneau({
  icon: Icon,
  titre,
  onFermer,
  right,
}: {
  icon: ComponentType<{ className?: string }>
  titre: string
  onFermer?: () => void
  right?: ReactNode
}) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-1.5 border-b bg-muted/30 px-2.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titre}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {right}
        {onFermer && (
          <button
            onClick={onFermer}
            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
