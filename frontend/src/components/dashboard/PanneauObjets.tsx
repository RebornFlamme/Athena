import { useEffect, useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { isSupabaseConfigured } from '../../lib/supabase'
import { loadSchema } from '../../data/schemaApi'
import { DATA_TYPES, type Attribute, type Entity } from '../../types'

const LABEL_TYPE = new Map(DATA_TYPES.map((t) => [t.value, t.label]))

/**
 * Panneau bas de la colonne carte : parcourir les objets de la couche
 * sémantique (entités EAV) sous forme de cards avec leurs champs. Un filtre
 * shadcn (ToggleGroup) en haut sélectionne les objets à afficher.
 */
export function PanneauObjets() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [selection, setSelection] = useState<string[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    loadSchema()
      .then(({ entities, attributes }) => {
        setEntities(entities)
        setAttributes(attributes)
        setSelection(entities.map((e) => e.id))
      })
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

  const objetsVisibles = entities.filter((e) => selection.includes(e.id))

  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Boxes className="h-3.5 w-3.5" /> Objets
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {objetsVisibles.length}/{entities.length}
        </Badge>
      </div>

      {entities.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          Aucun objet. Définissez des objets dans l'éditeur de schéma.
        </p>
      ) : (
        <>
          <div className="shrink-0 border-b p-2">
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={selection}
              onValueChange={setSelection}
              className="flex-wrap justify-start gap-1"
            >
              {entities.map((e) => (
                <ToggleGroupItem key={e.id} value={e.id} className="h-7 gap-1.5 px-2 text-xs">
                  {e.color && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: e.color }}
                    />
                  )}
                  {e.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-2 p-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {objetsVisibles.map((e) => {
                const champs = attrsParEntite.get(e.id) ?? []
                return (
                  <Card key={e.id}>
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
          </ScrollArea>
        </>
      )}
    </aside>
  )
}
