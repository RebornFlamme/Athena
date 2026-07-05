import { useState } from 'react'
import { FlaskConical, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formaterMs } from '../../sim/audioMeta'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import { useMockData } from '../../store/useMockData'
import { deleteAllInstances } from '../../data/instancesApi'
import { deleteAllJournal } from '../../data/journalAgentApi'

/**
 * Contrôle flottant discret (bas-droite) de la simulation active : Lancer,
 * Revenir au début, Couper. N'ouvre aucun panneau — overlay global. Un bouton
 * dédié vide toutes les instances créées (+ le journal des agents).
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
  const [videEnCours, setVideEnCours] = useState(false)

  // Vide toutes les instances créées + le journal des agents. Les surfaces se
  // vident en direct via Realtime (useInstancesDB, etc.).
  async function viderInstances() {
    setVideEnCours(true)
    try {
      await deleteAllInstances()
      await deleteAllJournal()
    } catch (_) {
      // échec réseau/RLS : on laisse l'état ; l'utilisateur peut réessayer.
    } finally {
      setVideEnCours(false)
    }
  }

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

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-full text-destructive shadow-lg hover:bg-destructive hover:text-destructive-foreground"
            disabled={videEnCours}
            title="Clear all created objects"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all created objects?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every object instance produced by the
              agents, along with their reasoning journal. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void viderInstances()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear objects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
