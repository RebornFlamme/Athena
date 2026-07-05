import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { CarteLibre } from '../carte/CarteLibre'
import { STATUTS, type StatutInfo } from '../../typesAthena'
import { useInstancesDB } from '../../hooks/useInstancesDB'
import { useTrajetsEngins } from '../../hooks/useTrajetsEngins'
import type { ObjectInstance } from '../../data/instancesApi'
import { creerCoucheEngins, type CoucheEngins, type EtatEngin, type TypeEngin } from './EnginsCustomLayer'
import { creerCoucheVictimes, type CoucheVictimes, type VictimeEtat } from './VictimesCustomLayer'

/**
 * Carte tactique branchée au RÉEL. Reprend la belle carte 3D `CarteLibre` et y
 * greffe EN DIRECT les objets produits par les agents pendant la simulation, en
 * les rendant avec les ARTEFACTS 3D du collègue selon leur type :
 *   • type « victime » → dôme bleu (couche `VictimesCustomLayer`) ;
 *   • type « engin / véhicule … » → pavé rouge 3D (couche `EnginsCustomLayer`) ;
 *   • tout le reste → marqueur coloré par statut.
 * Plus les trajets d'engins réels (`useTrajetsEngins`) + caméra qui plonge sur le
 * premier objet géolocalisé. Les couches 3D sont ancrées sur ce premier objet
 * (repère ENU local).
 *
 * Utilisée dans le panneau « Map » du tableau de bord ET en pleine page (/coquille).
 */

const CH_ENGINS = 'instances-engins'
const CH_VICTIMES = 'instances-victimes'

/** Catégorie d'artefact déduite du `type_name` de l'instance. */
type Categorie = 'engin' | 'victime' | 'autre'
function categorie(typeName: string): Categorie {
  const t = typeName.toLowerCase()
  if (/victim|bless|impliqu/.test(t)) return 'victime'
  if (/engin|v[ée]hic|vehicle|appliance|truck|camion|pompe|[ée]chelle|ambulance|fpt|epa|bea|vsav|vlr/.test(t)) {
    return 'engin'
  }
  return 'autre'
}

/** Sous-type d'engin (dimensions du pavé) déduit du libellé/type. */
function typeEnginDe(o: ObjectInstance): TypeEngin {
  const s = `${o.type_name} ${o.libelle}`.toLowerCase()
  if (s.includes('epa') || s.includes('échelle') || s.includes('echelle')) return 'EPA'
  if (s.includes('bea') || s.includes('bras')) return 'BEA'
  if (s.includes('vsav') || s.includes('ambulance') || s.includes('secours')) return 'VSAV'
  if (s.includes('vlr') || s.includes('léger') || s.includes('leger')) return 'VLR'
  if (s.includes(' ba') || s.includes('logistique')) return 'BA'
  return 'FPT'
}

function nombreChamp(fields: Record<string, unknown>, ...cles: string[]): number {
  for (const c of cles) {
    const n = Number(fields?.[c])
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function versEngin(o: ObjectInstance): EtatEngin {
  return {
    id: o.id,
    type: typeEnginDe(o),
    lon: o.lon!,
    lat: o.lat!,
    cap: 0,
    nom: o.libelle,
    nbPerso: nombreChamp(o.fields ?? {}, 'effectif', 'personnels', 'crew', 'nombre'),
    aerien: false,
  }
}

function versVictime(o: ObjectInstance): VictimeEtat {
  return {
    id: o.id,
    pos: [o.lon!, o.lat!],
    persons: nombreChamp(o.fields ?? {}, 'nombre', 'persons', 'effectif', 'victimes') || 1,
    etage: nombreChamp(o.fields ?? {}, 'etage', 'floor', 'niveau'),
  }
}

interface Geoloc {
  id: string
  libelle: string
  statut: StatutInfo
}

function appliquerStyleMarqueur(el: HTMLElement, o: Geoloc) {
  const s = STATUTS[o.statut] ?? STATUTS.presume
  el.style.background = s.couleur
  el.title = `${o.libelle} — ${s.libelle}`
}

function creerElementMarqueur(o: Geoloc): HTMLDivElement {
  const el = document.createElement('div')
  el.className =
    'h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]'
  appliquerStyleMarqueur(el, o)
  return el
}

export function CarteEngagement() {
  const objets: ObjectInstance[] = useInstancesDB()
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const marqueursRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const enginsRef = useRef<CoucheEngins | null>(null)
  const victimesRef = useRef<CoucheVictimes | null>(null)
  const origineRef = useRef<[number, number] | null>(null)
  const dejaCentreRef = useRef(false)

  // Trajets d'engins réels (caserne la plus proche → interventions géolocalisées).
  useTrajetsEngins(map)

  // Nouvelle carte (remount) → repart de zéro (l'ancienne carte + ses couches ont
  // été détruites avec elle). Déclaré AVANT l'effet de rendu → s'exécute d'abord.
  useEffect(() => {
    marqueursRef.current = new Map()
    enginsRef.current = null
    victimesRef.current = null
    origineRef.current = null
    dejaCentreRef.current = false
  }, [map])

  // Rend les objets géolocalisés : pavés (engins) / dômes (victimes) / marqueurs.
  useEffect(() => {
    if (!map) return
    const geoloc = objets.filter((o) => o.lon != null && o.lat != null)

    // Ancre les couches 3D sur le 1er objet géolocalisé (repère ENU local), une fois.
    if (!origineRef.current && geoloc.length > 0) {
      const o = geoloc[0]
      const origine: [number, number] = [o.lon!, o.lat!]
      origineRef.current = origine
      const ce = creerCoucheEngins(CH_ENGINS, origine)
      const cv = creerCoucheVictimes(CH_VICTIMES, origine)
      if (!map.getLayer(CH_ENGINS)) map.addLayer(ce)
      if (!map.getLayer(CH_VICTIMES)) map.addLayer(cv)
      enginsRef.current = ce
      victimesRef.current = cv
    }

    // Catégorise et alimente chaque couche.
    const engins: EtatEngin[] = []
    const victimes: VictimeEtat[] = []
    const autres: ObjectInstance[] = []
    for (const o of geoloc) {
      const cat = categorie(o.type_name)
      if (cat === 'engin') engins.push(versEngin(o))
      else if (cat === 'victime') victimes.push(versVictime(o))
      else autres.push(o)
    }
    enginsRef.current?.majEngins(engins, { nomSurToit: true })
    victimesRef.current?.majVictimes(victimes)

    // Marqueurs pour le reste (bâtiments, zones, lieux, interventions…).
    const marqueurs = marqueursRef.current
    const idsVus = new Set<string>()
    for (const o of autres) {
      idsVus.add(o.id)
      const existant = marqueurs.get(o.id)
      if (existant) {
        existant.setLngLat([o.lon!, o.lat!])
        appliquerStyleMarqueur(existant.getElement(), o)
        existant.getPopup()?.setText(o.libelle)
      } else {
        const marker = new maplibregl.Marker({ element: creerElementMarqueur(o) })
          .setLngLat([o.lon!, o.lat!])
          .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(o.libelle))
          .addTo(map)
        marqueurs.set(o.id, marker)
      }
    }
    for (const [id, marker] of marqueurs) {
      if (!idsVus.has(id)) {
        marker.remove()
        marqueurs.delete(id)
      }
    }

    // Plonge sur le premier objet géolocalisé (vue inclinée → les artefacts 3D ressortent).
    if (!dejaCentreRef.current && origineRef.current) {
      map.flyTo({ center: origineRef.current, zoom: 17, pitch: 55, duration: 1600 })
      dejaCentreRef.current = true
    }
  }, [map, objets])

  return <CarteLibre onCarte={setMap} />
}
