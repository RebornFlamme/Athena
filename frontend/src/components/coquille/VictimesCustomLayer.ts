import * as THREE from 'three'
import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MlMap,
} from 'maplibre-gl'
import { INCIDENT } from './donneesMock'
import { VICTIMES } from './victimesMock'

/**
 * Couche personnalisée MapLibre (Three.js) — les VICTIMES en disques 2D
 * HORIZONTAUX bleus (plaqués au sol, façon Google Maps). En vue inclinée (3D),
 * chaque disque s'élève à l'altitude de son étage → on « voit les victimes dans
 * les niveaux » du bâtiment. Ancrée sur le sinistre (même repère que les engins).
 *
 * Repère (après scale (echelle, −echelle, echelle)) : X = est, Y = nord, Z = haut.
 * Un `CircleGeometry` est dans le plan XY → il repose donc à plat (horizontal).
 */

const [LON0, LAT0] = INCIDENT
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const MY = 110540
const ETAGE_H = 3.3 // hauteur d'un étage (m) pour l'élévation
const BLEU = '#3b82f6'

export interface CoucheVictimes extends CustomLayerInterface {
  setVisible(v: boolean): void
}

export function creerCoucheVictimes(id: string): CoucheVictimes {
  const merc = maplibregl.MercatorCoordinate.fromLngLat(INCIDENT, 0)
  const echelle = merc.meterInMercatorCoordinateUnits()

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const lum = new THREE.DirectionalLight(0xffffff, 0.6)
  lum.position.set(25, -20, 80) // lumière rasante d'en haut → ombrage du dôme
  scene.add(lum)

  const camera = new THREE.Camera()
  let renderer: THREE.WebGLRenderer | null = null
  let carte: MlMap | null = null
  let visible = true

  // Matériaux partagés (depthTest off → les victimes restent visibles « à travers »
  // le bâtiment, donc lisibles dans les étages). Le dôme est légèrement ombré
  // (MeshStandard + lumière) pour bien ressortir en volume.
  const matDome = new THREE.MeshStandardMaterial({
    color: BLEU,
    roughness: 0.45,
    metalness: 0,
    emissive: new THREE.Color(BLEU),
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    side: THREE.FrontSide,
  })
  const matAnneau = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthTest: false,
  })

  type Noeud = { grp: THREE.Group; etage: number }
  const noeuds: Noeud[] = []
  const geos: THREE.BufferGeometry[] = []

  for (const v of VICTIMES) {
    const r = 1.6 + Math.sqrt(v.persons) * 0.7
    const grp = new THREE.Group()

    // Dôme surbaissé (« bombé ») : demi-sphère aplatie, base au sol, sommet en +Z.
    const gDome = new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
    const dome = new THREE.Mesh(gDome, matDome)
    dome.rotation.x = Math.PI / 2 // pôle du dôme vers le haut
    dome.scale.set(1, 0.5, 1) // aplati : hauteur ≈ 0,5 × rayon
    dome.renderOrder = 500
    grp.add(dome)

    const gAnneau = new THREE.RingGeometry(r, r + 0.5, 40)
    const anneau = new THREE.Mesh(gAnneau, matAnneau)
    anneau.renderOrder = 501
    grp.add(anneau)

    grp.position.set((v.pos[0] - LON0) * MX, (v.pos[1] - LAT0) * MY, 0.1)
    scene.add(grp)
    noeuds.push({ grp, etage: v.etage })
    geos.push(gDome, gAnneau)
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
      if (!renderer || !visible) return
      // Élévation par étage proportionnelle à l'inclinaison : à plat au sol en vue
      // de dessus (2D), montée aux étages quand on incline (3D).
      const pitch = carte?.getPitch() ?? 0
      const f = Math.max(0, Math.min(1, (pitch - 5) / 40))
      for (const n of noeuds) n.grp.position.z = 0.1 + f * n.etage * ETAGE_H

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

    onRemove() {
      geos.forEach((g) => g.dispose())
      matDome.dispose()
      matAnneau.dispose()
      renderer = null
      carte = null
    },

    setVisible(v: boolean) {
      visible = v
      carte?.triggerRepaint()
    },
  }
}
