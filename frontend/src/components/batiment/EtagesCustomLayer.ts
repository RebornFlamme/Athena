import * as THREE from 'three'
import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MlMap,
} from 'maplibre-gl'
import {
  CENTROIDE_WGS84,
  COULEUR_STATUT,
  EMPRISE_LOCALE,
  ETAGES,
  HAUTEUR_ETAGE_M,
} from './batiment'

/**
 * Couche personnalisée MapLibre (Three.js) — découpe d'étages « tactique » :
 *   • un volume transparent par étage sur l'emprise RÉELLE, dont on distingue
 *     les SOLS (faces horizontales, couleur = statut) et les MURS latéraux
 *     (couleur + transparence propres, réglables) ;
 *   • arêtes des étages en TRAITS PLEINS (couleur = statut).
 * Étage 0 au sol ; géo-ancré via une transformation Mercator ; taille calée sur
 * le bâtiment réel des tuiles (majCible).
 */

export interface OptionsEtages {
  explosion: number // écart entre étages (m) ; 0 = immeuble contigu
  opaciteSol: number // transparence des sols (faces horizontales)
  couleurMur: string // couleur des murs latéraux
  opaciteMur: number // transparence des murs latéraux
  aretes: boolean // afficher les arêtes des étages
}

export const OPTIONS_ETAGES_DEFAUT: OptionsEtages = {
  explosion: 0,
  opaciteSol: 0.25, // 75 % de transparence
  couleurMur: '#6b7785',
  opaciteMur: 0.05, // 95 % de transparence
  aretes: true,
}

// Anti z-fighting : on décolle la maquette du sol et on laisse un mince interstice
// entre étages, pour que le sol du RDC ne soit pas coplanaire avec le plan de la
// carte et que les planchers colorés ne se chevauchent pas exactement.
const DECOLLE_SOL = 0.15 // m — hauteur de décollage au-dessus du sol
const INTERSTICE = 0.25 // m — jeu vertical minimal entre deux planchers

export interface CoucheEtages extends CustomLayerInterface {
  maj(opts: Partial<OptionsEtages>): void
  /**
   * Cale la maquette d'étages sur le bâtiment RÉEL des tuiles : même empreinte
   * (`ringWGS`, lon/lat) et même hauteur totale (`render_height`) → taille
   * identique au fond 3D. À défaut, l'emprise/hauteur statiques sont utilisées.
   */
  majCible(ringWGS: [number, number][], hauteurTotale: number): void
}

// Conversion géo → mètres locaux (repère ENU centré sur le bâtiment).
const [LON0, LAT0] = CENTROIDE_WGS84
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const MY = 110540

export function creerCoucheEtages(id: string, initial = OPTIONS_ETAGES_DEFAUT): CoucheEtages {
  const opts: OptionsEtages = { ...OPTIONS_ETAGES_DEFAUT, ...initial }

  const merc = maplibregl.MercatorCoordinate.fromLngLat(CENTROIDE_WGS84, 0)
  const echelle = merc.meterInMercatorCoordinateUnits()

  const scene = new THREE.Scene()
  const camera = new THREE.Camera()
  let renderer: THREE.WebGLRenderer | null = null
  let carte: MlMap | null = null

  // Empreinte/hauteur d'étage courantes (par défaut statiques ; recalées sur les
  // tuiles via majCible pour une taille identique au fond 3D).
  let hauteurEtage = HAUTEUR_ETAGE_M
  const epaisseurDalle = () => Math.max(0.3, hauteurEtage - INTERSTICE)
  const shape = new THREE.Shape(EMPRISE_LOCALE.map(([x, y]) => new THREE.Vector2(x, y)))
  let geoVol = new THREE.ExtrudeGeometry(shape, { depth: epaisseurDalle(), bevelEnabled: false })
  let geoAretes = new THREE.EdgesGeometry(geoVol)

  type Niveau = {
    vol: THREE.Mesh
    aretes: THREE.LineSegments
    matSol: THREE.MeshBasicMaterial
    matMur: THREE.MeshBasicMaterial
    matAretes: THREE.LineBasicMaterial
  }
  const niveaux: Niveau[] = []

  ETAGES.forEach((etage, i) => {
    const couleur = new THREE.Color(COULEUR_STATUT[etage.statutEtage])

    // ExtrudeGeometry : groupe 0 = caps (sols), groupe 1 = côtés (murs).
    // polygonOffset : les faces de sol gagnent tout conflit de profondeur
    // résiduel → on favorise la couleur du sol.
    const matSol = new THREE.MeshBasicMaterial({
      color: couleur,
      transparent: true,
      opacity: opts.opaciteSol,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    const matMur = new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.couleurMur),
      transparent: true,
      opacity: opts.opaciteMur,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const vol = new THREE.Mesh(geoVol, [matSol, matMur])
    vol.renderOrder = i

    const matAretes = new THREE.LineBasicMaterial({
      color: couleur.clone().multiplyScalar(0.75),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
    const aretes = new THREE.LineSegments(geoAretes, matAretes)
    aretes.visible = opts.aretes
    aretes.renderOrder = 100 + i

    scene.add(vol)
    scene.add(aretes)
    niveaux.push({ vol, aretes, matSol, matMur, matAretes })
  })

  function positionner() {
    niveaux.forEach(({ vol, aretes }, i) => {
      const z = DECOLLE_SOL + i * (hauteurEtage + opts.explosion)
      vol.position.z = z
      aretes.position.z = z
    })
  }
  positionner()

  /** Recale la géométrie des étages sur l'empreinte + hauteur réelles (tuiles). */
  function majCible(ringWGS: [number, number][], hauteurTotale: number) {
    const pts = ringWGS.map(([lon, lat]) => new THREE.Vector2((lon - LON0) * MX, (lat - LAT0) * MY))
    if (pts.length < 3 || !(hauteurTotale > 0)) return
    hauteurEtage = hauteurTotale / ETAGES.length
    const nVol = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
      depth: epaisseurDalle(),
      bevelEnabled: false,
    })
    const nAretes = new THREE.EdgesGeometry(nVol)
    geoVol.dispose()
    geoAretes.dispose()
    geoVol = nVol
    geoAretes = nAretes
    niveaux.forEach(({ vol, aretes }) => {
      vol.geometry = nVol
      aretes.geometry = nAretes
    })
    positionner()
    carte?.triggerRepaint()
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map: MlMap, gl: WebGLRenderingContext) {
      carte = map
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
      renderer.autoClear = false
      renderer.sortObjects = true
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

    onRemove() {
      niveaux.forEach(({ matSol, matMur, matAretes }) => {
        matSol.dispose()
        matMur.dispose()
        matAretes.dispose()
      })
      geoVol.dispose()
      geoAretes.dispose()
      renderer = null
      carte = null
    },

    maj(patch: Partial<OptionsEtages>) {
      Object.assign(opts, patch)
      niveaux.forEach(({ matSol, matMur, aretes }) => {
        matSol.opacity = opts.opaciteSol
        matMur.color.set(opts.couleurMur)
        matMur.opacity = opts.opaciteMur
        aretes.visible = opts.aretes
      })
      positionner()
      carte?.triggerRepaint()
    },

    majCible,
  }
}
