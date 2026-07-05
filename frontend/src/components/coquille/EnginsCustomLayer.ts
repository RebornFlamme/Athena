import * as THREE from 'three'
import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MlMap,
} from 'maplibre-gl'
import { INCIDENT, type TypeEngin } from './donneesMock'

/**
 * Couche personnalisée MapLibre (Three.js) — les ENGINS en pavés droits rouges
 * semi-transparents, orientés selon leur cap, + leurs personnels en petits cubes
 * embarqués. Géo-ancrée sur le lieu d'intervention (origine ENU locale), même
 * transformation Mercator que la découpe d'étages.
 *
 * Repère local (après scale (echelle, −echelle, echelle)) : X = est, Y = nord,
 * Z = haut. Un engin au cap 0 pointe vers le nord (+Y).
 */

export interface EtatEngin {
  id: string
  type: TypeEngin
  lon: number
  lat: number
  cap: number // degrés, 0 = nord, sens horaire
  nom: string
  nbPerso: number
  aerien: boolean // vole en altitude
}

export interface OptionsEngins {
  /** Afficher le nom au-dessus du toit du pavé (étiquette 3D horizontale). */
  nomSurToit: boolean
}

export interface CoucheEngins extends CustomLayerInterface {
  majEngins(engins: EtatEngin[], opts: OptionsEngins): void
}

// Dimensions d'un pavé par type d'engin (mètres) : [long (sens de marche), large, haut].
const DIMS: Record<TypeEngin, [number, number, number]> = {
  FPT: [8, 2.5, 3.2], // fourgon-pompe
  EPA: [10, 2.5, 3.4], // échelle pivotante (long)
  BEA: [11, 2.6, 3.6], // bras élévateur (le plus long)
  VSAV: [6, 2.2, 2.6], // ambulance (petit)
  BA: [7, 2.4, 3.0], // logistique air
  VLR: [4.5, 1.9, 1.7], // véhicule léger
}

const [LON0, LAT0] = INCIDENT
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const MY = 110540
const ALT_VOL = 85 // altitude d'un moyen aérien (m)

/** Texture d'un nom (pastille blanche sur rouge) pour la face arrière. */
function textureNom(nom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'rgba(120,10,10,0.9)'
  ctx.beginPath()
  ctx.roundRect(6, 30, 500, 68, 14)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(nom, c.width / 2, 66)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

type Noeud = {
  group: THREE.Group // pavé + arêtes + personnels (tournent avec le cap)
  texte: THREE.Mesh // étiquette « toit » (au niveau de la scène → non tournée)
  hauteur: number // hauteur du pavé (m) pour placer l'étiquette au-dessus
}

export function creerCoucheEngins(id: string): CoucheEngins {
  const merc = maplibregl.MercatorCoordinate.fromLngLat(INCIDENT, 0)
  const echelle = merc.meterInMercatorCoordinateUnits()

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.85))
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(30, 40, 60)
  scene.add(dir)

  const camera = new THREE.Camera()
  let renderer: THREE.WebGLRenderer | null = null
  let carte: MlMap | null = null

  // Géométrie de pavé mise en cache PAR TYPE (dimensions différentes) ; matériaux
  // partagés. X = large (est), Y = long (nord, sens de marche), Z = haut.
  const geoCache = new Map<TypeEngin, { boite: THREE.BoxGeometry; aretes: THREE.EdgesGeometry }>()
  function geoPour(type: TypeEngin) {
    let g = geoCache.get(type)
    if (!g) {
      const [L, W, H] = DIMS[type]
      const boite = new THREE.BoxGeometry(W, L, H)
      g = { boite, aretes: new THREE.EdgesGeometry(boite) }
      geoCache.set(type, g)
    }
    return g
  }
  const geoPerso = new THREE.BoxGeometry(0.6, 0.6, 1.2)
  const matBoite = new THREE.MeshStandardMaterial({
    color: '#e11d1d',
    transparent: true,
    opacity: 0.5,
    roughness: 0.5,
    metalness: 0.05,
  })
  const matAretes = new THREE.LineBasicMaterial({ color: '#7f1d1d', transparent: true, opacity: 0.9 })
  const matPerso = new THREE.MeshStandardMaterial({
    color: '#2563eb',
    transparent: true,
    opacity: 0.75,
    roughness: 0.6,
  })

  const noeuds = new Map<string, Noeud>()

  function creerNoeud(e: EtatEngin): Noeud {
    const group = new THREE.Group()
    const [L, W, H] = DIMS[e.type]
    const g = geoPour(e.type)

    const boite = new THREE.Mesh(g.boite, matBoite)
    boite.position.z = H / 2
    group.add(boite)

    const aretes = new THREE.LineSegments(g.aretes, matAretes)
    aretes.position.z = H / 2
    group.add(aretes)

    // Personnels : petits cubes en file derrière l'engin (embarqués → suivent).
    const n = Math.min(e.nbPerso, 6)
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(geoPerso, matPerso)
      const col = i % 2
      const rang = Math.floor(i / 2)
      p.position.set(col === 0 ? -0.7 : 0.7, -L / 2 - 1.2 - rang * 1.0, 0.6)
      group.add(p)
    }
    scene.add(group)

    // Étiquette « sur le toit » : plan HORIZONTAL au-dessus du toit, ajouté à la
    // SCÈNE (pas au groupe) → ne tourne pas avec le cap → toujours lisible.
    // depthTest désactivé + renderOrder élevé → jamais masquée par un pavé.
    const largeurTexte = Math.max(W * 2.2, 6)
    const texte = new THREE.Mesh(
      new THREE.PlaneGeometry(largeurTexte, 1.6),
      new THREE.MeshBasicMaterial({
        map: textureNom(e.nom),
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    )
    texte.visible = false
    texte.renderOrder = 999
    scene.add(texte)

    return { group, texte, hauteur: H }
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map: MlMap, gl: WebGLRenderingContext) {
      carte = map
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
      renderer.autoClear = false
    },

    render(_gl: WebGLRenderingContext, options: CustomRenderMethodInput) {
      if (!renderer) return
      const l = new THREE.Matrix4()
        .makeTranslation(merc.x, merc.y, merc.z)
        .scale(new THREE.Vector3(echelle, -echelle, echelle))
      camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(options.defaultProjectionData.mainMatrix)
        .multiply(l)
      renderer.resetState()
      renderer.render(scene, camera)
      carte?.triggerRepaint()
    },

    majEngins(engins: EtatEngin[], opts: OptionsEngins) {
      const vus = new Set<string>()
      for (const e of engins) {
        vus.add(e.id)
        let n = noeuds.get(e.id)
        if (!n) {
          n = creerNoeud(e)
          noeuds.set(e.id, n)
        }
        const est = (e.lon - LON0) * MX
        const nord = (e.lat - LAT0) * MY
        const zBase = e.aerien ? ALT_VOL : 0 // moyen aérien en altitude
        n.group.position.set(est, nord, zBase)
        n.group.rotation.z = (-e.cap * Math.PI) / 180 // cap horaire depuis le nord
        // Étiquette posée au-dessus du toit, non tournée (lisible).
        n.texte.position.set(est, nord, zBase + n.hauteur + 1.6)
        n.texte.visible = opts.nomSurToit
      }
      // Retire les engins disparus.
      for (const [k, n] of noeuds) {
        if (!vus.has(k)) {
          scene.remove(n.group)
          scene.remove(n.texte)
          noeuds.delete(k)
        }
      }
      carte?.triggerRepaint()
    },

    onRemove() {
      geoCache.forEach((g) => {
        g.boite.dispose()
        g.aretes.dispose()
      })
      geoCache.clear()
      geoPerso.dispose()
      matBoite.dispose()
      matAretes.dispose()
      matPerso.dispose()
      noeuds.clear()
      renderer = null
      carte = null
    },
  }
}
