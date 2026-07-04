import { useReactFlow } from '@xyflow/react'
import { Plus, Save } from 'lucide-react'
import { useSchemaStore } from '../store/useSchemaStore'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

export function Toolbar() {
  const addEntity = useSchemaStore((s) => s.addEntity)
  const saveAll = useSchemaStore((s) => s.saveAll)
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
      <Button size="sm" className="gap-1" disabled={!dirty || saving} onClick={() => void saveAll()}>
        <Save className="h-4 w-4" /> Enregistrer
      </Button>
    </header>
  )
}
