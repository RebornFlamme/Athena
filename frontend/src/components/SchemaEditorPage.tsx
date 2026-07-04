import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { isSupabaseConfigured } from '../lib/supabase'
import { useSchemaStore } from '../store/useSchemaStore'
import { Toolbar } from './Toolbar'
import { Canvas } from './Canvas'

export function SchemaEditorPage() {
  const load = useSchemaStore((s) => s.load)
  const error = useSchemaStore((s) => s.error)
  const dirty = useSchemaStore((s) => s.dirty)

  useEffect(() => {
    if (isSupabaseConfigured) void load()
  }, [load])

  // Avertit avant de quitter l'onglet s'il reste des modifications non sauvegardées.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return (
    <ReactFlowProvider>
      <div className="flex h-svh flex-col bg-background">
        <Toolbar />

        {!isSupabaseConfigured && (
          <div className="border-b bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
            Supabase n'est pas configuré : renseigne <code>frontend/.env.local</code> puis
            relance <code>npm run dev</code>.
          </div>
        )}
        {isSupabaseConfigured && error && (
          <div className="border-b bg-destructive/15 px-4 py-2 text-xs text-destructive-foreground">
            Erreur Supabase : {error}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <Canvas />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
