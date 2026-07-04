import { Play, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formaterMs } from '../../sim/audioMeta'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'

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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {statut === 'arret' ? (
        <Button
          size="icon"
          className="h-11 w-11 rounded-full shadow-lg"
          onClick={() => void lancer()}
          title="Lancer la démonstration"
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
            title="Revenir au début"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-9 w-9 rounded-full"
            onClick={() => couper()}
            title="Couper la démonstration"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
