import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useInterventionStore } from '../../store/useInterventionStore'
import { useRealtimeIntervention } from '../../hooks/useRealtimeIntervention'
import { useSimulation } from '../../sim/useSimulation'
import type { Scenario } from '../../typesFlux'
import { CarteIntervention } from '../intervention/CarteIntervention'
import { MainCourante } from '../intervention/MainCourante'
import { PanneauTranscript } from './PanneauTranscript'

/**
 * La démo « money shot » : un appel se déroule (transcript à droite) et le
 * dashboard se construit tout seul — entités sur la carte, main courante —
 * sans une frappe au clavier. Écrit dans Supabase, rendu via le Realtime F0.
 */
export function SimulationView({
  scenario,
  interventionId,
  onQuitter,
}: {
  scenario: Scenario
  interventionId: string
  onQuitter: () => void
}) {
  const load = useInterventionStore((s) => s.load)
  const clear = useInterventionStore((s) => s.clear)
  const intervention = useInterventionStore((s) => s.intervention)
  const entites = useInterventionStore((s) => s.entites)

  useEffect(() => {
    void load(interventionId)
    return () => clear()
  }, [interventionId, load, clear])

  useRealtimeIntervention(interventionId)
  const { segments, phase, erreur } = useSimulation(scenario, interventionId)

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <Button variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground" onClick={onQuitter}>
          <ArrowLeft className="h-4 w-4" /> Flux
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="min-w-0 truncate text-sm font-semibold">{scenario.titre}</div>
        <div className="flex-1" />
        <Badge variant="outline" className="gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              phase === 'en_cours' ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground'
            }`}
          />
          {phase === 'en_cours' ? 'Simulation en cours' : 'Simulation terminée'}
        </Badge>
      </header>

      {erreur && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{erreur}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <CarteIntervention
            entites={entites}
            centre={intervention ? { lon: intervention.lon, lat: intervention.lat } : null}
          />
        </div>
        <PanneauTranscript heureDebut={scenario.heure_debut} segments={segments} phase={phase} />
        <MainCourante />
      </div>
    </div>
  )
}
