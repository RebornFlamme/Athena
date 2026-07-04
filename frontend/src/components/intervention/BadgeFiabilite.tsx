import { STATUTS, type StatutInfo } from '../../typesAthena'

/**
 * Badge d'état d'une information : ambre « présumé », vert « confirmé »…
 * Affiché partout où une info métier apparaît (règle projet : l'IA propose,
 * l'humain valide — l'état doit se lire d'un coup d'œil).
 */
export function BadgeFiabilite({
  statut,
  fiabilite,
}: {
  statut: StatutInfo
  fiabilite?: string
}) {
  const s = STATUTS[statut] ?? STATUTS.presume
  return (
    <span
      className="badge-statut"
      style={{ color: s.couleur, borderColor: s.couleur, background: `${s.couleur}1f` }}
      title={fiabilite ? `Statut : ${s.libelle} · Fiabilité ${fiabilite} (Admiralty)` : `Statut : ${s.libelle}`}
    >
      {s.libelle}
      {fiabilite ? ` · ${fiabilite}` : ''}
    </span>
  )
}
