import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Clock, Phone, Play, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { isSupabaseConfigured } from '../../lib/supabase'
import * as interventionApi from '../../data/interventionApi'
import { chargerScenarios } from '../../data/scenariosApi'
import type { AppelUploade, Scenario } from '../../typesFlux'
import { SimulationView } from './SimulationView'

function messageErreur(error: string): string {
  if (error.includes('Could not find the table')) {
    return "Les tables Athena n'existent pas encore : applique la migration supabase/migrations/0002_athena_core.sql dans le SQL Editor de Supabase."
  }
  return error
}

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Onglet Flux : la liste des appels (scénarios préenregistrés + uploads) et le
 * point d'entrée de la simulation de démo (voir plan_base_webapp.md).
 */
export function FluxPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [uploads, setUploads] = useState<AppelUploade[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [sim, setSim] = useState<{ scenario: Scenario; interventionId: string } | null>(null)
  const [lancement, setLancement] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const compteurRef = useRef(0)

  useEffect(() => {
    chargerScenarios()
      .then(setScenarios)
      .catch((err) => setErreur(String((err as { message?: string })?.message ?? err)))
      .finally(() => setChargement(false))
  }, [])

  async function lancerSimulation(scenario: Scenario) {
    setErreur(null)
    setLancement(scenario.id)
    try {
      const intervention = await interventionApi.insertIntervention({
        titre: scenario.titre,
        adresse: scenario.adresse_intervention,
      })
      setSim({ scenario, interventionId: intervention.id })
    } catch (err) {
      setErreur(messageErreur(String((err as { message?: string })?.message ?? err)))
    } finally {
      setLancement(null)
    }
  }

  if (sim) {
    return (
      <SimulationView
        scenario={sim.scenario}
        interventionId={sim.interventionId}
        onQuitter={() => setSim(null)}
      />
    )
  }

  function onFichiers(e: ChangeEvent<HTMLInputElement>) {
    const fichiers = e.target.files
    if (!fichiers) return
    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const nouveaux: AppelUploade[] = Array.from(fichiers).map((f) => ({
      id: `upload-${compteurRef.current++}`,
      titre: f.name,
      heure_debut: heure,
      taille_octets: f.size,
      url: URL.createObjectURL(f),
    }))
    setUploads((prev) => [...nouveaux, ...prev])
    e.target.value = '' // permet de re-sélectionner le même fichier
  }

  const total = scenarios.length + uploads.length

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">
          Flux
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {total} appel{total > 1 ? 's' : ''}
          </span>
        </h1>
        <div className="flex-1" />
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={onFichiers}
        />
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Ajouter un appel
        </Button>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code> puis relance <code>npm run dev</code> pour lancer une simulation.
        </div>
      )}
      {erreur && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{erreur}</div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scénarios de démonstration
            </h2>
            {chargement ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : scenarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun scénario disponible.</p>
            ) : (
              <div className="space-y-2">
                {scenarios.map((s) => (
                  <Card key={s.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{s.titre}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <Clock className="h-3 w-3" /> {s.heure_debut}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {s.transcript.length} répliques · {s.duree_s}s · {s.adresse_intervention}
                      </span>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={!isSupabaseConfigured || lancement !== null}
                        onClick={() => void lancerSimulation(s)}
                        title={
                          isSupabaseConfigured ? undefined : 'Configure Supabase (.env.local) pour lancer la démo'
                        }
                      >
                        <Play className="h-4 w-4" />
                        {lancement === s.id ? 'Lancement…' : 'Lancer la simulation'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {uploads.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Appels importés
              </h2>
              <div className="space-y-2">
                {uploads.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{u.titre}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.heure_debut} · {formaterTaille(u.taille_octets)}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">
                        Transcription à venir
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
