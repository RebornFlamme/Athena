# Tech Stack — Athena

## Existant (installé, fonctionnel)
| Brique | Version | Rôle |
|---|---|---|
| Vite | ^5.4 | bundler/dev server (port 5173) |
| React + react-dom | ^18.3 | UI |
| TypeScript | ^5.6 | typage strict (`tsc -b` dans le build) |
| react-router-dom | ^6.26 | routes (éditeur EAV aujourd'hui, dashboard demain) |
| @xyflow/react (React Flow) | ^12.3 | canvas graphe de l'éditeur EAV |
| zustand | ^4.5 | state global (pattern : maj optimiste + réconciliation Realtime) |
| @supabase/supabase-js | ^2.45 | base + realtime + storage |

## À ajouter pour le dashboard (phases F0-F1)
```bash
cd frontend
npm install maplibre-gl @mapbox/mapbox-gl-draw @turf/turf zod
```
| Brique | Rôle |
|---|---|
| maplibre-gl | carte WebGL (des milliers de points mobiles OK) |
| @mapbox/mapbox-gl-draw | tracé de zones/périmètres (compatible MapLibre) |
| @turf/turf | calculs géo (aires, distances) |
| zod | schémas de validation (extraction LLM, formulaires) |

## Supabase (projet unique, deux domaines)
- Migration `0001_init_eav_editor.sql` : éditeur EAV (`entities`, `attributes`) — ne pas toucher.
- Migration `0002_athena_core.sql` (à créer en F0) : `interventions`, `evenements`, `entites` — SQL complet prêt dans `vibe-coding-prompt-template-main/docs/TechDesign-Athena-MVP.md` §4. Pas de table `appels` (décision produit) : l'appel est traité en direct, la transcription est éphémère, la phrase source d'un fait vit dans `payload.extrait_source` de l'événement.
- Realtime activé sur les tables du dashboard ; PostGIS pour `geom`.
- **Edge Functions** (`supabase/functions/`) : `extraction` (LLM), `stt-token` (token Gladia éphémère). C'est LE serveur du projet (Vite n'en a pas).

## Services externes
| Service | Usage | Endpoint / note |
|---|---|---|
| Gladia | STT streaming français (~300 ms) | websocket ; clé côté Edge Function uniquement |
| Gemini API | extraction structurée (function calling) | modèle Gemini Flash ; function declarations OpenAPI |
| IGN Géoplateforme | fonds de carte (tuiles vectorielles) | `data.geopf.fr` — gratuit, sans clé |
| IGN Géocodage | validation d'adresse + score | `data.geopf.fr/geocodage` — ⚠ successeur de l'ancienne api-adresse.data.gouv.fr |

## Variables d'environnement
| Variable | Où | Sensible |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `frontend/.env.local` (+ `.env.example` versionné) | non (bridées par RLS) |
| `GLADIA_API_KEY` | `supabase secrets set` | **oui** |
| `GEMINI_API_KEY` | `supabase secrets set` / Render env | **oui** |

## Déploiement
- **Démo :** Vercel ou Netlify (build statique Vite) + Supabase cloud. Données fictives uniquement.
- **Pilote (données réelles) :** bascule souveraine — app sur Scalingo/Clever Cloud, PostgreSQL managé français, STT self-host (Voxtral/Speechmatics). Le code ne change pas, seul l'hébergement change.
