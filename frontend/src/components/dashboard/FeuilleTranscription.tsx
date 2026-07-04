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
import { useTranscription } from '../../hooks/useTranscription'
import type { SttStatut } from '../../lib/sttStream'
import type { Appel } from '../../typesSimulation'
import { VisualiseurVoix } from '../simulation/VisualiseurVoix'

const LIBELLE_STATUT: Record<SttStatut | 'inactif', string> = {
  inactif: '',
  connexion: 'Connexion au serveur STT…',
  actif: 'Transcription en direct',
  termine: 'Transcription terminée',
  erreur: 'Erreur',
}

function couleurStatut(statut: SttStatut | 'inactif'): string {
  switch (statut) {
    case 'actif':
      return 'bg-emerald-500'
    case 'connexion':
      return 'bg-amber-500'
    case 'erreur':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground/50'
  }
}

/**
 * Volet (Sheet à droite) ouvert au clic sur un appel du live feed. Reprend la
 * même carte audio (titre, minutage, histogramme de voix, toggle écoute) et
 * affiche la transcription qui arrive en direct depuis le backend Chirp 3 :
 * les segments `final` s'accumulent, la ligne `interim` (grisée) suit la parole.
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
  const { statut, detail, interim, finals, langue } = useTranscription(
    appel?.audio_url ?? null,
    appel != null,
  )

  // Auto-scroll vers le bas quand le transcript grandit.
  const bas = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    bas.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [finals, interim])

  const vide = finals.length === 0 && !interim

  return (
    <Sheet open={appel != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {appel && (
          <>
            <SheetHeader className="space-y-1 border-b p-6 pb-4 text-left">
              <SheetTitle className="min-w-0 truncate pr-6">{appel.titre}</SheetTitle>
              <SheetDescription>Transcription en direct — Chirp 3</SheetDescription>
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

            {/* Bandeau de statut STT + langue détectée */}
            <div className="flex items-center gap-2 border-b px-4 py-2 text-[11px] text-muted-foreground">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${couleurStatut(statut)} ${
                  statut === 'actif' || statut === 'connexion' ? 'animate-pulse' : ''
                }`}
              />
              <span className="min-w-0 flex-1 truncate">
                {statut === 'erreur' ? (detail ?? LIBELLE_STATUT.erreur) : LIBELLE_STATUT[statut]}
              </span>
              {langue && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] uppercase">
                  {langue}
                </Badge>
              )}
            </div>

            {/* Transcript live */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-4 text-sm leading-relaxed">
                {statut === 'erreur' ? (
                  <p className="italic text-muted-foreground">
                    {detail}. Vérifie que le backend STT tourne (
                    <code className="text-xs">poc-stt/</code>, port 8000) et la variable{' '}
                    <code className="text-xs">VITE_STT_WS_URL</code>.
                  </p>
                ) : vide ? (
                  <p className="italic text-muted-foreground">
                    {statut === 'connexion'
                      ? 'Connexion…'
                      : 'En attente de parole — le transcript apparaîtra ici.'}
                  </p>
                ) : (
                  <>
                    {finals.map((seg, i) => (
                      <span key={i} className="text-foreground">
                        {seg}{' '}
                      </span>
                    ))}
                    {interim && <span className="italic text-muted-foreground">{interim}</span>}
                  </>
                )}
                <div ref={bas} />
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
