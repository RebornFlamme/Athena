import { useEffect, useMemo, useState } from 'react'
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
import { isSupabaseConfigured } from '../../lib/supabase'
import { listAppels } from '../../data/appelsApi'
import { loadSchema } from '../../data/schemaApi'
import { DATA_TYPES, type Attribute, type Entity } from '../../types'
import { FeuilleObjet } from './FeuilleObjet'

const LABEL_TYPE = new Map(DATA_TYPES.map((t) => [t.value, t.label]))

/**
 * Panneau bas de la colonne carte : les objets de la couche sémantique (entités
 * EAV). Filtre par menu déroulant à cocher → badges des objets affichés. Cards
 * alignées sur une ligne scrollable horizontalement ; clic → volet de détail.
 */
export function PanneauObjets() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [enregistrements, setEnregistrements] = useState<string[]>([])
  const [selection, setSelection] = useState<string[]>([])
  const [objetOuvert, setObjetOuvert] = useState<Entity | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    loadSchema()
      .then(({ entities, attributes }) => {
        setEntities(entities)
        setAttributes(attributes)
        setSelection(entities.map((e) => e.id))
      })
      .catch(() => {})
    listAppels()
      .then((appels) => setEnregistrements(appels.map((a) => a.titre)))
      .catch(() => {})
  }, [])

  const attrsParEntite = useMemo(() => {
    const m = new Map<string, Attribute[]>()
    for (const a of attributes) {
      const list = m.get(a.entity_id) ?? []
      list.push(a)
      m.set(a.entity_id, list)
    }
    return m
  }, [attributes])

  const nomParEntite = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities],
  )

  function libelleType(a: Attribute): string {
    const base = LABEL_TYPE.get(a.data_type) ?? a.data_type
    if ((a.data_type === 'reference' || a.data_type === 'object') && a.target_entity_id) {
      return `${base} → ${nomParEntite.get(a.target_entity_id) ?? '?'}`
    }
    return a.is_list ? `${base} []` : base
  }

  function basculer(id: string, coche: boolean) {
    setSelection((prev) => (coche ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))
  }

  const objetsVisibles = entities.filter((e) => selection.includes(e.id))

  return (
    <aside className="flex h-full flex-col bg-card">
      {entities.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          Aucun objet. Définissez des objets dans l'éditeur de schéma.
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
                <DropdownMenuLabel>Objets à afficher</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {entities.map((e) => (
                  <DropdownMenuCheckboxItem
                    key={e.id}
                    checked={selection.includes(e.id)}
                    onCheckedChange={(c) => basculer(e.id, c)}
                    onSelect={(ev) => ev.preventDefault()}
                  >
                    <span className="flex items-center gap-2">
                      {e.color && (
                        <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
                      )}
                      {e.name}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {objetsVisibles.map((e) => (
              <Badge key={e.id} variant="secondary" className="gap-1 pr-1 font-normal">
                {e.color && (
                  <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
                )}
                {e.name}
                <button
                  onClick={() => basculer(e.id, false)}
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
              {objetsVisibles.map((e) => {
                const champs = attrsParEntite.get(e.id) ?? []
                return (
                  <Card
                    key={e.id}
                    onClick={() => setObjetOuvert(e)}
                    className="w-56 shrink-0 cursor-pointer transition-colors hover:border-primary/50"
                  >
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {e.color && (
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                        )}
                        <span className="min-w-0 flex-1 truncate">{e.name}</span>
                        {e.is_subobject && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                            sous-objet
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {champs.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground">Aucun champ.</p>
                      ) : (
                        <ul className="space-y-1">
                          {champs.map((a) => (
                            <li key={a.id} className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="min-w-0 truncate font-medium">
                                {a.name}
                                {a.required && <span className="text-destructive"> *</span>}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {libelleType(a)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </>
      )}

      <FeuilleObjet
        objet={objetOuvert}
        champs={objetOuvert ? (attrsParEntite.get(objetOuvert.id) ?? []) : []}
        nomParEntite={nomParEntite}
        enregistrements={enregistrements}
        onClose={() => setObjetOuvert(null)}
      />
    </aside>
  )
}
