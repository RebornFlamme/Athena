import { useEffect, useState } from 'react'
import { History, RotateCcw, Trash2 } from 'lucide-react'
import { useSchemaStore } from '../store/useSchemaStore'
import type { SchemaVersion } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

// Une ligne de version : libellé éditable inline + date + restaurer + supprimer.
function VersionRow({ version, onRestore }: { version: SchemaVersion; onRestore: () => void }) {
  const renameVersion = useSchemaStore((s) => s.renameVersion)
  const removeVersion = useSchemaStore((s) => s.removeVersion)

  const [label, setLabel] = useState(version.label ?? '')
  useEffect(() => setLabel(version.label ?? ''), [version.label])

  return (
    <div className="flex items-center gap-1 py-2">
      <div className="min-w-0 flex-1">
        <Input
          className="h-7 text-xs"
          value={label}
          placeholder="Unnamed version"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            const v = label.trim()
            if (v !== (version.label ?? '')) renameVersion(version.id, v)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <div className="px-1 pt-0.5 text-[10px] text-muted-foreground">
          {formatDate(version.created_at)}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 gap-1 text-xs"
        title="Reload this version into the canvas"
        onClick={onRestore}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Restore
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        title="Delete this version"
        onClick={() => removeVersion(version.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function SchemaHistorySheet() {
  const versions = useSchemaStore((s) => s.versions)
  const versionsStatus = useSchemaStore((s) => s.versionsStatus)
  const loadVersions = useSchemaStore((s) => s.loadVersions)
  const restoreVersion = useSchemaStore((s) => s.restoreVersion)

  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) void loadVersions() // rafraîchit à chaque ouverture
  }

  async function handleRestore(id: string) {
    await restoreVersion(id)
    setOpen(false) // le canvas reflète la version ; on ferme pour la voir
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <History className="h-4 w-4" /> History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="pb-2">
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Each version is a snapshot of the schema. “Restore” reloads the version into the
            canvas; nothing is written to the live schema until you click “Overwrite Supabase”.
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <ScrollArea className="min-h-0 flex-1">
          {versionsStatus === 'loading' && (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          )}
          {versionsStatus !== 'loading' && versions.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              No saved versions. Click “Save version” in the top bar to create one.
            </div>
          )}
          {versions.length > 0 && (
            <div className="divide-y pr-2">
              {versions.map((v) => (
                <VersionRow key={v.id} version={v} onRestore={() => void handleRestore(v.id)} />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
