import { useEffect, useRef, useState } from 'react'
import { LiveAudioVisualizer } from 'react-audio-visualize'
import { getStream } from '../../store/useSimulationPlayback'
import { VisualiseurVoix } from './VisualiseurVoix'

/**
 * Visualiseur du Live feed basé sur `react-audio-visualize` (LiveAudioVisualizer).
 * Il attend un `MediaRecorder` : on en crée un à partir du MediaStream muet de
 * l'appel (exposé par le moteur de lecture), tant que ce flux est affiché
 * (monté = appel actif → borne le nombre d'AudioContext créés par le package).
 * Repli sur l'ancien histogramme `VisualiseurVoix` si MediaRecorder indisponible.
 */
export function VisualiseurAudioLive({ appelId }: { appelId: string }) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(0)
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const [nonSupporte, setNonSupporte] = useState(false)
  const [couleur, setCouleur] = useState('#e4e4e7')

  // Couleur des barres = --primary du thème shadcn (triplet HSL → hsl(...)).
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    if (v) setCouleur(v.startsWith('hsl') || v.startsWith('#') ? v : `hsl(${v})`)
  }, [])

  // Largeur responsive du canvas (le composant exige des px).
  useEffect(() => {
    const el = conteneur.current
    if (!el) return
    setLargeur(el.clientWidth)
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // MediaRecorder tant que le flux est monté (= appel actif dans le feed).
  useEffect(() => {
    const stream = getStream(appelId)
    if (!stream) return
    let rec: MediaRecorder | null = null
    try {
      rec = new MediaRecorder(stream)
      rec.start()
    } catch {
      setNonSupporte(true)
      return
    }
    setRecorder(rec)
    return () => {
      try {
        if (rec && rec.state !== 'inactive') rec.stop()
      } catch {
        /* déjà stoppé */
      }
      setRecorder(null)
    }
  }, [appelId])

  if (nonSupporte) return <VisualiseurVoix appelId={appelId} actif />

  return (
    <div ref={conteneur} className="h-6 w-full overflow-hidden">
      {recorder && largeur > 0 && (
        <LiveAudioVisualizer
          mediaRecorder={recorder}
          width={largeur}
          height={24}
          barWidth={2}
          gap={1}
          barColor={couleur}
          backgroundColor="transparent"
        />
      )}
    </div>
  )
}
