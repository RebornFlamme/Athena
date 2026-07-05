import { useCallback, useRef, type ComponentType, type FunctionComponent } from 'react'
import { Boxes, History, Layers, Map as MapIcon, Radio } from 'lucide-react'
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from 'dockview-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useTheme } from '../../store/useTheme'
import { CarteEngagement } from '../coquille/CarteEngagement'
import { PanneauDiff } from './PanneauDiff'
import { PanneauObjets } from './PanneauObjets'
import { PanneauPastCalls } from './PanneauPastCalls'
import { PanneauSemanticLayer, type LigneSemantic } from './PanneauSemanticLayer'
import { PanneauFluxAudio } from '../simulation/PanneauFluxAudio'

// Contenu de chaque panneau (l'onglet + le drag/split sont gérés par dockview).
// Carte + Semantic Layer sont alimentés par les agents LLM (object_instances /
// agent_journal) via leurs hooks internes ; les wrappers « run » historiques
// (CarteRun/SemanticRun, câblés sur entites/evenements) restent dormants.
const COMPOSANTS: Record<string, FunctionComponent<IDockviewPanelProps>> = {
  carte: () => (
    <div className="relative h-full">
      <CarteEngagement />
    </div>
  ),
  objets: () => <PanneauObjets />,
  live: () => <PanneauFluxAudio />,
  semantic: (p) => (
    <PanneauSemanticLayer
      onSelect={(p.params as { onSelect?: (l: LigneSemantic) => void }).onSelect}
    />
  ),
  past: () => <PanneauPastCalls />,
  diff: (p) => <PanneauDiff ligne={(p.params as { ligne: LigneSemantic }).ligne} />,
}

type PanId = 'carte' | 'objets' | 'live' | 'semantic' | 'past'
const OUVRABLES: { id: PanId; titre: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'carte', titre: 'Map', icon: MapIcon },
  { id: 'objets', titre: 'Objects', icon: Boxes },
  { id: 'live', titre: 'Live feed', icon: Radio },
  { id: 'semantic', titre: 'Semantic Layer Edit', icon: Layers },
  { id: 'past', titre: 'Past calls', icon: History },
]

/**
 * Dashboard en docking (dockview) : on drag les onglets, on drop sur les bords
 * pour splitter (haut/bas/gauche/droite), on empile des onglets. Une barre en
 * haut rouvre un panneau ; cliquer une action LLM ouvre le diff à droite.
 */
export function DashboardPage() {
  const apiRef = useRef<DockviewApi | null>(null)
  // Le thème de base dockview suit le mode clair/sombre ; `.dv-athena` raccorde
  // ensuite les couleurs aux variables shadcn (theme-aware) par-dessus.
  const sombre = useTheme((s) => s.sombre)
  const themeDockview = sombre ? 'dockview-theme-abyss' : 'dockview-theme-light'

  const openDiff = useCallback((ligne: LigneSemantic) => {
    const api = apiRef.current
    if (!api) return
    const existant = api.getPanel('diff')
    if (existant) {
      existant.api.updateParameters({ ligne })
      existant.api.setTitle(`Diff — ${ligne.objet}`)
      existant.api.setActive()
    } else {
      api.addPanel({
        id: 'diff',
        component: 'diff',
        title: `Diff — ${ligne.objet}`,
        params: { ligne },
        position: { referencePanel: 'semantic', direction: 'right' },
      })
    }
  }, [])

  const ouvrir = useCallback(
    (id: PanId) => {
      const api = apiRef.current
      if (!api) return
      const existant = api.getPanel(id)
      if (existant) {
        existant.api.setActive()
        return
      }
      const titre = OUVRABLES.find((o) => o.id === id)?.titre ?? id
      api.addPanel({
        id,
        component: id,
        title: titre,
        params: id === 'semantic' ? { onSelect: openDiff } : undefined,
      })
    },
    [openDiff],
  )

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api
      apiRef.current = api
      api.addPanel({ id: 'carte', component: 'carte', title: 'Map' })
      api.addPanel({
        id: 'objets',
        component: 'objets',
        title: 'Objects',
        position: { referencePanel: 'carte', direction: 'below' },
      })
      api.addPanel({
        id: 'live',
        component: 'live',
        title: 'Live feed',
        position: { referencePanel: 'carte', direction: 'right' },
      })
      api.addPanel({
        id: 'semantic',
        component: 'semantic',
        title: 'Semantic Layer Edit',
        params: { onSelect: openDiff },
        position: { referencePanel: 'live', direction: 'below' },
      })
    },
    [openDiff],
  )

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">Dashboard</h1>
      </header>

      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/20 px-3">
        <span className="mr-1 shrink-0 text-[11px] text-muted-foreground">Open:</span>
        {OUVRABLES.map(({ id, titre, icon: Icon }) => (
          <Button
            key={id}
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={() => ouvrir(id)}
          >
            <Icon className="h-3.5 w-3.5" /> {titre}
          </Button>
        ))}
      </div>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase is not configured: copy <code>frontend/.env.example</code> to{' '}
          <code>.env.local</code> then restart <code>npm run dev</code>.
        </div>
      )}

      <div className="min-h-0 flex-1">
        <div className={`${themeDockview} dv-athena h-full`}>
          <DockviewReact components={COMPOSANTS} onReady={onReady} />
        </div>
      </div>
    </div>
  )
}
