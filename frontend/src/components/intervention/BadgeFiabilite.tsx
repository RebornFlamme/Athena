import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUTS, type StatutInfo } from '../../typesAthena'

const classesParStatut: Record<StatutInfo, string> = {
  presume: 'border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  confirme: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  corrige: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  perime: 'border-muted-foreground/40 bg-muted text-muted-foreground line-through',
}

/**
 * Badge d'état d'une information : ambre « présumé », vert « confirmé »…
 * Règle projet : l'IA propose, l'humain valide — l'état se lit d'un coup d'œil.
 */
export function BadgeFiabilite({
  statut,
  fiabilite,
}: {
  statut: StatutInfo
  fiabilite?: string
}) {
  const s = STATUTS[statut] ?? STATUTS.presume
  return (
    <Badge
      variant="outline"
      className={cn('h-5 shrink-0 px-1.5 text-[10px] font-medium uppercase tracking-wide', classesParStatut[statut] ?? classesParStatut.presume)}
      title={fiabilite ? `Statut : ${s.libelle} · Fiabilité ${fiabilite} (code Admiralty)` : `Statut : ${s.libelle}`}
    >
      {s.libelle}
      {fiabilite ? ` · ${fiabilite}` : ''}
    </Badge>
  )
}
