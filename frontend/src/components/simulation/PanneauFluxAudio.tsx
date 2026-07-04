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
 * Panneau droit du dashboard : les flux audio (appels) de la simulation.
 * Chaque flux montre son activité vocale en direct (histogramme). Un clic
 * bascule l'écoute — par défaut tout est muet, on choisit ce qu'on entend.
 */
export function PanneauFluxAudio() {
  const [appels, setAppels] = useState<Appel[]>([])
  const [chargement, setChargement] = useState(true)
  const statut = useSimulationPlayback((s) => s.statut)
  const actifs = useSimulationPlayback((s) => s.actifs)
  const ecoutes = useSimulationPlayback((s) => s.ecoutes)
  const basculerEcoute = useSimulationPlayback((s) => s.basculerEcoute)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChargement(false)
      return
    }
    listAppels()
      .then(setAppels)
      .catch(() => {})
      .finally(() => setChargement(false))
  }, [])

  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Radio className="h-3.5 w-3.5" /> Flux audio
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {appels.length}
        </Badge>
        {statut === 'lecture' && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-normal normal-case text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> en direct
          </span>
        )}
      </div>

      {!chargement && appels.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          Aucun flux. Ajoutez des appels dans l'onglet Simulation, puis lancez la démonstration.
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-3">
            {appels.map((appel) => {
              const actif = actifs.includes(appel.id)
              const ecoute = ecoutes.includes(appel.id)
              return (
                <button
                  key={appel.id}
                  onClick={() => basculerEcoute(appel.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    actif ? 'border-primary/40 bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {appel.titre}
                      </span>
                      {actif && (
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 border-emerald-500/50 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          en direct
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <VisualiseurVoix appelId={appel.id} actif={actif} />
                    </div>
                    <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                      {formaterMs(appel.ts_debut_ms)} · {formaterMs(appel.duree_ms)}
                    </div>
                  </div>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      ecoute ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                    title={ecoute ? 'Écoute activée — couper' : 'Écouter ce flux'}
                  >
                    {ecoute ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </aside>
  )
}
