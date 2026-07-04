import { useEffect, useRef, useState } from 'react'
import {
  Handle,
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from '@xyflow/react'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
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

const DEFAULT_WIDTH = 288
const MIN_WIDTH = 240
const MAX_WIDTH = 560
const MIN_HEIGHT = 96
const MAX_HEIGHT = 800

// API de réordonnancement passée du node à chaque ligne (poignée + ref + état).
interface ReorderApi {
  register: (id: string, el: HTMLDivElement | null) => void
  onGripDown: (id: string, e: React.PointerEvent) => void
  onGripMove: (e: React.PointerEvent) => void
  onGripUp: (e: React.PointerEvent) => void
  draggingId: string | null
}

// ---------------------------------------------------------------------------
// Ligne d'un champ : poignée de réordre + nom + type (TOUS les types) + toggle
// liste + suppr. Un champ-relation expose un Handle pile en face de sa ligne.
// Tout élément interactif porte `nodrag` (sinon le drag déplace la carte).
// ---------------------------------------------------------------------------
function FieldRow({ attr, reorder }: { attr: Attribute; reorder: ReorderApi }) {
  const editAttribute = useSchemaStore((s) => s.editAttribute)
  const removeAttribute = useSchemaStore((s) => s.removeAttribute)

  const [name, setName] = useState(attr.name)
  useEffect(() => setName(attr.name), [attr.name])
  const [enumText, setEnumText] = useState((attr.enum_values ?? []).join(', '))
  useEffect(() => setEnumText((attr.enum_values ?? []).join(', ')), [attr.enum_values])

  const isRelation = RELATION_TYPES.includes(attr.data_type)
  const dragging = reorder.draggingId === attr.id

  return (
    <div
      ref={(el) => reorder.register(attr.id, el)}
      className={`space-y-1 rounded ${dragging ? 'opacity-60 ring-1 ring-primary' : ''}`}
    >
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          title="Glisser pour réordonner"
          className="nodrag flex h-7 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
          onPointerDown={(e) => reorder.onGripDown(attr.id, e)}
          onPointerMove={reorder.onGripMove}
          onPointerUp={reorder.onGripUp}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
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
          className="nodrag ml-5 h-7 text-xs"
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
  const saveEntity = useSchemaStore((s) => s.saveEntity)
  const removeEntity = useSchemaStore((s) => s.removeEntity)
  const addAttribute = useSchemaStore((s) => s.addAttribute)
  const reorderAttributes = useSchemaStore((s) => s.reorderAttributes)
  const setEntitySizeLocal = useSchemaStore((s) => s.setEntitySizeLocal)

  const updateNodeInternals = useUpdateNodeInternals()

  // --- Réordonnancement des champs (pointer pur) -----------------------------
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const dragIdRef = useRef<string | null>(null)
  const orderRef = useRef<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)

  const applyOrder = (next: string[] | null) => {
    orderRef.current = next
    setDragOrder(next)
  }

  const baseIds = attributes.map((a) => a.id)
  const orderedAttrs = dragOrder
    ? (dragOrder.map((oid) => attributes.find((a) => a.id === oid)).filter(Boolean) as Attribute[])
    : attributes

  const reorder: ReorderApi = {
    register: (rid, el) => {
      if (el) rowRefs.current.set(rid, el)
      else rowRefs.current.delete(rid)
    },
    onGripDown: (rid, e) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      dragIdRef.current = rid
      setDraggingId(rid)
      applyOrder(baseIds)
    },
    onGripMove: (e) => {
      const dragId = dragIdRef.current
      if (!dragId) return
      const cur = orderRef.current ?? baseIds
      // Ligne survolée = première dont le pointeur est au-dessus du bas.
      let targetId = cur[cur.length - 1] ?? null
      for (const rid of cur) {
        const r = rowRefs.current.get(rid)?.getBoundingClientRect()
        if (r && e.clientY < r.bottom) {
          targetId = rid
          break
        }
      }
      if (!targetId || targetId === dragId) return
      const rt = rowRefs.current.get(targetId)?.getBoundingClientRect()
      const after = rt ? e.clientY > rt.top + rt.height / 2 : false
      const without = cur.filter((x) => x !== dragId)
      let idx = without.indexOf(targetId)
      if (after) idx += 1
      without.splice(idx, 0, dragId)
      if (without.join('|') !== cur.join('|')) applyOrder(without)
    },
    onGripUp: () => {
      const dragId = dragIdRef.current
      const finalOrder = orderRef.current
      dragIdRef.current = null
      setDraggingId(null)
      applyOrder(null)
      if (dragId && finalOrder) reorderAttributes(id, finalOrder)
    },
    draggingId,
  }

  // --- Redimensionnement largeur + hauteur (pointer pur, poignées invisibles) -
  // Largeur = fixe (style.width). Hauteur = min-height (le contenu reste toujours
  // visible : agrandir ajoute de l'espace, on ne rogne jamais). Le delta écran est
  // divisé par le zoom pour rester en coordonnées « flow ».
  const rf = useReactFlow()
  const resizeRef = useRef<
    { x: number; y: number; w: number; h: number; zoom: number; axis: 'x' | 'y' | 'xy' } | null
  >(null)
  const liveRef = useRef<{ w: number | null; h: number | null }>({ w: null, h: null })
  const [liveWidth, setLiveWidth] = useState<number | null>(null)
  const [liveHeight, setLiveHeight] = useState<number | null>(null)

  const width = liveWidth ?? entity?.width ?? DEFAULT_WIDTH
  const height = liveHeight ?? entity?.height ?? null

  const setLive = (w: number | null, h: number | null) => {
    liveRef.current = { w, h }
    setLiveWidth(w)
    setLiveHeight(h)
  }
  const startResize = (axis: 'x' | 'y' | 'xy') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const zoom = rf.getZoom() || 1
    const rect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect()
    const startH = rect ? rect.height / zoom : height ?? MIN_HEIGHT
    resizeRef.current = { x: e.clientX, y: e.clientY, w: width, h: startH, zoom, axis }
    setLive(width, startH)
  }
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r) return
    const w =
      r.axis === 'y'
        ? r.w
        : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, r.w + (e.clientX - r.x) / r.zoom))
    const h =
      r.axis === 'x'
        ? r.h
        : Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, r.h + (e.clientY - r.y) / r.zoom))
    setLive(w, h)
  }
  const onResizeUp = () => {
    const r = resizeRef.current
    const { w, h } = liveRef.current
    resizeRef.current = null
    if (r) {
      setEntitySizeLocal(
        id,
        r.axis === 'y' ? undefined : w != null ? Math.round(w) : undefined,
        r.axis === 'x' ? undefined : h != null ? Math.round(h) : undefined,
      )
    }
    setLive(null, null)
  }

  // React Flow doit re-mesurer les handles quand la mise en page change : ordre
  // des champs, type (enum/relation → hauteur), largeur (x des handles) ou
  // hauteur (y du handle cible centré).
  const layoutSig =
    orderedAttrs.map((a) => `${a.id}:${a.data_type}`).join('|') +
    `|w${Math.round(width)}|h${Math.round(height ?? 0)}`
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, layoutSig, updateNodeInternals])

  const [name, setName] = useState('')
  useEffect(() => setName(entity?.name ?? ''), [entity?.id, entity?.name])

  if (!entity) return null

  return (
    <Card
      className="relative gap-0 py-0 shadow-lg"
      style={{ width, minHeight: height ?? undefined }}
    >
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
            if (!v) return setName(entity.name)
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
                retirés du schéma. La suppression devient définitive après « Écraser Supabase ».
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
        {orderedAttrs.map((a) => (
          <FieldRow key={a.id} attr={a} reorder={reorder} />
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

      {/* Poignées de redimensionnement invisibles : bord droit (largeur), bord
          bas (hauteur), coin bas-droit (les deux). Aucune chrome visible. */}
      <div
        title="Redimensionner (largeur)"
        className="nodrag absolute top-0 z-10 h-full w-1.5 cursor-ew-resize touch-none"
        style={{ right: -3 }}
        onPointerDown={startResize('x')}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      />
      <div
        title="Redimensionner (hauteur)"
        className="nodrag absolute left-0 z-10 h-1.5 w-full cursor-ns-resize touch-none"
        style={{ bottom: -3 }}
        onPointerDown={startResize('y')}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      />
      <div
        title="Redimensionner"
        className="nodrag absolute z-10 h-3.5 w-3.5 cursor-nwse-resize touch-none"
        style={{ right: -3, bottom: -3 }}
        onPointerDown={startResize('xy')}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      />
    </Card>
  )
}
