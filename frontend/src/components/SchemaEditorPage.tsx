import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { isSupabaseConfigured } from '../lib/supabase'
import { useSchemaStore } from '../store/useSchemaStore'
import { useRealtimeSchema } from '../hooks/useRealtimeSchema'
import { Toolbar } from './Toolbar'
import { Canvas } from './Canvas'
import { InspectorPanel } from './InspectorPanel'

export function SchemaEditorPage() {
  const load = useSchemaStore((s) => s.load)
  const error = useSchemaStore((s) => s.error)

  useEffect(() => {
    if (isSupabaseConfigured) void load()
  }, [load])

  useRealtimeSchema()

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />

        {!isSupabaseConfigured && (
          <div className="banner">
            Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
            <code>.env.local</code>, renseigne <code>VITE_SUPABASE_URL</code> et{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>, puis relance <code>npm run dev</code>. Le
            schéma ne sera pas sauvegardé tant que ce n'est pas fait.
          </div>
        )}
        {isSupabaseConfigured && error && (
          <div className="banner">Erreur Supabase : {error}</div>
        )}

        <div className="app__body">
          <div className="canvas-wrap">
            <Canvas />
          </div>
          <InspectorPanel />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
