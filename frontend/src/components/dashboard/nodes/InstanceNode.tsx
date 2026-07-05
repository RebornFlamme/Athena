import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { STATUTS } from '../../../typesAthena'
import type { ObjectInstance } from '../../../data/instancesApi'

function valeurLisible(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/**
 * Nœud React Flow d'une instance d'objet (lecture seule, style glassmorphism).
 * Détecte les champs modifiés en direct (compare au rendu précédent) → surligne
 * les lignes changées et pulse le nœud brièvement. Apparaît en fondu au montage.
 */
function InstanceNodeBase({ data }: NodeProps) {
  const instance = (data as { instance: ObjectInstance }).instance
  const s = STATUTS[instance.statut] ?? STATUTS.presume
  const champs = Object.entries(instance.fields ?? {})

  const precedent = useRef<Record<string, unknown>>(instance.fields ?? {})
  const [modifies, setModifies] = useState<Set<string>>(new Set())
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const avant = precedent.current
    const apres = instance.fields ?? {}
    const changes = new Set<string>()
    for (const k of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
      if (JSON.stringify(avant[k]) !== JSON.stringify(apres[k])) changes.add(k)
    }
    precedent.current = apres
    if (changes.size === 0) return
    setModifies(changes)
    setPulse(true)
    const t = setTimeout(() => {
      setModifies(new Set())
      setPulse(false)
    }, 1600)
    return () => clearTimeout(t)
  }, [instance.fields, instance.maj_le])

  return (
    <div
      className={`w-60 animate-in fade-in-50 zoom-in-95 rounded-xl border bg-white/75 shadow-lg backdrop-blur-md transition-all duration-300 ${
        pulse ? 'border-primary ring-2 ring-primary/60' : 'border-white/60'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-2 !w-2 !border-2 !border-white !bg-slate-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2 !w-2 !border-2 !border-white !bg-slate-400"
      />

      <div className="border-b border-black/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: s.couleur }}
            title={s.libelle}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {instance.libelle}
          </span>
        </div>
        <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
          {instance.type_name}
        </Badge>
      </div>

      <div className="px-3 py-2">
        {champs.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Aucun champ.</p>
        ) : (
          <ul className="space-y-0.5">
            {champs.map(([k, v]) => (
              <li
                key={k}
                className={`flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-xs transition-colors duration-500 ${
                  modifies.has(k) ? 'bg-amber-200/80' : ''
                }`}
              >
                <span className="min-w-0 shrink-0 font-medium text-slate-700">{k}</span>
                <span className="min-w-0 truncate text-right text-[11px] text-muted-foreground">
                  {valeurLisible(v)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export const InstanceNode = memo(InstanceNodeBase)
