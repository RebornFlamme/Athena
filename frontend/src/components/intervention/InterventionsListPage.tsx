import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { isSupabaseConfigured } from '../../lib/supabase'
import * as api from '../../data/interventionApi'
import type { Intervention } from '../../typesAthena'

function messageErreur(error: string): string {
  if (error.includes('Could not find the table')) {
    return "Les tables Athena n'existent pas encore : applique la migration supabase/migrations/0002_athena_core.sql dans le SQL Editor de Supabase."
  }
  return error
}

/**
 * Tableau de bord : liste des interventions + création rapide —
 * la porte d'entrée du dashboard de crise.
 */
export function InterventionsListPage() {
  const navigate = useNavigate()
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [titre, setTitre] = useState('')
  const [adresse, setAdresse] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    setChargement(true)
    api
      .listInterventions()
      .then(setInterventions)
      .catch((err) => setErreur(String((err as { message?: string })?.message ?? err)))
      .finally(() => setChargement(false))
  }, [])

  async function creer(e: FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    try {
      const intervention = await api.insertIntervention({
        titre: titre.trim(),
        adresse: adresse.trim() || null,
      })
      navigate(`/tableau-de-bord/${intervention.id}`)
    } catch (err) {
      setErreur(String((err as { message?: string })?.message ?? err))
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <h1 className="text-sm font-semibold">
          Tableau de bord
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {interventions.length} intervention{interventions.length > 1 ? 's' : ''}
          </span>
        </h1>
      </header>

      {!isSupabaseConfigured && (
        <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code> puis relance <code>npm run dev</code>.
        </div>
      )}
      {erreur && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {messageErreur(erreur)}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nouvelle intervention</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-wrap items-end gap-3" onSubmit={creer}>
                <div className="min-w-48 flex-1 space-y-1.5">
                  <Label htmlFor="titre">Titre</Label>
                  <Input
                    id="titre"
                    value={titre}
                    onChange={(e) => setTitre(e.target.value)}
                    placeholder="Feu d'appartement — 12 rue des Lilas"
                    disabled={!isSupabaseConfigured}
                  />
                </div>
                <div className="min-w-48 flex-1 space-y-1.5">
                  <Label htmlFor="adresse">Adresse (optionnelle)</Label>
                  <Input
                    id="adresse"
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    placeholder="12 rue des Lilas, Lyon"
                    disabled={!isSupabaseConfigured}
                  />
                </div>
                <Button type="submit" className="gap-1" disabled={!isSupabaseConfigured || !titre.trim()}>
                  <Plus className="h-4 w-4" /> Créer
                </Button>
              </form>
            </CardContent>
          </Card>

          {chargement && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!chargement && isSupabaseConfigured && interventions.length === 0 && !erreur && (
            <p className="text-sm text-muted-foreground">
              Aucune intervention. Crée la première ci-dessus.
            </p>
          )}

          <div className="space-y-2">
            {interventions.map((it) => (
              <Link key={it.id} to={`/tableau-de-bord/${it.id}`} className="block">
                <Card className="relative transition-colors hover:border-primary/50">
                  <CardContent className="p-4">
                    <div className="pr-20 font-medium">{it.titre}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {it.adresse && <>{it.adresse} · </>}
                      {new Date(it.cree_le).toLocaleString('fr-FR')}
                    </div>
                    <Badge
                      variant="outline"
                      className={`absolute right-4 top-4 ${
                        it.statut === 'active'
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {it.statut === 'active' ? 'En cours' : 'Terminée'}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
