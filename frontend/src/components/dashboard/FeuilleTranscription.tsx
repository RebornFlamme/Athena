import { useEffect, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formaterMs } from '../../sim/audioMeta'
import { useTranscriptionDB } from '../../hooks/useTranscriptionDB'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import type { Appel } from '../../typesSimulation'
import { VisualiseurVoix } from '../simulation/VisualiseurVoix'
import { EnteteAppel, SectionRaisonnement } from './AppelDetails'

/**
 * Volet (Sheet à droite) ouvert au clic sur un appel. **Pur lecteur** de la base :
 * il affiche les segments de `transcriptions` (produits par le job serveur au
 * lancement de la simulation) et se met à jour en direct via Supabase Realtime.
 * Aucune STT ici — la transcription est un job serveur.
 */
export function FeuilleTranscription({
  appel,
  actif,
  ecoute,
  onToggleEcoute,
  onClose,
}: {
  appel: Appel | null
  /** L'appel est-il en cours de diffusion (histogramme piloté par l'analyser). */
  actif: boolean
  ecoute: boolean
  onToggleEcoute: () => void
  onClose: () => void
}) {
  const segments = useTranscriptionDB(appel?.id ?? null)
  const enLecture = useSimulationPlayback((s) => s.statut === 'lecture')

  // Auto-scroll vers le bas quand des segments arrivent.
  const bas = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [segments])

  const langue = segments.find((s) => s.langue)?.langue ?? ''
  const vide = segments.length === 0

  return (
    <Sheet open={appel != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {appel && (
          <>
            <SheetHeader className="space-y-1 border-b p-6 pb-4 text-left">
              <SheetTitle className="min-w-0 truncate pr-6">{appel.titre}</SheetTitle>
              <SheetDescription>Transcription — Chirp 3 (via Supabase)</SheetDescription>
            </SheetHeader>

            {/* La même carte audio que dans le live feed */}
            <div className="flex items-center gap-3 border-b bg-primary/5 px-4 py-3">
              <button
                type="button"
                onClick={onToggleEcoute}
                title={ecoute ? 'Écoute activée — couper' : 'Écouter ce flux'}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                  ecoute
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {ecoute ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{appel.titre}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {formaterMs(appel.ts_debut_ms)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <VisualiseurVoix appelId={appel.id} actif={actif} />
                </div>
              </div>
            </div>

            {/* Opérateur + localisation / caserne */}
            <div className="border-b px-4 py-3">
              <EnteteAppel appel={appel} />
            </div>

            {/* Bandeau : état live + langue détectée */}
            <div className="flex items-center gap-2 border-b px-4 py-2 text-[11px] text-muted-foreground">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  enLecture ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground/50'
                }`}
              />
              <span className="min-w-0 flex-1 truncate">
                {enLecture
                  ? `Transcription en direct · ${segments.length} segment${segments.length > 1 ? 's' : ''}`
                  : vide
                    ? 'Aucune transcription — lancez la simulation'
                    : `${segments.length} segment${segments.length > 1 ? 's' : ''} enregistré${segments.length > 1 ? 's' : ''}`}
              </span>
              {langue && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase">
                  {langue}
                </Badge>
              )}
            </div>

            {/* Transcript (lecture Realtime de la base) */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1 p-4 text-sm leading-relaxed">
                {vide ? (
                  <p className="italic text-muted-foreground">
                    {enLecture
                      ? 'Transcription en cours… les segments apparaîtront ici.'
                      : 'Lancez la simulation pour générer la transcription.'}
                  </p>
                ) : (
                  segments.map((seg) => (
                    <span key={seg.id} className="text-foreground">
                      {seg.texte}{' '}
                    </span>
                  ))
                )}
                <div ref={bas} />
              </div>
            </ScrollArea>

            {/* Raisonnement LLM (journal d'extraction en direct) */}
            <div className="shrink-0 border-t p-4">
              <SectionRaisonnement appelId={appel.id} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
