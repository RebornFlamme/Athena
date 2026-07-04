import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useInterventionStore } from '../../store/useInterventionStore'
import { useRealtimeIntervention } from '../../hooks/useRealtimeIntervention'
import { CarteIntervention } from './CarteIntervention'
import { MainCourante } from './MainCourante'

/**
 * LE dashboard de crise : carte plein écran + main courante à droite,
 * tout se met à jour en direct via Supabase Realtime.
 */
export function InterventionPage() {
  const { id } = useParams<{ id: string }>()
  const load = useInterventionStore((s) => s.load)
  const clear = useInterventionStore((s) => s.clear)
  const intervention = useInterventionStore((s) => s.intervention)
  const entites = useInterventionStore((s) => s.entites)
  const status = useInterventionStore((s) => s.status)
  const error = useInterventionStore((s) => s.error)

  useEffect(() => {
    if (isSupabaseConfigured && id) void load(id)
    return () => clear()
  }, [id, load, clear])

  useRealtimeIntervention(id)

  return (
    <div className="app">
      <header className="toolbar">
        <Link to="/interventions" className="lien-retour">
          ← Interventions
        </Link>
        <div className="toolbar__title">
          {intervention?.titre ?? 'Intervention'}
          {intervention?.adresse && <span>{intervention.adresse}</span>}
        </div>
        <div className="toolbar__spacer" />
        {intervention && (
          <span className={`pastille-statut ${intervention.statut}`}>
            {intervention.statut === 'active' ? 'En cours' : 'Terminée'}
          </span>
        )}
        <span className={`status-dot ${status === 'ready' ? 'ready' : status === 'error' ? 'error' : ''}`}>
          {status === 'ready' ? 'temps réel' : status === 'loading' ? 'chargement…' : status}
        </span>
      </header>

      {!isSupabaseConfigured && (
        <div className="banner">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code>, renseigne <code>VITE_SUPABASE_URL</code> et{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, puis relance <code>npm run dev</code>.
        </div>
      )}
      {isSupabaseConfigured && error && <div className="banner">Erreur Supabase : {error}</div>}

      <div className="app__body">
        <div className="carte-wrap">
          <CarteIntervention
            entites={entites}
            centre={intervention ? { lon: intervention.lon, lat: intervention.lat } : null}
          />
        </div>
        <MainCourante />
      </div>
    </div>
  )
}
