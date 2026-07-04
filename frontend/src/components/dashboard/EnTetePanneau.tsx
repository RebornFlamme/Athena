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
    <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titre}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {right}
        {onFermer && (
          <button
            onClick={onFermer}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
