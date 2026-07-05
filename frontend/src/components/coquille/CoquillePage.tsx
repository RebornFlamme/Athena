import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { CarteEngagement } from './CarteEngagement'

/** Version pleine page de la carte tactique + engagement des engins (/coquille).
 *  Le même contenu (`CarteEngagement`) est aussi monté dans le tableau de bord. */
export function CoquillePage() {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">Vehicles — deployment</h1>
      </header>
      <div className="relative min-h-0 flex-1">
        <CarteEngagement />
      </div>
    </div>
  )
}
