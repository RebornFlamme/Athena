import { useReactFlow } from '@xyflow/react'
import { DatabaseZap, Plus, RotateCcw, Save } from 'lucide-react'
import { useSchemaStore } from '../store/useSchemaStore'
import { SchemaHistorySheet } from './SchemaHistorySheet'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
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

export function Toolbar() {
  const addEntity = useSchemaStore((s) => s.addEntity)
  const saveAll = useSchemaStore((s) => s.saveAll)
  const saveVersion = useSchemaStore((s) => s.saveVersion)
  const savingVersion = useSchemaStore((s) => s.savingVersion)
  const resetSchema = useSchemaStore((s) => s.resetSchema)
  const dirty = useSchemaStore((s) => s.dirty)
  const saving = useSchemaStore((s) => s.saving)
  const error = useSchemaStore((s) => s.error)
  const count = useSchemaStore((s) => s.entities.length)
  const { screenToFlowPosition } = useReactFlow()

  function handleAdd() {
    const pos = screenToFlowPosition({
      x: window.innerWidth / 2 - 144,
      y: window.innerHeight / 2 - 60,
    })
    addEntity({ x: pos.x, y: pos.y })
  }

  const statusText = error
    ? 'Erreur'
    : saving
      ? 'Enregistrement…'
      : dirty
        ? 'Modifications non enregistrées'
        : 'Schéma enregistré'
  const dot = error
    ? 'bg-destructive'
    : dirty || saving
      ? 'bg-amber-500'
      : 'bg-emerald-500'

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="text-sm font-semibold">
        Éditeur de schéma EAV
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {count} objet{count > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex-1" />
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {statusText}
      </span>
      <Button size="sm" variant="outline" className="gap-1" onClick={handleAdd}>
        <Plus className="h-4 w-4" /> Nouvel objet
      </Button>
      <SchemaHistorySheet />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-muted-foreground hover:text-destructive"
            disabled={saving}
            title="Vider tout le schéma dans Supabase"
          >
            <RotateCcw className="h-4 w-4" /> Réinitialiser
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser tout le schéma ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les objets et leurs champs seront <strong>définitivement supprimés</strong> de
              Supabase, ainsi que du canvas. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void resetSchema()}
            >
              Tout réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Separator orientation="vertical" className="h-5" />
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        disabled={savingVersion || count === 0}
        title="Enregistrer un instantané du schéma dans l'historique"
        onClick={() => void saveVersion()}
      >
        <Save className="h-4 w-4" /> Enregistrer la version
      </Button>
      <Button
        size="sm"
        className="gap-1"
        disabled={!dirty || saving}
        title="Remplacer le schéma live dans Supabase par le canvas actuel"
        onClick={() => void saveAll()}
      >
        <DatabaseZap className="h-4 w-4" /> Écraser Supabase
      </Button>
    </header>
  )
}
