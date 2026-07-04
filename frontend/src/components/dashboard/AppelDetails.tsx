import { Brain, Building2, MapPin, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { Appel } from '../../typesSimulation'

function initiales(nom: string): string {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/** En-tête « opérateur au téléphone » (Avatar + nom). */
export function EnteteOperateur({ appel }: { appel: Appel }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback>
          {appel.operateur ? initiales(appel.operateur) : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Opérateur</div>
        <div className="truncate text-sm font-medium">{appel.operateur ?? '—'}</div>
      </div>
    </div>
  )
}

/** Espace réservé à la chaîne de raisonnement du LLM (à venir). */
export function SectionRaisonnement() {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Brain className="h-3.5 w-3.5" /> Raisonnement du LLM
      </h3>
      <div className="rounded-lg border border-dashed p-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Espace réservé — la chaîne de raisonnement de l'extraction s'affichera ici.
        </p>
      </div>
    </section>
  )
}

/** Localisation de l'appel + caserne qui reçoit. */
export function DetailsLieu({ appel }: { appel: Appel }) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Localisation</span>
        <span className="ml-auto min-w-0 truncate text-right font-medium">
          {appel.localisation ?? '—'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Caserne</span>
        <span className="ml-auto min-w-0 truncate text-right font-medium">{appel.caserne ?? '—'}</span>
      </div>
    </section>
  )
}
