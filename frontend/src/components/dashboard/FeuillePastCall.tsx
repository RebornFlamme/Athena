import { Boxes, Phone } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formaterMs } from '../../sim/audioMeta'
import { useTranscriptionDB } from '../../hooks/useTranscriptionDB'
import type { Appel } from '../../typesSimulation'
import { EnteteAppel, SectionRaisonnement } from './AppelDetails'

// Objets créés — placeholder illustratif tant que la pipeline d'extraction
// (transcription → LLM → entités) n'est pas branchée.
const OBJETS_POOL = ['Fire', 'Victim #1', 'Victim #2', 'Resource — VSAV 12', 'Safety perimeter']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % 997
  return h
}

/**
 * Volet de détail d'un appel (Sheet à droite) : sa transcription complète (lue
 * depuis Supabase via le job serveur du teammate) et les objets qu'il a créés.
 */
export function FeuillePastCall({ appel, onClose }: { appel: Appel | null; onClose: () => void }) {
  const segments = useTranscriptionDB(appel?.id ?? null)
  const objets = appel ? OBJETS_POOL.slice(0, 1 + (hash(appel.id) % 3)) : []
  const vide = segments.length === 0

  return (
    <Sheet open={appel != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {appel && (
          <>
            <SheetHeader className="space-y-1 border-b p-6 pb-4 text-left">
              <SheetTitle className="flex items-center gap-2 pr-6">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{appel.titre}</span>
              </SheetTitle>
              <SheetDescription>
                triggered at {formaterMs(appel.ts_debut_ms)} · duration {formaterMs(appel.duree_ms)}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 p-6">
                <EnteteAppel appel={appel} />
                <Separator />

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Transcript
                  </h3>
                  {vide ? (
                    <p className="text-sm italic text-muted-foreground">
                      No transcript for this call. Start the simulation to generate it.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed">
                      {segments.map((seg) => (
                        <span key={seg.id}>{seg.texte} </span>
                      ))}
                    </p>
                  )}
                </section>

                <SectionRaisonnement appelId={appel.id} />

                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Boxes className="h-3.5 w-3.5" /> Objects created
                  </h3>
                  {objets.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">No objects.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {objets.map((o) => (
                        <Badge key={o} variant="secondary" className="font-normal">
                          {o}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] italic text-muted-foreground">
                    Samples — populated by the extraction pipeline (coming soon).
                  </p>
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
