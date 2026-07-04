import { useState, type ReactNode } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { isSupabaseConfigured } from '../../lib/supabase'
import { Carte } from './Carte'
import { EnTetePanneau } from './EnTetePanneau'
import { PanneauObjets } from './PanneauObjets'
import { PanneauDiff } from './PanneauDiff'
import { PanneauSemanticLayer, type LigneSemantic } from './PanneauSemanticLayer'
import { PanneauFluxAudio } from '../simulation/PanneauFluxAudio'

type PanId = 'carte' | 'objets' | 'live' | 'semantic'
const PANS: PanId[] = ['carte', 'objets', 'live', 'semantic']
const TITRES: Record<PanId, string> = {
  carte: 'Carte',
  objets: 'Objets',
  live: 'Live feed',
  semantic: 'Semantic Layer Edit',
}

interface Item {
  id: string
  order: number
  node: ReactNode
  min: number
}

/** Empile des panneaux verticalement (ou un seul, sans groupe superflu). */
function GroupeVertical({ items }: { items: Item[] }) {
  if (items.length === 1) return <div className="h-full">{items[0].node}</div>
  const enfants: ReactNode[] = []
  items.forEach((it, i) => {
    if (i > 0) enfants.push(<ResizableHandle key={`h-${it.id}`} withHandle />)
    enfants.push(
      <ResizablePanel key={it.id} id={it.id} order={it.order} minSize={it.min}>
        {it.node}
      </ResizablePanel>,
    )
  })
  return <ResizablePanelGroup direction="vertical">{enfants}</ResizablePanelGroup>
}

/**
 * Le dashboard : deux colonnes redimensionnables (carte+objets / live+sémantique),
 * plus une colonne diff qui s'ouvre à droite au clic d'une action LLM. Chaque
 * panneau est un onglet fermable ; on le rouvre depuis l'en-tête.
 */
export function DashboardPage() {
  const [ouverts, setOuverts] = useState<Record<PanId, boolean>>({
    carte: true,
    objets: true,
    live: true,
    semantic: true,
  })
  const [diff, setDiff] = useState<LigneSemantic | null>(null)

  const fermer = (id: PanId) => setOuverts((o) => ({ ...o, [id]: false }))
  const ouvrir = (id: PanId) => setOuverts((o) => ({ ...o, [id]: true }))

  const carteNode = (
    <div className="flex h-full flex-col">
      <EnTetePanneau icon={MapIcon} titre="Carte" onFermer={() => fermer('carte')} />
      <div className="relative flex-1">
        <Carte />
      </div>
    </div>
  )

  const gauche: Item[] = [
    ouverts.carte && { id: 'p-carte', order: 0, node: carteNode, min: 20 },
    ouverts.objets && {
      id: 'p-objets',
      order: 1,
      node: <PanneauObjets onFermer={() => fermer('objets')} />,
      min: 12,
    },
  ].filter(Boolean) as Item[]

  const milieu: Item[] = [
    ouverts.live && {
      id: 'p-live',
      order: 0,
      node: <PanneauFluxAudio onFermer={() => fermer('live')} />,
      min: 15,
    },
    ouverts.semantic && {
      id: 'p-semantic',
      order: 1,
      node: (
        <PanneauSemanticLayer
          onFermer={() => fermer('semantic')}
          onSelect={setDiff}
          selectionId={diff?.id}
        />
      ),
      min: 12,
    },
  ].filter(Boolean) as Item[]

  const colonnes: (Item & { defaut: number })[] = []
  if (gauche.length)
    colonnes.push({ id: 'col-gauche', order: 0, min: 30, defaut: 46, node: <GroupeVertical items={gauche} /> })
  if (milieu.length)
    colonnes.push({ id: 'col-milieu', order: 1, min: 20, defaut: 30, node: <GroupeVertical items={milieu} /> })
  if (diff)
    colonnes.push({
      id: 'col-diff',
      order: 2,
      min: 16,
      defaut: 24,
      node: <PanneauDiff ligne={diff} onFermer={() => setDiff(null)} />,
    })

  const fermes = PANS.filter((p) => !ouverts[p])

  const enfantsH: ReactNode[] = []
  colonnes.forEach((c, i) => {
    if (i > 0) enfantsH.push(<ResizableHandle key={`h-${c.id}`} withHandle />)
    enfantsH.push(
      <ResizablePanel key={c.id} id={c.id} order={c.order} defaultSize={c.defaut} minSize={c.min}>
        {c.node}
      </ResizablePanel>,
    )
  })

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">Tableau de bord</h1>
        {fermes.length > 0 && (
          <div className="ml-4 flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">Rouvrir :</span>
            {fermes.map((p) => (
              <Button
                key={p}
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => ouvrir(p)}
              >
                + {TITRES[p]}
              </Button>
            ))}
          </div>
        )}
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code> puis relance <code>npm run dev</code>.
        </div>
      )}

      {colonnes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Tous les panneaux sont fermés — rouvrez-en un ci-dessus.
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
          {enfantsH}
        </ResizablePanelGroup>
      )}
    </div>
  )
}
