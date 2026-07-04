import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isSupabaseConfigured } from '../../lib/supabase'
import * as api from '../../data/interventionApi'
import type { Intervention } from '../../typesAthena'

/**
 * Liste des interventions + création rapide — la porte d'entrée du dashboard
 * (permet d'obtenir une intervention sans passer par le SQL Editor).
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
      .catch((err) => setErreur(String(err?.message ?? err)))
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
      navigate(`/intervention/${intervention.id}`)
    } catch (err) {
      setErreur(String((err as { message?: string })?.message ?? err))
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar__title">
          Athena <span>dashboard de crise</span>
        </div>
        <div className="toolbar__spacer" />
        <Link to="/">
          <button>Éditeur de schémas</button>
        </Link>
      </header>

      {!isSupabaseConfigured && (
        <div className="banner">
          Supabase n'est pas configuré : copie <code>frontend/.env.example</code> en{' '}
          <code>.env.local</code>, renseigne <code>VITE_SUPABASE_URL</code> et{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, puis relance <code>npm run dev</code>.
        </div>
      )}
      {erreur && <div className="banner">Erreur Supabase : {erreur}</div>}

      <div className="page-scroll">
        <div className="liste-interventions">
          <h2>Interventions</h2>

          <form className="form-card form-nouvelle-intervention" onSubmit={creer}>
            <div className="champ">
              <label htmlFor="titre">Titre</label>
              <input
                id="titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Feu d'appartement — 12 rue des Lilas"
                disabled={!isSupabaseConfigured}
              />
            </div>
            <div className="champ">
              <label htmlFor="adresse">Adresse (optionnelle)</label>
              <input
                id="adresse"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="12 rue des Lilas, Lyon"
                disabled={!isSupabaseConfigured}
              />
            </div>
            <button className="primary" type="submit" disabled={!isSupabaseConfigured || !titre.trim()}>
              ＋ Nouvelle intervention
            </button>
          </form>

          {chargement && <p className="hint">Chargement…</p>}
          {!chargement && interventions.length === 0 && isSupabaseConfigured && (
            <p className="hint">Aucune intervention. Crée la première ci-dessus.</p>
          )}

          <div className="cartes-interventions">
            {interventions.map((it) => (
              <Link key={it.id} to={`/intervention/${it.id}`} className="carte-intervention">
                <div className="carte-intervention__titre">{it.titre}</div>
                <div className="carte-intervention__meta">
                  {it.adresse && <span>{it.adresse} · </span>}
                  {new Date(it.cree_le).toLocaleString('fr-FR')}
                </div>
                <span className={`pastille-statut ${it.statut}`}>
                  {it.statut === 'active' ? 'En cours' : 'Terminée'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
