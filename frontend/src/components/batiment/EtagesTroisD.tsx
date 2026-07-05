import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  COULEUR_STATUT,
  EMPRISE_LOCALE,
  ETAGES,
  centreEmprise,
  type Etage,
} from './batiment'

/**
 * Vue 3D interactive du bâtiment éclaté (Three.js).
 *
 * Un volume extrudé par étage sur l'emprise réelle, écartés verticalement.
 * Rotation/zoom libres (OrbitControls) ; survol met en évidence l'étage et
 * affiche ses appartements (foyer, victimes). Clic = sélection persistante.
 *
 * `bearing` (degrés) : cap de départ, hérité de la caméra de la carte, pour que
 * la vue s'ouvre orientée exactement comme la carte au moment du passage.
 * Repère monde (après rotation des dalles) : X = est, Y = haut, +Z = sud.
 */

const EPAISSEUR = 2.4
const ECART = 4.6
const DIST_CAM = 155 // distance caméra ↔ bâtiment (grande emprise haussmannienne)
const ELEVATION_DEG = 34 // angle au-dessus de l'horizon (vue oblique agréable)

export function EtagesTroisD({ bearing = 0 }: { bearing?: number }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [survol, setSurvol] = useState<Etage | null>(null)
  const [selection, setSelection] = useState<Etage | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const largeur = host.clientWidth || 800
    const hauteur = host.clientHeight || 600

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eef1f4')

    const camera = new THREE.PerspectiveCamera(45, largeur / hauteur, 0.1, 2000)
    // Caméra placée au cap de la carte : cap 0 (nord en haut) → caméra plein sud.
    const el = THREE.MathUtils.degToRad(ELEVATION_DEG)
    const b = THREE.MathUtils.degToRad(bearing)
    const horiz = DIST_CAM * Math.cos(el)
    camera.position.set(-horiz * Math.sin(b), DIST_CAM * Math.sin(el), horiz * Math.cos(b))

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(largeur, hauteur)
    host.appendChild(renderer.domElement)

    // Lumières.
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(40, 80, 30)
    scene.add(dir)
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.35)
    dir2.position.set(-50, 30, -40)
    scene.add(dir2)

    // Emprise recentrée sur son centroïde.
    const [cx, cy] = centreEmprise()
    const shape = new THREE.Shape()
    EMPRISE_LOCALE.forEach(([x, y], i) => {
      const px = x - cx
      const py = y - cy
      if (i === 0) shape.moveTo(px, py)
      else shape.lineTo(px, py)
    })
    shape.closePath()

    const geomBase = new THREE.ExtrudeGeometry(shape, { depth: EPAISSEUR, bevelEnabled: false })

    const hauteurEclatee = ETAGES.length * (EPAISSEUR + ECART)
    const meshes: { mesh: THREE.Mesh; etage: Etage; base: THREE.Color; emissiveBase: THREE.Color }[] = []
    const groupe = new THREE.Group()

    ETAGES.forEach((etage, i) => {
      const couleur = new THREE.Color(COULEUR_STATUT[etage.statutEtage])
      const feu = etage.statutEtage === 'feu'
      const mat = new THREE.MeshStandardMaterial({
        color: couleur,
        roughness: 0.72,
        metalness: 0.02,
        emissive: feu ? new THREE.Color('#ff5a1a') : new THREE.Color('#000000'),
        emissiveIntensity: feu ? 0.5 : 0,
      })
      const mesh = new THREE.Mesh(geomBase, mat)
      mesh.rotation.x = -Math.PI / 2 // débout : extrusion vers le haut
      mesh.position.y = i * (EPAISSEUR + ECART) - hauteurEclatee / 2
      mesh.userData.niveau = etage.niveau
      groupe.add(mesh)

      // Arêtes crisp.
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geomBase),
        new THREE.LineBasicMaterial({ color: couleur.clone().multiplyScalar(0.55) }),
      )
      edges.rotation.x = -Math.PI / 2
      edges.position.y = mesh.position.y
      groupe.add(edges)

      meshes.push({
        mesh,
        etage,
        base: couleur.clone(),
        emissiveBase: (mat.emissive as THREE.Color).clone(),
      })
    })
    scene.add(groupe)

    // Sol (disque d'ombre douce) — dimensionné sur l'emprise réelle du bloc.
    const sol = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshStandardMaterial({ color: '#dcdfe3', roughness: 1 }),
    )
    sol.rotation.x = -Math.PI / 2
    sol.position.y = -hauteurEclatee / 2 - 3
    scene.add(sol)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.minDistance = 30
    controls.maxDistance = 260
    controls.update()

    // Raycasting survol / clic.
    const raycaster = new THREE.Raycaster()
    const souris = new THREE.Vector2()
    let survole: number | null = null

    function niveauSous(ev: PointerEvent): number | null {
      const r = renderer.domElement.getBoundingClientRect()
      souris.x = ((ev.clientX - r.left) / r.width) * 2 - 1
      souris.y = -((ev.clientY - r.top) / r.height) * 2 + 1
      raycaster.setFromCamera(souris, camera)
      const hits = raycaster.intersectObjects(meshes.map((m) => m.mesh))
      return hits.length ? (hits[0].object.userData.niveau as number) : null
    }
    const onMove = (ev: PointerEvent) => {
      const niv = niveauSous(ev)
      if (niv !== survole) {
        survole = niv
        setSurvol(niv == null ? null : ETAGES.find((e) => e.niveau === niv) ?? null)
        renderer.domElement.style.cursor = niv == null ? 'grab' : 'pointer'
      }
    }
    const onClick = (ev: PointerEvent) => {
      const niv = niveauSous(ev)
      setSelection(niv == null ? null : ETAGES.find((e) => e.niveau === niv) ?? null)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('click', onClick)

    // Boucle de rendu ; surbrillance de l'étage survolé/sélectionné.
    let brut = 0
    let raf = 0
    const rendu = () => {
      brut += 0.04
      const pulse = 0.5 + 0.5 * Math.sin(brut)
      meshes.forEach(({ mesh, etage, base, emissiveBase }) => {
        const mat = mesh.material as THREE.MeshStandardMaterial
        const actif = survole === etage.niveau
        mat.color.copy(base)
        if (actif) mat.color.offsetHSL(0, 0, 0.12)
        if (etage.statutEtage === 'feu') {
          mat.emissive.copy(emissiveBase)
          mat.emissiveIntensity = 0.35 + 0.35 * pulse
        }
      })
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(rendu)
    }
    rendu()

    const onResize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(host)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      geomBase.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [bearing])

  const info = selection ?? survol

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
        Glisser pour tourner · molette pour zoomer · survoler / cliquer un étage
      </div>
      {info && (
        <div className="absolute bottom-3 left-3 w-72 rounded-lg border bg-background/95 p-3 shadow-lg">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-sm"
              style={{ background: COULEUR_STATUT[info.statutEtage] }}
            />
            <span className="text-sm font-semibold">
              {info.label} {info.type === 'rdc' ? '— rez-de-chaussée' : ''}
            </span>
          </div>
          <ul className="space-y-0.5 text-xs">
            {info.appartements.map((a) => (
              <li key={a.code} className="flex gap-2">
                <span
                  className="mt-1 inline-block size-2 shrink-0 rounded-sm"
                  style={{ background: COULEUR_STATUT[a.statut] }}
                />
                <span>
                  <span className="font-medium">{a.code}</span>
                  {a.detail ? <span className="text-muted-foreground"> — {a.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
