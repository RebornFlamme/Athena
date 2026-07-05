import type { StyleSpecification } from 'maplibre-gl'

/**
 * Thèmes de fond de carte pour CarteLibre.
 *
 * Un seul jeu de couches vectorielles (tuiles OpenFreeMap / schéma OpenMapTiles) ;
 * seules les propriétés `paint` changent d'un thème à l'autre. La bascule se fait
 * donc par `setPaintProperty` (instantané, sans rechargement) — voir `paintFor`.
 *
 *  • tactique : palette crème/tactique des exports SVG (fond beige, monochrome).
 *  • osm      : coloré « carte routière » classique (verts francs, bâtiments tan,
 *               usages du sol teintés, axes jaune/orangé).
 *  • douce    : coloré mais désaturé, cohérent avec un dashboard sombre.
 *
 * Fichier volontairement sans import runtime (seulement `import type`), pour
 * pouvoir le valider isolément avec le validateur de style MapLibre.
 */

export type ThemeKey = 'tactique' | 'osm' | 'douce'

export const THEMES_UI: { key: ThemeKey; label: string }[] = [
  { key: 'tactique', label: 'Tactique' },
  { key: 'osm', label: 'OSM' },
  { key: 'douce', label: 'Douce' },
]

/* eslint-disable @typescript-eslint/no-explicit-any */
type Expr = any

interface Palette {
  fond: string
  eau: string
  veget: string
  vegetOpacite: number
  park: string
  parkOpacite: number
  landuse: Expr
  landuseOpacite: number
  bati: Expr
  batiContour: string
  batiOpaciteMax: number
  routeContour: string
  route: Expr
  routeNom: string
  lieu: string
  halo: string
}

/** Teintes d'usage du sol (résidentiel, commercial, hôpital, école, cimetière…). */
function landuseTints(
  residentiel: string,
  commerce: string,
  industrie: string,
  hopital: string,
  ecole: string,
  cimetiere: string,
): Expr {
  return [
    'match',
    ['get', 'class'],
    'residential', residentiel,
    ['commercial', 'retail'], commerce,
    'industrial', industrie,
    'hospital', hopital,
    ['school', 'university', 'college', 'education'], ecole,
    'cemetery', cimetiere,
    'rgba(0,0,0,0)',
  ]
}

const PALETTES: Record<ThemeKey, Palette> = {
  tactique: {
    fond: '#f4f1ea',
    eau: '#aecbd6',
    veget: '#dde4d2',
    vegetOpacite: 0.55,
    park: '#dde4d2',
    parkOpacite: 0.4,
    landuse: 'rgba(0,0,0,0)',
    landuseOpacite: 0,
    bati: '#e3ded2',
    batiContour: '#c9c3b2',
    batiOpaciteMax: 0.9,
    routeContour: '#c9c3b2',
    route: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], '#ddd8cc', '#e6e2d8'],
    routeNom: '#8f8874',
    lieu: '#6f6a5f',
    halo: '#f4f1ea',
  },
  osm: {
    fond: '#f2efe9',
    eau: '#aad3df',
    veget: '#b9d9a0',
    vegetOpacite: 0.9,
    park: '#c8e6b8',
    parkOpacite: 0.8,
    landuse: landuseTints('#e6e2da', '#f2dede', '#e6dced', '#ffe9e8', '#f0e8cc', '#dfe8cc'),
    landuseOpacite: 0.7,
    bati: ['coalesce', ['get', 'colour'], '#d9c8b4'],
    batiContour: '#c2ac90',
    batiOpaciteMax: 1,
    routeContour: '#c9b78f',
    route: [
      'match',
      ['get', 'class'],
      ['motorway', 'trunk'], '#f9b29c',
      'primary', '#fcd6a4',
      ['secondary', 'tertiary'], '#f7fabf',
      '#ffffff',
    ],
    routeNom: '#333333',
    lieu: '#222222',
    halo: '#ffffff',
  },
  douce: {
    fond: '#f3f1ec',
    eau: '#bcd6dd',
    veget: '#cfdec0',
    vegetOpacite: 0.7,
    park: '#d5e3c6',
    parkOpacite: 0.65,
    landuse: landuseTints('#ecebe4', '#efe2e0', '#e8e2ec', '#f6eaea', '#eee9d6', '#e5ead4'),
    landuseOpacite: 0.5,
    bati: ['coalesce', ['get', 'colour'], '#e4d5bd'],
    batiContour: '#cbbba0',
    batiOpaciteMax: 0.95,
    routeContour: '#dccfb8',
    route: [
      'match',
      ['get', 'class'],
      ['motorway', 'trunk', 'primary'], '#efe3cd',
      'secondary', '#f5efe0',
      '#ffffff',
    ],
    routeNom: '#5c5648',
    lieu: '#4a4436',
    halo: '#f3f1ec',
  },
}

/**
 * Propriétés `paint` par couche pour un thème donné (source unique de vérité,
 * utilisée à la fois par `construireStyle` et par la bascule à chaud).
 */
export function paintFor(key: ThemeKey): Record<string, Record<string, Expr>> {
  const p = PALETTES[key]
  return {
    fond: { 'background-color': p.fond },
    'bm-landuse': { 'fill-color': p.landuse, 'fill-opacity': p.landuseOpacite },
    'bm-veget': { 'fill-color': p.veget, 'fill-opacity': p.vegetOpacite },
    'bm-park': { 'fill-color': p.park, 'fill-opacity': p.parkOpacite },
    'bm-eau': { 'fill-color': p.eau },
    'bm-cours-eau': { 'line-color': p.eau },
    'bm-bati': {
      'fill-color': p.bati,
      'fill-outline-color': p.batiContour,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, p.batiOpaciteMax],
    },
    'bm-route-contour': { 'line-color': p.routeContour },
    'bm-route': { 'line-color': p.route },
    'bm-route-nom': { 'text-color': p.routeNom, 'text-halo-color': p.halo },
    'bm-lieu': { 'text-color': p.lieu, 'text-halo-color': p.halo },
  }
}

const POLICE = ['Noto Sans Regular']

/** Construit le style complet pour un thème (paint issu de `paintFor`). */
export function construireStyle(
  key: ThemeKey,
  extrusion: { couleur: string; opacite: number },
): StyleSpecification {
  const pf = paintFor(key)
  const style = {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'fond', type: 'background', paint: pf['fond'] },
      {
        id: 'bm-landuse',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'landuse',
        paint: pf['bm-landuse'],
      },
      {
        id: 'bm-veget',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'grass', 'scrub'], true, false],
        paint: pf['bm-veget'],
      },
      {
        id: 'bm-park',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'park',
        paint: pf['bm-park'],
      },
      { id: 'bm-eau', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: pf['bm-eau'] },
      {
        id: 'bm-cours-eau',
        type: 'line',
        source: 'ofm',
        'source-layer': 'waterway',
        paint: { ...pf['bm-cours-eau'], 'line-width': 1.2 },
      },
      {
        id: 'bm-bati',
        type: 'fill',
        source: 'ofm',
        'source-layer': 'building',
        minzoom: 13,
        paint: pf['bm-bati'],
      },
      {
        id: 'bm-route-contour',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          ...pf['bm-route-contour'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 12, 19, 26],
        },
      },
      {
        id: 'bm-route',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          ...pf['bm-route'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 2, ['secondary', 'tertiary'], 1.4, 0.5],
            16,
            ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 10, ['secondary', 'tertiary'], 7, ['minor', 'service'], 4, 3],
            19,
            ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 22, ['secondary', 'tertiary'], 15, ['minor', 'service'], 10, 7],
          ],
        },
      },
      {
        id: 'bm-route-nom',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'transportation_name',
        minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name'], ['get', 'name:latin']],
          'text-font': POLICE,
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 13],
        },
        paint: { ...pf['bm-route-nom'], 'text-halo-width': 1.3 },
      },
      {
        id: 'bm-lieu',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'place',
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'name:latin']],
          'text-font': POLICE,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 16, 17],
        },
        paint: { ...pf['bm-lieu'], 'text-halo-width': 1.5 },
      },
      {
        // Volumes des bâtiments (révélés en 3D ; couleur/opacité pilotées à chaud).
        id: 'batiments-3d',
        type: 'fill-extrusion',
        source: 'ofm',
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!=', ['get', 'hide_3d'], true],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': extrusion.couleur,
          // Hauteur pilotable par feature-state : le bâtiment marqué `masque`
          // est aplati (0 m) → sert à retirer le bâtiment sinistré en mode Étages.
          'fill-extrusion-height': [
            'case',
            ['boolean', ['feature-state', 'masque'], false],
            0,
            ['coalesce', ['get', 'render_height'], 12],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': extrusion.opacite,
        },
      },
    ],
  }
  return style as unknown as StyleSpecification
}
