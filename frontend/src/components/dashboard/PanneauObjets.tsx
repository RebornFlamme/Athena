import { useMemo, useState } from 'react'
import { ChevronDown, ListFilter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { STATUTS } from '../../typesAthena'
import { useInstancesDB } from '../../hooks/useInstancesDB'
import type { ObjectInstance } from '../../data/instancesApi'

/** Rendu lisible d'une valeur de champ d'instance. */
function valeurLisible(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/**
 * Panneau bas de la colonne carte : les INSTANCES d'objets créées en direct par
 * les agents LLM (tous appels confondus). Filtre par type via menu déroulant ;
 * cards alignées sur une ligne scrollable horizontalement.
 */
export function PanneauObjets() {
  const instances = useInstancesDB()
  const [masques, setMasques] = useState<Set<string>>(new Set())

  // Types présents (dans l'ordre d'apparition).
  const types = useMemo(() => {
    const vus: string[] = []
    for (const i of instances) if (!vus.includes(i.type_name)) vus.push(i.type_name)
    return vus
  }, [instances])

  const visibles = instances.filter((i) => !masques.has(i.type_name))

  function basculer(type: string, coche: boolean) {
    setMasques((prev) => {
      const next = new Set(prev)
      if (coche) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <aside className="flex h-full flex-col bg-transparent">
      {instances.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          Aucun objet pour l'instant. Lancez la simulation : les agents créeront les
          instances au fil des appels.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 border-b p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <ListFilter className="h-3.5 w-3.5" /> Afficher
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                <DropdownMenuLabel>Types à afficher</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {types.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={!masques.has(t)}
                    onCheckedChange={(c) => basculer(t, c)}
                    onSelect={(ev) => ev.preventDefault()}
                  >
                    {t}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {types
              .filter((t) => !masques.has(t))
              .map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1 font-normal">
                  {t}
                  <button
                    onClick={() => basculer(t, false)}
                    className="ml-0.5 rounded-sm p-0.5 hover:bg-background/60"
                    title="Masquer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex items-start gap-2 p-3">
              {visibles.map((instance) => (
                <CarteInstance key={instance.id} instance={instance} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </>
      )}
    </aside>
  )
}

function CarteInstance({ instance }: { instance: ObjectInstance }) {
  const s = STATUTS[instance.statut] ?? STATUTS.presume
  const champs = Object.entries(instance.fields ?? {})
  return (
    <Card className="w-56 shrink-0 border-white/50 bg-white/70 shadow-lg backdrop-blur-md transition-colors hover:bg-white/80">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: s.couleur }}
            title={s.libelle}
          />
          <span className="min-w-0 flex-1 truncate">{instance.libelle}</span>
        </CardTitle>
        <Badge variant="secondary" className="mt-1 w-fit text-[10px] font-normal">
          {instance.type_name}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {champs.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Aucun champ.</p>
        ) : (
          <ul className="space-y-1">
            {champs.map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 shrink-0 font-medium">{k}</span>
                <span className="min-w-0 truncate text-right text-[11px] text-muted-foreground">
                  {valeurLisible(v)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
