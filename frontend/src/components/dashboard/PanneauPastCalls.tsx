import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listAppels } from '../../data/appelsApi'
import { formaterMs } from '../../sim/audioMeta'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import type { Appel } from '../../typesSimulation'

type StatutAppel = 'a_venir' | 'en_direct' | 'termine'

const LIBELLE: Record<StatutAppel, string> = {
  a_venir: 'à venir',
  en_direct: 'en direct',
  termine: 'terminé',
}

/**
 * « Past calls » : tous les appels de la simulation avec leur statut — en cours
 * (en direct), terminés (passés) ou à venir. Chronologique par instant de
 * déclenchement.
 */
export function PanneauPastCalls() {
  const [appels, setAppels] = useState<Appel[]>([])
  const statut = useSimulationPlayback((s) => s.statut)
  const positionMs = useSimulationPlayback((s) => s.positionMs)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    listAppels()
      .then(setAppels)
      .catch(() => {})
  }, [])

  function statutDe(a: Appel): StatutAppel {
    if (statut !== 'lecture' || positionMs < a.ts_debut_ms) return 'a_venir'
    if (positionMs < a.ts_debut_ms + Math.max(a.duree_ms, 800)) return 'en_direct'
    return 'termine'
  }

  // Pas d'appels « à venir » ici : seulement ceux en cours ou passés.
  const visibles = [...appels]
    .filter((a) => statutDe(a) !== 'a_venir')
    .sort((x, y) => x.ts_debut_ms - y.ts_debut_ms)

  return (
    <aside className="flex h-full flex-col bg-card">
      {visibles.length === 0 ? (
        <p className="p-4 text-sm italic leading-relaxed text-muted-foreground">
          Aucun appel en cours ou passé. Lancez la démonstration.
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {visibles.map((a) => {
            const s = statutDe(a)
            return (
              <div key={a.id} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.titre}</div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">
                    déclenché à {formaterMs(a.ts_debut_ms)} · durée {formaterMs(a.duree_ms)}
                  </div>
                </div>
                {s === 'en_direct' ? (
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 gap-1 border-emerald-500/50 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {LIBELLE[s]}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className={`h-5 shrink-0 px-1.5 text-[10px] font-normal ${
                      s === 'termine' ? 'text-muted-foreground' : ''
                    }`}
                  >
                    {LIBELLE[s]}
                  </Badge>
                )}
              </div>
            )
          })}
        </ScrollArea>
      )}
    </aside>
  )
}
