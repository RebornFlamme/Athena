import { useEffect, useRef } from 'react'
import { getAnalyseur } from '../../store/useSimulationPlayback'

const N_BARRES = 18

/**
 * Petit histogramme animé qui montre l'activité vocale d'un flux en direct.
 * Piloté par l'AnalyserNode FFT de l'appel (Web Audio) tant qu'il est actif ;
 * à défaut d'analyser, se rabat sur une animation synthétique.
 */
export function VisualiseurVoix({ appelId, actif }: { appelId: string; actif: boolean }) {
  const barres = useRef<(HTMLSpanElement | null)[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    if (!actif) {
      barres.current.forEach((el) => el && (el.style.height = '10%'))
      return
    }
    const analyser = getAnalyseur(appelId)
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    let fauxT = 0

    const tick = () => {
      if (analyser && data) {
        analyser.getByteFrequencyData(data)
        for (let i = 0; i < N_BARRES; i++) {
          const idx = Math.min(data.length - 1, Math.floor((i * data.length) / N_BARRES))
          const v = data[idx] / 255
          const el = barres.current[i]
          if (el) el.style.height = `${10 + Math.round(v * 90)}%`
        }
      } else {
        // Repli : animation synthétique (pas d'analyser disponible).
        fauxT += 0.05
        for (let i = 0; i < N_BARRES; i++) {
          const v = Math.abs(Math.sin(fauxT * 3 + i * 0.6) * Math.sin(fauxT * 1.7 + i))
          const el = barres.current[i]
          if (el) el.style.height = `${10 + Math.round(v * 70)}%`
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [actif, appelId])

  return (
    <div className="flex h-6 items-end gap-px">
      {Array.from({ length: N_BARRES }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barres.current[i] = el
          }}
          className={`flex-1 rounded-sm transition-[height] duration-75 ${
            actif ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
          style={{ height: '10%' }}
        />
      ))}
    </div>
  )
}
