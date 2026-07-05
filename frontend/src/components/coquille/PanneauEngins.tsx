import { Boxes, HeartPulse, Play, RotateCcw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type ModeEtiquette = 'toit' | 'live' | 'flottante' | 'aucune'
export type Phase = 'idle' | 'chargement' | 'roule' | 'arrive'

const MODES: { key: ModeEtiquette; label: string; aide: string }[] = [
  { key: 'toit', label: 'Nom sur le toit', aide: 'Le nom est posé en 3D au-dessus du toit du pavé (reste lisible).' },
  { key: 'live', label: 'Pointage live', aide: 'Une étiquette qui suit l’engin en direct, au-dessus, face à l’écran.' },
  { key: 'flottante', label: 'Étiquette flottante', aide: 'Une pastille qui flotte plus haut au-dessus de l’engin.' },
  { key: 'aucune', label: 'Aucune', aide: 'Pavés seuls, sans nom.' },
]

/** Panneau de contrôle de la coquille (à droite de la carte). */
export function PanneauEngins({
  phase,
  mode,
  onMode,
  onDeclencher,
  onReset,
  nbEngins,
  nbPerso,
  victimes,
  onVictimes,
  nbVictimes,
}: {
  phase: Phase
  mode: ModeEtiquette
  onMode: (m: ModeEtiquette) => void
  onDeclencher: () => void
  onReset: () => void
  nbEngins: number
  nbPerso: number
  victimes: boolean
  onVictimes: (v: boolean) => void
  nbVictimes: number
}) {
  const enCours = phase === 'chargement' || phase === 'roule'
  const aideMode = MODES.find((m) => m.key === mode)?.aide

  return (
    <Card className="absolute right-3 top-3 w-72 space-y-3 p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Engagement des engins</span>
        <span className="text-[11px] text-muted-foreground">
          {phase === 'idle' && 'en attente'}
          {phase === 'chargement' && 'calcul des trajets…'}
          {phase === 'roule' && 'en route'}
          {phase === 'arrive' && 'sur les lieux'}
        </span>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Boxes className="size-3.5" /> {nbEngins} engins
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" /> {nbPerso} personnels
        </span>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-1.5" onClick={onDeclencher} disabled={enCours}>
          <Play className="size-4" />
          {phase === 'arrive' ? 'Rejouer' : "Déclencher l'appel"}
        </Button>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={onReset} disabled={phase === 'idle'}>
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <div className="space-y-1.5 border-t pt-2">
        <span className="text-xs font-medium">Affichage des noms</span>
        <div className="grid grid-cols-2 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onMode(m.key)}
              aria-pressed={mode === m.key}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                mode === m.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-foreground hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {aideMode && <p className="text-[11px] leading-snug text-muted-foreground">{aideMode}</p>}
      </div>

      <div className="space-y-1.5 border-t pt-2">
        <label className="flex cursor-pointer items-center justify-between text-xs font-medium">
          <span className="inline-flex items-center gap-1.5">
            <HeartPulse className="size-3.5" /> Victimes ({nbVictimes})
          </span>
          <input
            type="checkbox"
            checked={victimes}
            onChange={(e) => onVictimes(e.target.checked)}
            className="size-4 cursor-pointer"
          />
        </label>
        {victimes && (
          <p className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-blue-500 ring-1 ring-white" />
            Disques bleus à plat — ils s'élèvent à leur étage en vue 3D.
          </p>
        )}
      </div>
    </Card>
  )
}
