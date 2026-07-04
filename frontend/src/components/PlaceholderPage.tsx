import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

/** Page vide générique pour les sections pas encore implémentées de la webapp. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">{title}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Bientôt disponible.
      </div>
    </div>
  )
}
