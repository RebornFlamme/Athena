import { useEffect, useState } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { Plus, Trash2, X } from 'lucide-react'
import { useSchemaStore } from '../../store/useSchemaStore'
import { DATA_TYPES, RELATION_TYPES, type Attribute, type DataType } from '../../types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ---------------------------------------------------------------------------
// Ligne d'un champ : nom + sélecteur de type (TOUS les types, dont « objet ») +
// toggle liste + suppr. Quand le type cible un autre objet (reference/object),
// un Handle apparaît PILE en face de la ligne : on le tire vers une autre carte
// pour poser la cible sur CE champ (aucun menu de sélection de cible).
// Édition inline persistée sur événement discret (blur / change), jamais à
// chaque frappe → pas de conflit avec l'écho Realtime.
// ---------------------------------------------------------------------------
function FieldRow({ attr, targetName }: { attr: Attribute; targetName?: string }) {
  const editAttribute = useSchemaStore((s) => s.editAttribute)
  const removeAttribute = useSchemaStore((s) => s.removeAttribute)

  const [name, setName] = useState(attr.name)
  useEffect(() => setName(attr.name), [attr.name])
  const [enumText, setEnumText] = useState((attr.enum_values ?? []).join(', '))
  useEffect(() => setEnumText((attr.enum_values ?? []).join(', ')), [attr.enum_values])

  const isRelation = RELATION_TYPES.includes(attr.data_type)

  return (
    <div className="space-y-1">
      <div className="relative flex items-center gap-1">
        <Input
          className="nodrag h-7 flex-1 text-xs"
          value={name}
          placeholder="nom"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim()
            if (!v) return setName(attr.name) // vidé → on restaure la valeur courante
            if (v !== attr.name) editAttribute(attr.id, { name: v })
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <Select
          value={attr.data_type}
          onValueChange={(v) => {
            const dt = v as DataType
            const rel = RELATION_TYPES.includes(dt)
            editAttribute(attr.id, {
              data_type: dt,
              enum_values: dt === 'enum' ? attr.enum_values ?? [] : null,
              // sort d'un type-relation → on oublie la cible.
              target_entity_id: rel ? attr.target_entity_id : null,
            })
          }}
        >
          <SelectTrigger className="nodrag h-7 w-[124px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={attr.is_list ? 'secondary' : 'ghost'}
          size="icon"
          title="Liste"
          className="nodrag h-7 w-7 shrink-0 font-mono text-[11px]"
          onClick={() => editAttribute(attr.id, { is_list: !attr.is_list })}
        >
          []
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Supprimer le champ"
          className="nodrag h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeAttribute(attr.id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        {isRelation && (
          <Handle
            type="source"
            position={Position.Right}
            id={`f-${attr.id}`}
            className="!h-3 !w-3 !border-2 !border-background !bg-primary"
            style={{ right: -13, top: '50%', transform: 'translateY(-50%)' }}
          />
        )}
      </div>
      {attr.data_type === 'enum' && (
        <Input
          className="nodrag h-7 text-xs"
          placeholder="valeurs : vert, jaune, rouge…"
          value={enumText}
          onChange={(e) => setEnumText(e.target.value)}
          onBlur={() =>
            editAttribute(attr.id, {
              enum_values: enumText.split(',').map((v) => v.trim()).filter(Boolean),
            })
          }
        />
      )}
      {isRelation && (
        <div className="px-1 text-[10px] text-muted-foreground truncate">
          {attr.target_entity_id ? `→ ${targetName ?? '?'}` : 'tirer le point → vers un objet'}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Node = carte d'un objet. Toute l'édition se fait ici (aucun panneau latéral).
// ---------------------------------------------------------------------------
export function EntityNode({ id }: NodeProps) {
  const entity = useSchemaStore((s) => s.entities.find((e) => e.id === id))
  const attributes = useSchemaStore((s) =>
    s.attributes.filter((a) => a.entity_id === id).sort((a, b) => a.ordinal - b.ordinal),
  )
  const entities = useSchemaStore((s) => s.entities)
  const saveEntity = useSchemaStore((s) => s.saveEntity)
  const removeEntity = useSchemaStore((s) => s.removeEntity)
  const addAttribute = useSchemaStore((s) => s.addAttribute)

  // React Flow doit re-mesurer les handles quand les lignes changent (ajout /
  // suppression / passage en objet ou enum → hauteur des cartes et donc Y des
  // handles de champ). Signature volontairement limitée à ce qui bouge la mise
  // en page (le nom, lui, ne change pas la hauteur).
  const updateNodeInternals = useUpdateNodeInternals()
  const layoutSig = attributes.map((a) => `${a.id}:${a.data_type}`).join('|')
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, layoutSig, updateNodeInternals])

  const [name, setName] = useState('')
  useEffect(() => setName(entity?.name ?? ''), [entity?.id, entity?.name])

  if (!entity) return null

  const nameOf = (eid: string) => entities.find((e) => e.id === eid)?.name ?? '?'

  return (
    <Card className="w-72 gap-0 py-0 shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        id="t"
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />

      <CardHeader className="flex flex-row items-center gap-1 space-y-0 p-2">
        <Input
          className="nodrag h-7 flex-1 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:border-input"
          value={name}
          placeholder="Nom de l'objet"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim()
            if (!v) return setName(entity.name) // vidé → on restaure
            if (v !== entity.name) saveEntity(entity.id, { name: v })
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {entity.is_subobject && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            sous-objet
          </Badge>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Supprimer l'objet"
              className="nodrag h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer « {entity.name} » ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cet objet et ses {attributes.length} champ{attributes.length > 1 ? 's' : ''} seront
                retirés du schéma. La suppression devient définitive après « Enregistrer ».
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => removeEntity(entity.id)}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      <CardContent className="space-y-1.5 border-t p-2">
        {attributes.map((a) => (
          <FieldRow
            key={a.id}
            attr={a}
            targetName={a.target_entity_id ? nameOf(a.target_entity_id) : undefined}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="nodrag h-7 w-full justify-center gap-1 text-xs"
          onClick={() => addAttribute(entity.id, { name: 'champ', data_type: 'string' })}
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un champ
        </Button>
      </CardContent>
    </Card>
  )
}
