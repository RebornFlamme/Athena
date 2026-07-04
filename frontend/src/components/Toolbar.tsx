import { useReactFlow } from '@xyflow/react'
import { useSchemaStore } from '../store/useSchemaStore'

export function Toolbar() {
  const addEntity = useSchemaStore((s) => s.addEntity)
  const status = useSchemaStore((s) => s.status)
  const count = useSchemaStore((s) => s.entities.length)
  const { screenToFlowPosition } = useReactFlow()

  async function handleAdd() {
    // Place le nouvel objet au centre approximatif de la vue.
    const pos = screenToFlowPosition({
      x: window.innerWidth / 2 - 110,
      y: window.innerHeight / 2 - 60,
    })
    await addEntity({ x: pos.x, y: pos.y })
  }

  const statusLabel =
    status === 'ready'
      ? 'Synchronisé'
      : status === 'loading'
        ? 'Chargement…'
        : status === 'error'
          ? 'Erreur de connexion'
          : 'Inactif'

  return (
    <header className="toolbar">
      <div className="toolbar__title">
        Athena — Schéma EAV<span>{count} objet{count > 1 ? 's' : ''}</span>
      </div>
      <div className="toolbar__spacer" />
      <span className={`status-dot ${status === 'ready' ? 'ready' : status === 'error' ? 'error' : ''}`}>
        {statusLabel}
      </span>
      <button className="primary" onClick={handleAdd}>
        ＋ Nouvel objet
      </button>
    </header>
  )
}
