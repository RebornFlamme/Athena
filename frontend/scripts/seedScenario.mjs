// seedScenario.mjs — charge un scénario complet (15 MP3 + timeline) dans la table
// `appels` + le bucket Storage `appels-audio`, sans passer par l'UI /flux.
//
// Usage (depuis frontend/) :
//   node scripts/seedScenario.mjs [chemin_du_scenario] [--dry] [--keep]
//     • chemin_du_scenario : dossier `scenario_le_peletier/` (défaut : env SCENARIO_DIR
//       ou ../scenario_le_peletier). Doit contenir emergency_calls/ et radio_comms/.
//     • --dry  : calcule tout (ts_debut_ms, piste, durée) et affiche, SANS rien
//       écrire dans Supabase (ni upload, ni insert). Idéal pour vérifier.
//     • --keep : ne vide PAS la table `appels` avant (par défaut on repart d'une
//       ardoise vierge, comme le créateur de simulation).
//
// Prérequis (run réel, hors --dry) :
//   • frontend/.env.local avec VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//   • migration supabase/migrations/0003_* appliquée (table `appels` + bucket)
//   • ffprobe dans le PATH (mesure la durée des MP3)
//
// Ce script NE lance PAS la transcription/les agents : une fois les appels chargés,
// va dans /flux, place-les si besoin, puis clique « Lancer » (nécessite le backend).

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '..')

// ---- arguments ----
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const KEEP = args.includes('--keep')
const positionnels = args.filter((a) => !a.startsWith('--'))

// ---- env (.env.local puis process.env) ----
function chargerEnv() {
  const env = { ...process.env }
  const f = join(FRONTEND, '.env.local')
  if (existsSync(f)) {
    for (const ligne of readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (ligne.trim().startsWith('#')) continue
      const m = ligne.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}
const env = chargerEnv()

// ---- dossier scénario ----
const SCENARIO = positionnels[0] || env.SCENARIO_DIR || resolve(FRONTEND, '..', 'scenario_le_peletier')
if (!existsSync(SCENARIO)) {
  console.error(`❌ Dossier scénario introuvable : ${SCENARIO}`)
  console.error('   Passe le chemin : node scripts/seedScenario.mjs <chemin_scenario_le_peletier>')
  process.exit(1)
}

// ---- timeline + métadonnées PELETIER-14 (source : 05_MASTER_TIMELINE.md) ----
// `start` = instant réel dans le scénario ; ts_debut_ms = (start − t0) en ms.
// Pistes : 0-4 = réseaux radio, 5-14 = appels 112 (ordre chronologique).
const META = {
  CH1: { piste: 0, start: '02:42:30', titre: 'CH1 — OPS / Dispatch', localisation: null, caserne: 'BSPP' },
  CH2: { piste: 1, start: '02:50:55', titre: 'CH2 — Command TAC2', localisation: null, caserne: 'BSPP' },
  CH3: { piste: 2, start: '02:49:30', titre: 'CH3 — Secteur Alpha (bâtiment événement)', localisation: '14 rue Le Peletier, Paris 9e', caserne: 'BSPP' },
  CH4: { piste: 3, start: '03:00:10', titre: 'CH4 — Secteur Bravo (résidentiel)', localisation: '16 & 18 rue Le Peletier, Paris 9e', caserne: 'BSPP' },
  CH5: { piste: 4, start: '02:58:30', titre: 'CH5 — Secteur Médical (plan rouge)', localisation: 'Bd Haussmann (PMA)', caserne: 'BSPP' },
  'CALL-06': { start: '02:41:10', titre: 'CALL-06 — Nadia Ferrand (témoin, en face)', localisation: 'Rue Le Peletier / Bd Haussmann', caserne: 'BSPP — CTA 75' },
  'CALL-01': { start: '02:41:55', titre: 'CALL-01 — Leïla Benali (16 rue Le Peletier)', localisation: '16 rue Le Peletier, Paris 9e', caserne: 'BSPP — CTA 75' },
  'CALL-02': { start: '02:43:05', titre: 'CALL-02 — Roger Fabre, 82 (18 rue Le Peletier)', localisation: '18 rue Le Peletier, Paris 9e', caserne: 'BSPP — CTA 75' },
  'CALL-07': { start: '02:44:20', titre: 'CALL-07 — Marc Djemba (gardien banque, Haussmann)', localisation: 'Bd Haussmann (hall banque)', caserne: 'BSPP — CTA 75' },
  'CALL-03': { start: '02:45:10', titre: 'CALL-03 — Dylan Girard, 24 (16 rue Le Peletier)', localisation: '16 rue Le Peletier, Paris 9e', caserne: 'BSPP — CTA 75' },
  'CALL-04': { start: '02:47:30', titre: 'CALL-04 — Fatima Belkacem, 67 (18 rue Le Peletier, arabe)', localisation: '18 rue Le Peletier, Paris 9e', caserne: 'BSPP — CTA 75' },
  'CALL-05': { start: '02:48:40', titre: 'CALL-05 — Théo Marchal + Emma Costa (16 rue Le Peletier)', localisation: '16 rue Le Peletier, Paris 9e', caserne: 'BSPP — CTA 75' },
  'CALL-08': { start: '02:50:05', titre: 'CALL-08 — Sami Haddad (taxi, témoin, Haussmann)', localisation: 'Bd Haussmann', caserne: 'BSPP — CTA 75' },
  'CALL-09': { start: '02:52:40', titre: 'CALL-09 — Rosa Delgado (témoin, espagnol)', localisation: 'Rue Le Peletier', caserne: 'BSPP — CTA 75' },
  'CALL-10': { start: '02:55:02', titre: 'CALL-10 — Bruno Keller (18 rue Le Peletier)', localisation: '18 rue Le Peletier, Paris 9e', caserne: 'BSPP — CTA 75' },
}

const hms = (s) => {
  const [h, m, sec] = s.split(':').map(Number)
  return h * 3600 + m * 60 + sec
}
const codeDe = (nom) => {
  const m = nom.match(/^(CALL-\d{2}|CH\d)/i)
  return m ? m[1].toUpperCase() : null
}

// ---- découverte des MP3 (1 par dossier de conversation) ----
function trouverMp3(dir) {
  const out = []
  for (const sous of ['emergency_calls', 'radio_comms']) {
    const base = join(dir, sous)
    if (!existsSync(base)) continue
    for (const conv of readdirSync(base, { withFileTypes: true })) {
      if (!conv.isDirectory()) continue
      const dossier = join(base, conv.name)
      const mp3 = readdirSync(dossier).find((f) => f.toLowerCase().endsWith('.mp3'))
      const code = codeDe(conv.name)
      if (mp3 && code) out.push({ code, file: join(dossier, mp3) })
    }
  }
  return out
}

function dureeMs(file) {
  const out = execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', file], { encoding: 'utf8' })
  const d = JSON.parse(out).format?.duration
  return Math.round(Number(d) * 1000)
}

// ---- préparation des lignes ----
const trouves = trouverMp3(SCENARIO)
const inconnus = trouves.filter((t) => !META[t.code])
if (inconnus.length) console.warn('⚠ codes sans métadonnée (ignorés) :', inconnus.map((t) => t.code).join(', '))
const items = trouves.filter((t) => META[t.code])
if (items.length === 0) {
  console.error('❌ Aucun MP3 reconnu (attendu emergency_calls/CALL-xx/*.mp3 et radio_comms/CHx/*.mp3).')
  process.exit(1)
}

const t0 = Math.min(...items.map((t) => hms(META[t.code].start)))
// Pistes des appels : 5..14 dans l'ordre chronologique.
const appelsTries = items.filter((t) => t.code.startsWith('CALL')).sort((a, b) => hms(META[a.code].start) - hms(META[b.code].start))
const pisteAppel = new Map(appelsTries.map((t, i) => [t.code, 5 + i]))

const lignes = items
  .map((t) => {
    const m = META[t.code]
    return {
      code: t.code,
      file: t.file,
      titre: m.titre,
      localisation: m.localisation,
      caserne: m.caserne,
      operateur: null,
      piste: m.piste ?? pisteAppel.get(t.code),
      ts_debut_ms: (hms(m.start) - t0) * 1000,
      duree_ms: dureeMs(t.file),
    }
  })
  .sort((a, b) => a.ts_debut_ms - b.ts_debut_ms)

console.log(`📂 Scénario : ${SCENARIO}`)
console.log(`🎧 ${lignes.length} conversations · t0 = plus précoce · ${DRY ? 'MODE --dry (aucune écriture)' : 'écriture Supabase'}\n`)
for (const l of lignes) {
  const t = (l.ts_debut_ms / 1000).toFixed(0)
  console.log(`  piste ${String(l.piste).padStart(2)} · +${String(t).padStart(4)}s · ${(l.duree_ms / 1000).toFixed(0)}s · ${l.titre}`)
}

if (DRY) {
  console.log('\n✅ --dry : rien écrit. Relance sans --dry pour charger dans Supabase.')
  process.exit(0)
}

// ---- écriture Supabase (run réel) ----
const URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL || !KEY) {
  console.error('\n❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants (frontend/.env.local).')
  process.exit(1)
}
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(URL, KEY)
const BUCKET = 'appels-audio'

if (!KEEP) {
  console.log('\n🧹 Vidage de la table `appels`…')
  const { error } = await supabase.from('appels').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    console.error('❌ Échec du vidage :', error.message)
    if (/Could not find the table|appels-audio|Bucket not found/.test(error.message)) {
      console.error('   → applique la migration supabase/migrations/0003_* (table + bucket).')
    }
    process.exit(1)
  }
}

console.log('\n⬆️  Téléversement + insertion…')
let ok = 0
for (const l of lignes) {
  try {
    const buf = readFileSync(l.file)
    const path = `${l.code.toLowerCase()}-${randomUUID()}.mp3`
    const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: 'audio/mpeg', upsert: false })
    if (eUp) throw eUp
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: eIns } = await supabase.from('appels').insert({
      titre: l.titre,
      audio_url: pub.publicUrl,
      audio_path: path,
      ts_debut_ms: l.ts_debut_ms,
      duree_ms: l.duree_ms,
      piste: l.piste,
      operateur: l.operateur,
      localisation: l.localisation,
      caserne: l.caserne,
    })
    if (eIns) throw eIns
    ok++
    console.log(`  ✓ ${l.titre}`)
  } catch (err) {
    console.error(`  ✗ ${l.titre} — ${err.message || err}`)
  }
}

console.log(`\n✅ ${ok}/${lignes.length} appels chargés.`)
console.log('   → Ouvre /flux pour voir le montage, puis « Lancer » pour la transcription + les agents (backend requis).')
