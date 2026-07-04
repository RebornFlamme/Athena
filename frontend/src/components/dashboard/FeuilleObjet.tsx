import { Quote } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DATA_TYPES, type Attribute, type Entity } from '../../types'

const LABEL_TYPE = new Map(DATA_TYPES.map((t) => [t.value, t.label]))

// Échantillons réalistes en attendant la transcription (pipeline F3).
const EXTRAITS_POOL = [
  'Une dame âgée est encore dans l’appartement, elle n’arrive pas à sortir.',
  'C’est au 12 rue des Lilas, dans le 7e.',
  'Il y a de la fumée partout dans la cage d’escalier.',
  'Un conducteur est coincé, il saigne à la tête.',
  'Le feu est au troisième étage, la porte d’en face.',
]
const TEMPS = ['0:08', '0:19', '0:27', '0:41']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % 997
  return h
}

interface Extrait {
  texte: string
  enregistrement: string
  temps: string
}

function extraitsPour(objetId: string, enregistrements: string[]): Extrait[] {
  const base = hash(objetId)
  const n = enregistrements.length > 0 ? 2 : 0
  return Array.from({ length: n }).map((_, i) => ({
    texte: EXTRAITS_POOL[(base + i) % EXTRAITS_POOL.length],
    enregistrement: enregistrements[(base + i) % enregistrements.length],
    temps: TEMPS[(base + i) % TEMPS.length],
  }))
}

/**
 * Volet (Sheet à gauche) détaillant un objet : ses champs et les extraits des
 * enregistrements qui ont donné l'info. Les extraits sont illustratifs tant
 * que la transcription n'est pas branchée.
 */
export function FeuilleObjet({
  objet,
  champs,
  nomParEntite,
  enregistrements,
  onClose,
}: {
  objet: Entity | null
  champs: Attribute[]
  nomParEntite: Map<string, string>
  enregistrements: string[]
  onClose: () => void
}) {
  function libelleType(a: Attribute): string {
    const base = LABEL_TYPE.get(a.data_type) ?? a.data_type
    if ((a.data_type === 'reference' || a.data_type === 'object') && a.target_entity_id) {
      return `${base} → ${nomParEntite.get(a.target_entity_id) ?? '?'}`
    }
    return a.is_list ? `${base} []` : base
  }

  const extraits = objet ? extraitsPour(objet.id, enregistrements) : []

  return (
    <Sheet open={objet != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {objet && (
          <>
            <SheetHeader className="space-y-1 border-b p-6 pb-4 text-left">
              <SheetTitle className="flex items-center gap-2">
                {objet.color && (
                  <span className="h-3 w-3 rounded-full" style={{ background: objet.color }} />
                )}
                <span className="min-w-0 flex-1 truncate">{objet.name}</span>
                {objet.is_subobject && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-secondary-foreground">
                    sous-objet
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>Objet de la couche sémantique</SheetDescription>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 p-6">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Champs
                  </h3>
                  {champs.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">Aucun champ.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {champs.map((a) => (
                        <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-medium">
                            {a.name}
                            {a.required && <span className="text-destructive"> *</span>}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {libelleType(a)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Extraits des enregistrements
                  </h3>
                  {extraits.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      Aucun enregistrement. Les extraits sources apparaîtront ici une fois la
                      transcription branchée.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {extraits.map((e, i) => (
                        <li key={i} className="rounded-lg border p-3">
                          <div className="flex gap-2">
                            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <p className="text-sm italic leading-snug">{e.texte}</p>
                          </div>
                          <div className="mt-1.5 pl-5 text-[11px] text-muted-foreground">
                            {e.enregistrement} · {e.temps}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] italic text-muted-foreground">
                    Exemples — renseignés par la transcription (à venir).
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
