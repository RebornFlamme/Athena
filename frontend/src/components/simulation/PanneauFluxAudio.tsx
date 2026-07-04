import { useEffect, useState } from 'react'
import { Radio, Volume2, VolumeX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listAppels } from '../../data/appelsApi'
import { formaterMs } from '../../sim/audioMeta'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import type { Appel } from '../../typesSimulation'
import { VisualiseurVoix } from './VisualiseurVoix'

/**
 * « Live feed » : uniquement les appels EN COURS de diffusion. Un appel
 * apparaît quand il devient live (son instant de déclenchement) et disparaît
 * quand il est terminé. Chacun est une bande pleine largeur avec son
 * histogramme de voix ; un clic bascule l'écoute (muet par défaut).
 */
export function PanneauFluxAudio() {
  const [appels, setAppels] = useState<Appel[]>([])
  const statut = useSimulationPlayback((s) => s.statut)
  const actifs = useSimulationPlayback((s) => s.actifs)
  const ecoutes = useSimulationPlayback((s) => s.ecoutes)
  const basculerEcoute = useSimulationPlayback((s) => s.basculerEcoute)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    listAppels()
      .then(setAppels)
      .catch(() => {})
  }, [])

  const parId = new Map(appels.map((a) => [a.id, a]))
  const fluxLive = actifs.map((id) => parId.get(id)).filter((a): a is Appel => a != null)

  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Radio className="h-3.5 w-3.5" /> Live feed
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {fluxLive.length}
        </Badge>
        {statut === 'lecture' && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal normal-case text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> en direct
          </span>
        )}
      </div>

      {fluxLive.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          {statut === 'lecture'
            ? 'Aucun appel en cours.'
            : 'Lancez la démonstration pour voir les appels arriver en direct.'}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {fluxLive.map((appel) => {
            const ecoute = ecoutes.includes(appel.id)
            return (
              <button
                key={appel.id}
                onClick={() => basculerEcoute(appel.id)}
                className="flex w-full items-center gap-3 border-b bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    ecoute ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                  title={ecoute ? 'Écoute activée — couper' : 'Écouter ce flux'}
                >
                  {ecoute ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{appel.titre}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formaterMs(appel.ts_debut_ms)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <VisualiseurVoix appelId={appel.id} actif />
                  </div>
                </div>
              </button>
            )
          })}
        </ScrollArea>
      )}
    </aside>
  )
}
