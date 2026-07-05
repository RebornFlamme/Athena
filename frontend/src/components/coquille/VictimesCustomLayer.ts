import * as THREE from 'three'
import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MlMap,
} from 'maplibre-gl'

/**
 * Couche personnalisée MapLibre (Three.js) — les VICTIMES en dômes 2D bleus
 * plaqués au sol (façon Google Maps). En vue inclinée (3D), chaque dôme s'élève à
 * l'altitude de son étage → on « voit les victimes dans les niveaux ». Ancrée sur
 * une ORIGINE passée à la création (repère ENU local, même repère que les engins).
 *
 * Alimentée EN DIRECT par `majVictimes()` à partir des vraies instances de l'agent
 * (plus le mock statique d'origine).
 */

const ETAGE_H = 3.3 // hauteur d'un étage (m) pour l'élévation
const BLEU = '#3b82f6'

/** Une victime à afficher (position + nombre + étage). */
export interface VictimeEtat {
  id: string
  pos: [number, number] // [lon, lat]
  persons: number
  etage: number
}

export interface CoucheVictimes extends CustomLayerInterface {
  setVisible(v: boolean): void
  majVictimes(victimes: VictimeEtat[]): void
}

export function creerCoucheVictimes(id: string, origine: [number, number]): CoucheVictimes {
  const [LON0, LAT0] = origine
  const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
  const MY = 110540
  const merc = maplibregl.MercatorCoordinate.fromLngLat(origine, 0)
  const echelle = merc.meterInMercatorCoordinateUnits()

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const lum = new THREE.DirectionalLight(0xffffff, 0.6)
  lum.position.set(25, -20, 80)
  scene.add(lum)

  const camera = new THREE.Camera()
  let renderer: THREE.WebGLRenderer | null = null
  let carte: MlMap | null = null
  let visible = true

  // Matériaux partagés (depthTest off → visibles « à travers » le bâtiment).
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

  type Noeud = { grp: THREE.Group; etage: number; persons: number; geos: THREE.BufferGeometry[] }
  const noeuds = new Map<string, Noeud>()

  function creerNoeud(v: VictimeEtat): Noeud {
    const r = 1.6 + Math.sqrt(Math.max(1, v.persons)) * 0.7
    const grp = new THREE.Group()

    // Dôme surbaissé (« bombé ») : demi-sphère aplatie, base au sol.
    const gDome = new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
    const dome = new THREE.Mesh(gDome, matDome)
    dome.rotation.x = Math.PI / 2
    dome.scale.set(1, 0.5, 1)
    dome.renderOrder = 500
    grp.add(dome)

    const gAnneau = new THREE.RingGeometry(r, r + 0.5, 40)
    const anneau = new THREE.Mesh(gAnneau, matAnneau)
    anneau.renderOrder = 501
    grp.add(anneau)

    scene.add(grp)
    return { grp, etage: v.etage, persons: v.persons, geos: [gDome, gAnneau] }
  }

  function placer(n: Noeud, v: VictimeEtat) {
    n.grp.position.set((v.pos[0] - LON0) * MX, (v.pos[1] - LAT0) * MY, 0.1)
    n.etage = v.etage
  }

  function retirerNoeud(n: Noeud) {
    scene.remove(n.grp)
    n.geos.forEach((g) => g.dispose())
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
      // Élévation par étage proportionnelle à l'inclinaison (à plat en 2D).
      const pitch = carte?.getPitch() ?? 0
      const f = Math.max(0, Math.min(1, (pitch - 5) / 40))
      for (const n of noeuds.values()) n.grp.position.z = 0.1 + f * n.etage * ETAGE_H

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
      for (const n of noeuds.values()) retirerNoeud(n)
      noeuds.clear()
      matDome.dispose()
      matAnneau.dispose()
      renderer = null
      carte = null
    },

    setVisible(v: boolean) {
      visible = v
      carte?.triggerRepaint()
    },

    majVictimes(victimes: VictimeEtat[]) {
      const vus = new Set<string>()
      for (const v of victimes) {
        vus.add(v.id)
        let n = noeuds.get(v.id)
        // Recrée le dôme si le nombre de personnes (donc le rayon) a changé.
        if (n && n.persons !== v.persons) {
          retirerNoeud(n)
          noeuds.delete(v.id)
          n = undefined
        }
        if (!n) {
          n = creerNoeud(v)
          noeuds.set(v.id, n)
        }
        placer(n, v)
      }
      for (const [k, n] of noeuds) {
        if (!vus.has(k)) {
          retirerNoeud(n)
          noeuds.delete(k)
        }
      }
      carte?.triggerRepaint()
    },
  }
}
