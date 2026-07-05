import { FlaskConical, Play, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formaterMs } from '../../sim/audioMeta'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import { useMockData } from '../../store/useMockData'

/**
 * Contrôle flottant discret (bas-droite) de la simulation active : Lancer,
 * Revenir au début, Couper. N'ouvre aucun panneau — overlay global.
 */
export function ControleSimulation() {
  const statut = useSimulationPlayback((s) => s.statut)
  const positionMs = useSimulationPlayback((s) => s.positionMs)
  const lancer = useSimulationPlayback((s) => s.lancer)
  const revenirDebut = useSimulationPlayback((s) => s.revenirDebut)
  const couper = useSimulationPlayback((s) => s.couper)
  const mockActif = useMockData((s) => s.actif)
  const mockOccupe = useMockData((s) => s.occupe)
  const basculerMock = useMockData((s) => s.basculer)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <Button
        size="icon"
        variant={mockActif ? 'default' : 'outline'}
        className="h-11 w-11 rounded-full shadow-lg"
        onClick={() => void basculerMock()}
        disabled={mockOccupe}
        title={mockActif ? 'Remove mock objects' : 'Fill with mock objects'}
      >
        <FlaskConical className="h-5 w-5" />
      </Button>
      {statut === 'arret' ? (
        <Button
          size="icon"
          className="h-11 w-11 rounded-full shadow-lg"
          onClick={() => void lancer()}
          title="Start the demo"
        >
          <Play className="h-5 w-5" />
        </Button>
      ) : (
        <div className="flex items-center gap-1 rounded-full border bg-card p-1 shadow-lg">
          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            {formaterMs(positionMs)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full"
            onClick={() => void revenirDebut()}
            title="Reset to start"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-9 w-9 rounded-full"
            onClick={() => couper()}
            title="Stop the demo"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
