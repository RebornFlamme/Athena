import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listAppels } from '../../data/appelsApi'
import { formaterMs } from '../../sim/audioMeta'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import type { Appel } from '../../typesSimulation'
import { FeuilleTranscription } from '../dashboard/FeuilleTranscription'
import { VisualiseurAudioLive } from './VisualiseurAudioLive'

/**
 * « Live feed » : uniquement les appels EN COURS de diffusion. Un appel
 * apparaît quand il devient live (son instant de déclenchement) et disparaît
 * quand il est terminé. Chacun est une bande pleine largeur avec son
 * histogramme de voix ; un clic bascule l'écoute (muet par défaut).
 */
export function PanneauFluxAudio() {
  const [appels, setAppels] = useState<Appel[]>([])
  const [selection, setSelection] = useState<Appel | null>(null)
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
    <>
    <aside className="flex h-full flex-col bg-card">
      {fluxLive.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          {statut === 'lecture'
            ? 'No active call.'
            : 'Start the demo to see calls come in live.'}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {fluxLive.map((appel) => {
            const ecoute = ecoutes.includes(appel.id)
            return (
              <div
                key={appel.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelection(appel)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelection(appel)
                  }
                }}
                title="Open transcript"
                className="flex w-full cursor-pointer items-center gap-3 border-b bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    basculerEcoute(appel.id)
                  }}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                    ecoute
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title={ecoute ? 'Monitoring on — mute' : 'Listen to this feed'}
                >
                  {ecoute ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{appel.titre}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formaterMs(appel.ts_debut_ms)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <VisualiseurAudioLive appelId={appel.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </ScrollArea>
      )}
    </aside>

    <FeuilleTranscription
      appel={selection}
      actif={selection ? actifs.includes(selection.id) : false}
      ecoute={selection ? ecoutes.includes(selection.id) : false}
      onToggleEcoute={() => selection && basculerEcoute(selection.id)}
      onClose={() => setSelection(null)}
    />
    </>
  )
}
