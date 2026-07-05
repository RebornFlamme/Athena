import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Loader2, Play, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { isSupabaseConfigured } from '../../lib/supabase'
import * as appelsApi from '../../data/appelsApi'
import * as simulationsApi from '../../data/simulationsApi'
import { supprimerAudio, televerserAudio } from '../../data/storageAudio'
import { lireDureeMs } from '../../sim/audioMeta'
import type { Appel, Simulation } from '../../typesSimulation'
import { useSimulationPlayback } from '../../store/useSimulationPlayback'
import { useSimulationActive } from '../../store/useSimulationActive'
import { TimelineMontage } from './TimelineMontage'

function messageErreur(error: string): string {
  if (
    error.includes('Could not find the table') ||
    error.includes('appels-audio') ||
    error.includes('Bucket not found') ||
    error.includes('simulations') ||
    error.includes('simulation_id')
  ) {
    return 'Storage is not ready: apply migrations 0003 and 0010 in the Supabase SQL Editor (tables appels/simulations + the bucket).'
  }
  return error
}

/**
 * Créateur de simulation multi-simulations : on gère plusieurs simulations
 * nommées (chacune = une timeline d'appels). On édite celle choisie dans le
 * sélecteur, et un champ SÉPARÉ « Active » désigne celle jouée au Play global.
 */
export function SimulationPage() {
  const [sims, setSims] = useState<Simulation[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [appels, setAppels] = useState<Appel[]>([])
  const [chargement, setChargement] = useState(true)
  const [chargeAppels, setChargeAppels] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(0)
  const [survol, setSurvol] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileQueue, setFileQueue] = useState<File[]>([])
  const [meta, setMeta] = useState({ titre: '', operateur: '', localisation: '', caserne: '' })
  const [nomEdit, setNomEdit] = useState('')

  const activeId = useSimulationActive((s) => s.activeId)
  const setActive = useSimulationActive((s) => s.setActive)
  const enLecture = useSimulationPlayback((s) => s.statut === 'lecture')
  const positionMs = useSimulationPlayback((s) => s.positionMs)

  const simCourante = sims.find((s) => s.id === editId) ?? null

  // Chargement initial des simulations.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChargement(false)
      return
    }
    simulationsApi
      .listSimulations()
      .then((liste) => {
        setSims(liste)
        // Édite la sim active si elle existe, sinon la première.
        const initial = liste.find((s) => s.id === activeId)?.id ?? liste[0]?.id ?? null
        setEditId(initial)
      })
      .catch((err) => setErreur(messageErreur(String((err as { message?: string })?.message ?? err))))
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recharge les appels quand on change de simulation éditée.
  useEffect(() => {
    if (!editId) {
      setAppels([])
      return
    }
    setChargeAppels(true)
    appelsApi
      .listAppels(editId)
      .then(setAppels)
      .catch((err) => setErreur(messageErreur(String((err as { message?: string })?.message ?? err))))
      .finally(() => setChargeAppels(false))
  }, [editId])

  // Synchronise le champ de renommage avec la sim courante.
  useEffect(() => {
    setNomEdit(simCourante?.nom ?? '')
  }, [simCourante?.id, simCourante?.nom])

  // Pré-remplit le titre de l'appel avec le nom du fichier en tête de file.
  useEffect(() => {
    if (fileQueue.length > 0) {
      setMeta((m) => ({ ...m, titre: fileQueue[0].name.replace(/\.[^.]+$/, '') }))
    }
  }, [fileQueue])

  async function nouvelleSimulation() {
    setErreur(null)
    try {
      const sim = await simulationsApi.insertSimulation(`Simulation ${sims.length + 1}`)
      setSims((prev) => [...prev, sim])
      setEditId(sim.id)
      setAppels([])
      // Première simulation → la rendre active d'office (sinon Play n'a rien à jouer).
      if (!activeId) setActive(sim.id)
    } catch (err) {
      setErreur(messageErreur(String((err as { message?: string })?.message ?? err)))
    }
  }

  function renommer() {
    if (!simCourante) return
    const nom = nomEdit.trim()
    if (!nom || nom === simCourante.nom) {
      setNomEdit(simCourante.nom)
      return
    }
    setSims((prev) => prev.map((s) => (s.id === simCourante.id ? { ...s, nom } : s)))
    simulationsApi
      .renameSimulation(simCourante.id, nom)
      .catch((err) => setErreur(messageErreur(String((err as { message?: string })?.message ?? err))))
  }

  async function supprimerSimulation() {
    if (!simCourante) return
    const cible = simCourante.id
    const reste = sims.filter((s) => s.id !== cible)
    setSims(reste)
    setEditId(reste[0]?.id ?? null)
    if (activeId === cible) setActive(reste[0]?.id ?? null)
    try {
      await simulationsApi.deleteSimulation(cible)
    } catch (err) {
      setErreur(messageErreur(String((err as { message?: string })?.message ?? err)))
    }
  }

  function ajouterFichiers(fichiers: FileList | null) {
    if (!fichiers || !isSupabaseConfigured || !editId) return
    const audios = Array.from(fichiers).filter(
      (f) => f.type.startsWith('audio/') || f.name.toLowerCase().endsWith('.mp3'),
    )
    if (audios.length === 0) return
    setErreur(null)
    setFileQueue((prev) => [...prev, ...audios])
  }

  async function confirmerAppel() {
    const file = fileQueue[0]
    if (!file || !editId) return
    setEnvoiEnCours((n) => n + 1)
    try {
      const duree_ms = await lireDureeMs(file)
      const { url, path } = await televerserAudio(file)
      const appel = await appelsApi.insertAppel({
        simulation_id: editId,
        titre: meta.titre.trim() || file.name.replace(/\.[^.]+$/, ''),
        audio_url: url,
        audio_path: path,
        duree_ms,
        ts_debut_ms: 0,
        piste: 0,
        operateur: meta.operateur.trim() || null,
        localisation: meta.localisation.trim() || null,
        caserne: meta.caserne.trim() || null,
      })
      setAppels((prev) => [...prev, appel])
    } catch (err) {
      setErreur(messageErreur(String((err as { message?: string })?.message ?? err)))
    } finally {
      setEnvoiEnCours((n) => n - 1)
      setFileQueue((prev) => prev.slice(1))
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

  const nomSimActive = sims.find((s) => s.id === activeId)?.nom

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">
          Simulations
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {sims.length} simulation{sims.length === 1 ? '' : 's'}
          </span>
        </h1>
        <div className="flex-1" />
        {/* Champ SÉPARÉ : la simulation active (jouée au Play global). */}
        <div className="flex items-center gap-1.5">
          <Play className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Active:</span>
          <Select
            value={activeId ?? undefined}
            onValueChange={(v) => setActive(v)}
            disabled={sims.length === 0}
          >
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {sims.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase is not configured: copy <code>frontend/.env.example</code> to{' '}
          <code>.env.local</code> then restart <code>npm run dev</code>.
        </div>
      )}
      {erreur && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{erreur}</div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
          {/* Barre d'édition : quelle simulation on édite + créer / renommer / supprimer. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Editing</span>
            <Select
              value={editId ?? undefined}
              onValueChange={setEditId}
              disabled={sims.length === 0}
            >
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="No simulation" />
              </SelectTrigger>
              <SelectContent>
                {sims.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nom}
                    {s.id === activeId ? ' · active' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {simCourante && (
              <>
                <Input
                  value={nomEdit}
                  onChange={(e) => setNomEdit(e.target.value)}
                  onBlur={renommer}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="h-9 w-44"
                  placeholder="Simulation name"
                />
                {activeId !== simCourante.id && (
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setActive(simCourante.id)}>
                    <Play className="h-3.5 w-3.5" /> Set active
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => void supprimerSimulation()}
                  title="Delete this simulation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}

            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!isSupabaseConfigured}
              onClick={() => void nouvelleSimulation()}
            >
              <Plus className="h-4 w-4" /> New simulation
            </Button>
          </div>

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

          {chargement ? (
            <Skeleton className="h-40 w-full" />
          ) : sims.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-10 text-center">
              <div className="text-sm font-medium">No simulation yet</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Create a simulation, then drag MP3 files into its timeline.
              </div>
              <Button className="mt-4 gap-1.5" onClick={() => void nouvelleSimulation()} disabled={!isSupabaseConfigured}>
                <Plus className="h-4 w-4" /> New simulation
              </Button>
            </div>
          ) : !editId ? (
            <p className="text-sm text-muted-foreground">Select a simulation to edit.</p>
          ) : (
            <>
              {activeId === editId ? (
                <div className="rounded-md bg-primary/5 px-3 py-1.5 text-xs text-primary">
                  This simulation is active — it plays when you press ▶.
                </div>
              ) : (
                <div className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                  Active simulation: <span className="font-medium">{nomSimActive ?? 'none'}</span> — this
                  one plays on ▶. You are editing “{simCourante?.nom}”.
                </div>
              )}

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
                <div className="text-sm font-medium">Drop MP3 files here</div>
                <div className="text-xs text-muted-foreground">
                  Each file becomes a call in “{simCourante?.nom}”. You can place them in time afterwards.
                </div>
              </div>

              {envoiEnCours > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading {envoiEnCours} file
                  {envoiEnCours > 1 ? 's' : ''}…
                </div>
              )}

              {chargeAppels ? (
                <Skeleton className="h-40 w-full" />
              ) : appels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No calls in this simulation. Drop MP3 files above to compose it.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Timeline — drag the calls to set their trigger time
                  </div>
                  <TimelineMontage
                    appels={appels}
                    onDeplacer={deplacer}
                    onSupprimer={(a) => void supprimer(a)}
                    positionMs={enLecture && activeId === editId ? positionMs : null}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={fileQueue.length > 0} onOpenChange={(o) => !o && setFileQueue([])}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New call</DialogTitle>
            <DialogDescription className="truncate">
              {fileQueue[0]?.name}
              {fileQueue.length > 1 ? ` · +${fileQueue.length - 1} pending` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="titre">Title</Label>
              <Input
                id="titre"
                value={meta.titre}
                onChange={(e) => setMeta((m) => ({ ...m, titre: e.target.value }))}
                placeholder="Apartment fire — rue des Lilas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="operateur">Operator on the line</Label>
              <Input
                id="operateur"
                value={meta.operateur}
                onChange={(e) => setMeta((m) => ({ ...m, operateur: e.target.value }))}
                placeholder="Sgt. Marie Lefèvre"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="localisation">Call location</Label>
              <Input
                id="localisation"
                value={meta.localisation}
                onChange={(e) => setMeta((m) => ({ ...m, localisation: e.target.value }))}
                placeholder="12 rue des Lilas, Lyon 7e"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caserne">Receiving station</Label>
              <Input
                id="caserne"
                value={meta.caserne}
                onChange={(e) => setMeta((m) => ({ ...m, caserne: e.target.value }))}
                placeholder="CS Lyon-Corneille"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFileQueue([])}>
              Cancel
            </Button>
            <Button onClick={() => void confirmerAppel()} disabled={envoiEnCours > 0}>
              {envoiEnCours > 0 ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
