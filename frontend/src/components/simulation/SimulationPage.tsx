import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { isSupabaseConfigured } from '../../lib/supabase'
import * as appelsApi from '../../data/appelsApi'
import { supprimerAudio, televerserAudio } from '../../data/storageAudio'
import { lireDureeMs } from '../../sim/audioMeta'
import type { Appel } from '../../typesSimulation'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import { TimelineMontage } from './TimelineMontage'

function messageErreur(error: string): string {
  if (error.includes('Could not find the table') || error.includes('appels-audio') || error.includes('Bucket not found')) {
    return "Le stockage n'est pas prêt : applique la migration supabase/migrations/0003_simulation_appels.sql dans le SQL Editor de Supabase (crée la table + le bucket)."
  }
  return error
}

/**
 * Créateur de simulation : on glisse des MP3 (chaque MP3 = un appel). Cette
 * page les téléverse et les liste ; la timeline de montage (placement dans le
 * temps) et le contrôle de lecture arrivent aux étapes suivantes.
 */
export function SimulationPage() {
  const [appels, setAppels] = useState<Appel[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(0)
  const [survol, setSurvol] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const enLecture = useSimulationPlayback((s) => s.statut === 'lecture')
  const positionMs = useSimulationPlayback((s) => s.positionMs)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChargement(false)
      return
    }
    appelsApi
      .listAppels()
      .then(setAppels)
      .catch((err) => setErreur(messageErreur(String((err as { message?: string })?.message ?? err))))
      .finally(() => setChargement(false))
  }, [])

  async function ajouterFichiers(fichiers: FileList | null) {
    if (!fichiers || !isSupabaseConfigured) return
    const audios = Array.from(fichiers).filter((f) => f.type.startsWith('audio/') || f.name.toLowerCase().endsWith('.mp3'))
    if (audios.length === 0) return
    setErreur(null)
    setEnvoiEnCours((n) => n + audios.length)
    for (const file of audios) {
      try {
        const duree_ms = await lireDureeMs(file)
        const { url, path } = await televerserAudio(file)
        const appel = await appelsApi.insertAppel({
          titre: file.name.replace(/\.[^.]+$/, ''),
          audio_url: url,
          audio_path: path,
          duree_ms,
          ts_debut_ms: 0,
          piste: 0,
        })
        setAppels((prev) => [...prev, appel])
      } catch (err) {
        setErreur(messageErreur(String((err as { message?: string })?.message ?? err)))
      } finally {
        setEnvoiEnCours((n) => n - 1)
      }
    }
  }

  async function supprimer(appel: Appel) {
    setAppels((prev) => prev.filter((a) => a.id !== appel.id))
    try {
      await appelsApi.deleteAppel(appel.id)
      if (appel.audio_path) await supprimerAudio(appel.audio_path)
    } catch (err) {
      setErreur(messageErreur(String((err as { message?: string })?.message ?? err)))
    }
  }

  function deplacer(id: string, ts_debut_ms: number, piste: number) {
    setAppels((prev) => prev.map((a) => (a.id === id ? { ...a, ts_debut_ms, piste } : a)))
    appelsApi
      .updateAppel(id, { ts_debut_ms, piste })
      .catch((err) => setErreur(messageErreur(String((err as { message?: string })?.message ?? err))))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setSurvol(false)
    void ajouterFichiers(e.dataTransfer.files)
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">
          Simulation
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {appels.length} appel{appels.length > 1 ? 's' : ''}
          </span>
        </h1>
        <div className="flex-1" />
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3"
          multiple
          className="hidden"
          onChange={(e) => {
            void ajouterFichiers(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!isSupabaseConfigured}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> Ajouter un MP3
        </Button>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code> puis relance <code>npm run dev</code>.
        </div>
      )}
      {erreur && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{erreur}</div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setSurvol(true)
            }}
            onDragLeave={() => setSurvol(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              survol ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">Glissez des MP3 ici</div>
            <div className="text-xs text-muted-foreground">
              Chaque fichier devient un appel. Vous pourrez les placer dans le temps ensuite.
            </div>
          </div>

          {envoiEnCours > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Téléversement de {envoiEnCours} fichier
              {envoiEnCours > 1 ? 's' : ''}…
            </div>
          )}

          {chargement ? (
            <Skeleton className="h-40 w-full" />
          ) : appels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun appel. Glissez des MP3 ci-dessus pour composer la simulation.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Montage — glissez les appels pour fixer leur instant de déclenchement
              </div>
              <TimelineMontage
                appels={appels}
                onDeplacer={deplacer}
                onSupprimer={(a) => void supprimer(a)}
                positionMs={enLecture ? positionMs : null}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
