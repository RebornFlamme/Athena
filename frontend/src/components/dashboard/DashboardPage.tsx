import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { isSupabaseConfigured } from '../../lib/supabase'
import { Carte } from './Carte'
import { PanneauFluxAudio } from '../simulation/PanneauFluxAudio'

/**
 * Le dashboard : carte à gauche, flux audio à droite (panneaux redimensionnables).
 * Directement accessible — la simulation active alimente les flux ; la carte
 * recevra les entités quand la pipeline de traitement des appels sera branchée.
 */
export function DashboardPage() {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">Tableau de bord</h1>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code> puis relance <code>npm run dev</code>.
        </div>
      )}

      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={68} minSize={40}>
          <div className="relative h-full">
            <Carte />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={32} minSize={22}>
          <PanneauFluxAudio />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
