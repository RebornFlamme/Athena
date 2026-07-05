import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { CarteLibre } from '../carte/CarteLibre'
import { PanneauEngins, type ModeEtiquette, type Phase } from './PanneauEngins'
import { ENGINS, INCIDENT, NB_PERSONNELS } from './donneesMock'
import { NB_VICTIMES } from './victimesMock'
import { creerCoucheEngins, type CoucheEngins, type EtatEngin } from './EnginsCustomLayer'
import { creerCoucheVictimes, type CoucheVictimes } from './VictimesCustomLayer'
import { calculerItineraire } from '../../data/itineraireIgn'
import { longueursCumulees, positionSurTrace } from '../../lib/trajetEngin'
import { poserZonesTactiques, TEINTES_ZONE, type ZoneTactique } from '../carte/zonesTactiques'

/**
 * Carte tactique + engagement des engins (réutilisable). Monte `CarteLibre`,
 * y greffe les couches engins / routes / victimes, et un panneau de contrôle.
 * « À l'appel », les engins partent de leur caserne (trajet IGN d'Oscar) en
 * vagues chronologiques, en pavés 3D avec leurs personnels ; les victimes sont
 * des cercles plans (triage). Sans dépendance backend (données mockées).
 *
 * Utilisé dans le panneau « Carte » du tableau de bord ET en pleine page (/coquille).
 * Le parent doit être positionné (`relative`) et dimensionné.
 */

const TRAVEL_MS = 6500 // durée de trajet d'un engin (caserne → poste)
const STAGGER_MS = 9000 // étalement des départs = chronologie réelle compressée
const CH_ENGINS = 'coquille-engins'
const SRC_ROUTES = 'coquille-routes'
const CH_ROUTES = 'coquille-routes-ligne'
const CH_VICTIMES = 'coquille-victimes'

// Zones tactiques (cercles au sol) centrées sur le sinistre. Démo : un périmètre
// de sécurité large et une zone d'engagement rapprochée.
const ZONES_TACTIQUES: ZoneTactique[] = [
  { id: 'securite', centre: INCIDENT, rayon: 120, couleur: TEINTES_ZONE.securite, libelle: 'Safety perimeter' },
  { id: 'engagement', centre: INCIDENT, rayon: 55, couleur: TEINTES_ZONE.tactique, libelle: 'Engagement zone' },
]

// Retard de départ par engin (chronologie du scénario compressée). Les engins
// restent à leur caserne jusqu'à leur instant de départ, puis roulent.
const MAX_RETARD = Math.max(...ENGINS.map((e) => e.retardS)) || 1
const DEPART_MS = new Map(ENGINS.map((e) => [e.id, (e.retardS / MAX_RETARD) * STAGGER_MS]))
const TOTAL_MS = STAGGER_MS + TRAVEL_MS

type Trace = { coords: [number, number][]; cumul: number[] }
const fcVide = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })

/** Exécute `fn` sur chaque item avec au plus `limite` en parallèle (l'API IGN
 *  renvoie des 429 si on tire les 12 itinéraires simultanément). */
async function avecLimite<T>(items: T[], limite: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker))
}

export function CarteEngagement() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [mode, setMode] = useState<ModeEtiquette>('live')
  const [victimes, setVictimes] = useState(true)

  const mapRef = useRef<maplibregl.Map | null>(null)
  const coucheRef = useRef<CoucheEngins | null>(null)
  const coucheVictimesRef = useRef<CoucheVictimes | null>(null)
  const tracesRef = useRef<Map<string, Trace>>(new Map())
  const labelsRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const rafRef = useRef(0)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const victimesRef = useRef(victimes)
  victimesRef.current = victimes

  // Attache les couches engins / routes / victimes quand la carte est prête.
  const onCarte = useCallback((m: maplibregl.Map) => {
    mapRef.current = m
    if (m.getLayer(CH_ENGINS)) return
    // Zones tactiques au sol (posées sous les libellés, avant routes/victimes/engins).
    poserZonesTactiques(m, ZONES_TACTIQUES)
    if (!m.getSource(SRC_ROUTES)) m.addSource(SRC_ROUTES, { type: 'geojson', data: fcVide() })
    if (!m.getLayer(CH_ROUTES)) {
      m.addLayer({
        id: CH_ROUTES,
        type: 'line',
        source: SRC_ROUTES,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#dc2626', 'line-width': 3, 'line-opacity': 0.5, 'line-dasharray': [2, 1.5] },
      })
    }
    // Victimes : disques 2D horizontaux bleus (couche Three.js), qui s'élèvent à
    // leur étage en vue inclinée (3D) → visibles dans les niveaux du bâtiment.
    if (!coucheVictimesRef.current) {
      const cv = creerCoucheVictimes(CH_VICTIMES)
      coucheVictimesRef.current = cv
      m.addLayer(cv)
      cv.setVisible(victimesRef.current)
    }
    const couche = creerCoucheEngins(CH_ENGINS)
    coucheRef.current = couche
    m.addLayer(couche)
  }, [])

  // Étiquettes DOM (modes « live » / « flottante »). Créées/retirées selon le mode.
  const majLabels = useCallback((etats: EtatEngin[]) => {
    const m = mapRef.current
    if (!m) return
    const labels = labelsRef.current
    const montrer = modeRef.current === 'live' || modeRef.current === 'flottante'
    for (const e of etats) {
      let mk = labels.get(e.id)
      if (!montrer) {
        if (mk) {
          mk.remove()
          labels.delete(e.id)
        }
        continue
      }
      if (!mk) {
        const el = document.createElement('div')
        el.style.pointerEvents = 'none'
        // inline-block + nowrap → l'étiquette se dimensionne au texte (sinon un
        // <div> de marqueur est en bloc et prend toute la largeur de l'écran).
        el.style.display = 'inline-block'
        el.style.whiteSpace = 'nowrap'
        mk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([e.lon, e.lat]).addTo(m)
        labels.set(e.id, mk)
      }
      const el = mk.getElement()
      el.textContent = e.nom
      el.className =
        modeRef.current === 'flottante'
          ? 'inline-block max-w-[170px] truncate rounded-full border bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow'
          : 'inline-block max-w-[170px] truncate rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow ring-1 ring-white/70'
      // Toujours au-dessus du véhicule (flottante plus haut que live).
      mk.setOffset(modeRef.current === 'flottante' ? [0, -34] : [0, -16])
      mk.setLngLat([e.lon, e.lat])
    }
  }, [])

  // État de tous les engins à l'instant `elapsed` (ms depuis le déclenchement) :
  // chaque engin a son propre retard de départ → progression individuelle.
  const etatA = useCallback((elapsed: number): EtatEngin[] => {
    const out: EtatEngin[] = []
    for (const e of ENGINS) {
      const tr = tracesRef.current.get(e.id)
      if (!tr) continue
      const depart = DEPART_MS.get(e.id) ?? 0
      const t = Math.max(0, Math.min(1, (elapsed - depart) / TRAVEL_MS))
      const { lonlat, cap } = positionSurTrace(tr.coords, tr.cumul, t)
      out.push({ id: e.id, type: e.type, lon: lonlat[0], lat: lonlat[1], cap, nom: e.nom, nbPerso: e.personnels.length, aerien: e.aerien })
    }
    return out
  }, [])

  const declencher = useCallback(async () => {
    const m = mapRef.current
    const couche = coucheRef.current
    if (!m || !couche || phase === 'chargement' || phase === 'roule') return
    setPhase('chargement')

    // Trajet routier IGN par engin (repli ligne droite si l'API échoue/limite).
    const traces = new Map<string, Trace>()
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = []
    await avecLimite(ENGINS, 3, async (e) => {
      let coords: [number, number][]
      if (e.aerien) {
        coords = [e.depart, e.arrivee] // vol direct (pas de route, pas de ligne au sol)
      } else {
        let ign: [number, number][] | undefined
        try {
          const it = await calculerItineraire(e.depart, e.arrivee)
          ign = it?.coords
        } catch {
          ign = undefined
        }
        // Départ = caserne, arrivée = POSTE exact. L'IGN snappe sur la chaussée →
        // sans forcer le poste, plusieurs engins finiraient au même point (overlap).
        coords = ign && ign.length >= 2 ? [e.depart, ...ign, e.arrivee] : [e.depart, e.arrivee]
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} })
      }
      traces.set(e.id, { coords, cumul: longueursCumulees(coords) })
    })
    tracesRef.current = traces
    ;(m.getSource(SRC_ROUTES) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })

    // Cadre la caméra sur toutes les positions (casernes + postes + sinistre).
    const b = new maplibregl.LngLatBounds(INCIDENT, INCIDENT)
    for (const tr of traces.values()) for (const c of tr.coords) b.extend(c)
    m.fitBounds(b, { padding: 90, pitch: 45, duration: 1200, essential: true })

    // Tous posés à la caserne, puis départs échelonnés (chronologie) → arrivée.
    couche.majEngins(etatA(0), { nomSurToit: modeRef.current === 'toit' })
    majLabels(etatA(0))
    setPhase('roule')
    const t0 = performance.now()
    const tick = () => {
      const elapsed = performance.now() - t0
      const etats = etatA(elapsed)
      couche.majEngins(etats, { nomSurToit: modeRef.current === 'toit' })
      majLabels(etats)
      if (elapsed < TOTAL_MS) rafRef.current = requestAnimationFrame(tick)
      else setPhase('arrive')
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [phase, etatA, majLabels])

  const reinitialiser = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    coucheRef.current?.majEngins([], { nomSurToit: false })
    labelsRef.current.forEach((mk) => mk.remove())
    labelsRef.current.clear()
    tracesRef.current.clear()
    const m = mapRef.current
    ;(m?.getSource(SRC_ROUTES) as maplibregl.GeoJSONSource | undefined)?.setData(fcVide())
    setPhase('idle')
  }, [])

  // Changement de mode d'étiquette une fois arrivé (ré-applique sans rejouer).
  useEffect(() => {
    if (phase !== 'arrive') return
    const couche = coucheRef.current
    if (!couche) return
    const etats = etatA(TOTAL_MS)
    couche.majEngins(etats, { nomSurToit: mode === 'toit' })
    majLabels(etats)
  }, [mode, phase, etatA, majLabels])

  // Affichage des victimes (toggle).
  useEffect(() => {
    coucheVictimesRef.current?.setVisible(victimes)
  }, [victimes])

  // Nettoyage au démontage.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      labelsRef.current.forEach((mk) => mk.remove())
      labelsRef.current.clear()
    },
    [],
  )

  return (
    <>
      <CarteLibre onCarte={onCarte} />
      <PanneauEngins
        phase={phase}
        mode={mode}
        onMode={setMode}
        onDeclencher={() => void declencher()}
        onReset={reinitialiser}
        nbEngins={ENGINS.length}
        nbPerso={NB_PERSONNELS}
        victimes={victimes}
        onVictimes={setVictimes}
        nbVictimes={NB_VICTIMES}
      />
    </>
  )
}
