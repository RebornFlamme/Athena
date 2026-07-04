import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useInterventionStore } from '../../store/useInterventionStore'
import { useRealtimeIntervention } from '../../hooks/useRealtimeIntervention'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { CarteIntervention } from './CarteIntervention'
import { PanneauFluxAudio } from '../simulation/PanneauFluxAudio'

/** Message d'aide ciblé si la migration 0002 n'est pas encore appliquée. */
function messageErreur(error: string): string {
  if (error.includes("Could not find the table")) {
    return "Les tables Athena n'existent pas encore : applique la migration supabase/migrations/0002_athena_core.sql dans le SQL Editor de Supabase."
  }
  return error
}

/**
 * LE dashboard de crise : carte plein écran + main courante à droite,
 * mis à jour en direct via Supabase Realtime.
 */
export function InterventionPage() {
  const { id } = useParams<{ id: string }>()
  const load = useInterventionStore((s) => s.load)
  const clear = useInterventionStore((s) => s.clear)
  const intervention = useInterventionStore((s) => s.intervention)
  const entites = useInterventionStore((s) => s.entites)
  const status = useInterventionStore((s) => s.status)
  const error = useInterventionStore((s) => s.error)

  useEffect(() => {
    if (isSupabaseConfigured && id) void load(id)
    return () => clear()
  }, [id, load, clear])

  useRealtimeIntervention(id)

  const dot =
    status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-destructive' : 'bg-amber-500'
  const statusText =
    status === 'ready' ? 'temps réel' : status === 'loading' ? 'chargement…' : status === 'error' ? 'erreur' : '—'

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-5" />
        <Button asChild variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground">
          <Link to="/tableau-de-bord">
            <ArrowLeft className="h-4 w-4" /> Interventions
          </Link>
        </Button>
        <div className="min-w-0 truncate text-sm font-semibold">
          {intervention?.titre ?? 'Intervention'}
          {intervention?.adresse && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {intervention.adresse}
            </span>
          )}
        </div>
        <div className="flex-1" />
        {intervention && (
          <Badge
            variant="outline"
            className={
              intervention.statut === 'active'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            }
          >
            {intervention.statut === 'active' ? 'En cours' : 'Terminée'}
          </Badge>
        )}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {statusText}
        </span>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code> puis relance <code>npm run dev</code>.
        </div>
      )}
      {isSupabaseConfigured && error && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {messageErreur(error)}
        </div>
      )}

      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={68} minSize={40}>
          <div className="relative h-full">
            <CarteIntervention
              entites={entites}
              centre={intervention ? { lon: intervention.lon, lat: intervention.lat } : null}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={32} minSize={22}>
          <PanneauFluxAudio />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
