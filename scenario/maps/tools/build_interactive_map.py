"""Build interactive_map.html — a self-contained time-slider map of PRADO-167.

Inlines unit_positions.json, victims.json and the scenario overlays so the file
works when opened directly from disk (no fetch/CORS issues). Base map: OSM raster
tiles via Leaflet CDN (needs internet when opened; overlays work regardless).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
DATA = HERE.parent / "data"
OUT = HERE.parent / "interactive_map.html"

units = json.loads((DATA / "unit_positions.json").read_text(encoding="utf-8"))
victims = json.loads((DATA / "victims.json").read_text(encoding="utf-8"))
site = json.loads((DATA / "site.geojson").read_text(encoding="utf-8"))

# keep only overlay-worthy site features (tiles already show the rest)
overlay = {"type": "FeatureCollection", "features": [
    f for f in site["features"]
    if f["properties"].get("scenario_role")
    or f["properties"].get("kind") in ("fire_hydrant", "fire_station")
]}

EVENTS = [
    ("02:46:55", "First 112 calls hit the ops centre"),
    ("02:47:12", "CALL-01 — family trapped 6th floor"),
    ("02:48:05", "Wave 1 dispatched (2 engines, ladder, medic, group cdr)"),
    ("02:50:15", "Wave 2 — column + NOVI pre-alert (call volume)"),
    ("02:51:05", "ENGINE LOUVAIN 1 on scene (first due)"),
    ("02:52:30", "Attack line enters stairwell"),
    ("02:53:20", "Unconscious victim found, 3rd-floor landing"),
    ("02:55:40", "GROUP SOUTH assumes command (COS)"),
    ("02:56:30", "Ladder rescue #1 — 3A balcony (2)"),
    ("02:58:10", "Situation report: 25+ trapped"),
    ("02:58:30", "CCP established on tram platform"),
    ("03:00:40", "Fire flat 3B door forced — interior attack"),
    ("03:04:00", "COLUMN 1 assumes command — sectors A/B/M"),
    ("03:05:00", "Critical casualty transported (La Timone)"),
    ("03:05:30", "Ladder rescue #2 — 4A (1)"),
    ("03:06:20", "Supply line 1 charged (H-ROUET, 230 m)"),
    ("03:09:30", "Extension to flat 4B confirmed"),
    ("03:10:20", "Ladder rescue #3 — 5C (1)"),
    ("03:11:40", "MAYDAY — ceiling collapse, 4th floor"),
    ("03:13:40", "Ladder rescue #4 — 5A (2)"),
    ("03:17:20", "MAYDAY resolved — both firefighters out"),
    ("03:18:10", "Ladder rescue #5 — 6C corner family (3)"),
    ("03:20:30", "Controlled evacuation begins (smoke hoods)"),
    ("03:24:00", "Semi-conscious victim found flat 5B"),
    ("03:30:20", "Last trapped caller escorted down"),
    ("03:34:30", "FIRE SURROUNDED"),
    ("03:40:10", "Primary search complete"),
    ("03:47:00", "Evacuation complete — 53 accounted for"),
    ("04:05:40", "FIRE UNDER CONTROL"),
    ("04:12:00", "Casualty count: 7 transported, 0 deceased"),
    ("04:20:00", "Secondary search complete"),
    ("05:45:00", "FIRE EXTINGUISHED"),
    ("06:10:00", "Command to GROUP SOUTH — fire watch"),
    ("07:00:00", "End state — surveillance rotation"),
]

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PRADO-167 — Live Operations Map (training scenario)</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  :root { --bg:#141821; --panel:#1D2330; --ink:#ECEFF4; --ink2:#9AA3B2; --line:#2A3242; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--ink); display:flex; flex-direction:column; height:100vh; }
  header { padding:10px 16px; display:flex; gap:14px; align-items:baseline; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; font-weight:700; }
  header .sub { color:var(--ink2); font-size:12px; }
  #main { flex:1; display:flex; min-height:0; }
  #map { flex:1; }
  #side { width:320px; background:var(--panel); border-left:1px solid var(--line); display:flex; flex-direction:column; }
  #side h2 { font-size:12px; letter-spacing:1px; text-transform:uppercase; color:var(--ink2); margin:12px 14px 6px; }
  #events { flex:1; overflow-y:auto; padding:0 8px 8px; font-size:12.5px; }
  .ev { padding:5px 8px; border-radius:6px; display:flex; gap:8px; cursor:pointer; color:var(--ink2); }
  .ev:hover { background:#242C3D; }
  .ev.past { color:var(--ink); }
  .ev.current { background:#2C3752; color:#fff; }
  .ev .t { font-variant-numeric:tabular-nums; color:#7FB2D9; flex:none; }
  footer { padding:10px 16px; background:var(--panel); border-top:1px solid var(--line); }
  #controls { display:flex; align-items:center; gap:12px; }
  #play { width:42px; height:30px; border-radius:6px; border:1px solid var(--line); background:#2C3752; color:#fff; font-size:14px; cursor:pointer; }
  #slider { flex:1; }
  #clock { font-size:20px; font-weight:700; font-variant-numeric:tabular-nums; width:100px; }
  select { background:#2C3752; color:#fff; border:1px solid var(--line); border-radius:6px; padding:3px 6px; }
  .note { color:var(--ink2); font-size:10.5px; margin-top:6px; }
  .u-label { background:none; border:none; }
  .u-chip { display:inline-block; padding:2px 6px; border-radius:4px; color:#fff; font-size:10px; font-weight:700; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,.5); border:1.5px solid #fff; }
  .v-label { background:none; border:none; font-size:10px; font-weight:700; color:#8a4a08; text-shadow:0 0 3px #fff; white-space:nowrap; }
  .leaflet-container { background:#AAD3DF; }
  .legend { position:absolute; bottom:104px; left:10px; z-index:900; background:rgba(20,24,33,.88); border:1px solid var(--line); border-radius:8px; padding:8px 12px; font-size:11px; line-height:1.8; }
  .legend .sw { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
</style>
</head>
<body>
<header>
  <h1>PRADO-167 — residential fire, 167 avenue du Prado, Marseille</h1>
  <span class="sub">Fictional training scenario · real OSM geography · 14 March 2026 · drag the time slider or press play</span>
</header>
<div id="main">
  <div id="map"></div>
  <div id="side">
    <h2>Event log (auto-follows clock)</h2>
    <div id="events"></div>
  </div>
</div>
<footer>
  <div id="controls">
    <button id="play">▶</button>
    <span id="clock">02:46:55</span>
    <input id="slider" type="range" min="9600" max="25200" step="5" value="10015">
    <label>Speed <select id="speed"><option value="30">30×</option><option value="60" selected>60×</option><option value="120">120×</option><option value="300">300×</option></select></label>
    <label>Jump <select id="jump"><option value="">— key moment —</option></select></label>
  </div>
  <div class="note">Times local (CET), seconds since midnight internally. Map data © OpenStreetMap contributors (ODbL) — tiles openstreetmap.org. All operational overlays are fictional (Athena demo dataset).</div>
</footer>
<div class="legend">
  <span class="sw" style="background:#C0392B"></span>engine &nbsp;
  <span class="sw" style="background:#8E241D"></span>ladder &nbsp;
  <span class="sw" style="background:#0F766E"></span>medic/DSM &nbsp;
  <span class="sw" style="background:#1A3E8C"></span>command &nbsp;
  <span class="sw" style="background:#5B6470"></span>logistics<br>
  <span class="sw" style="background:#B45309;border-radius:50%"></span>victim awaiting &nbsp;
  <span class="sw" style="background:#2E7D32;border-radius:50%"></span>resolved &nbsp;
  <span class="sw" style="background:#D94436;border-radius:50%"></span>fire &nbsp;
  <span class="sw" style="background:#1273A6;border-radius:50%"></span>hydrant
</div>
<script>
const UNITS = __UNITS__;
const VICT  = __VICTIMS__;
const OVER  = __OVERLAY__;
const EVENTS= __EVENTS__;
const LAT0=43.278230, LON0=5.388545, MX=__MX__, MY=110540.0;
const toLL=(x,y)=>[LAT0+y/MY, LON0+x/MX];
const T=s=>{const[a,b,c]=s.split(":").map(Number);return a*3600+b*60+c;};
const fmt=t=>[t/3600|0,t/60%60|0,t%60|0].map(n=>String(n).padStart(2,"0")).join(":");

const map=L.map("map",{zoomControl:true}).setView([LAT0,LON0],17);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);

// static overlays
L.geoJSON(OVER,{
  style:f=>{const r=f.properties.scenario_role;
    if(r==="incident_building")return{color:"#8E241D",weight:2.5,fillColor:"#D94436",fillOpacity:.35};
    if(r)return{color:"#8A8474",weight:1.5,fillColor:"#8A8474",fillOpacity:.15};
    return{};},
  pointToLayer:(f,ll)=>{
    const k=f.properties.kind;
    if(k==="fire_hydrant")return L.circleMarker(ll,{radius:5,color:"#1273A6",fillColor:"#1273A6",fillOpacity:.9});
    if(k==="fire_station")return L.circleMarker(ll,{radius:7,color:"#fff",weight:2,fillColor:"#C0392B",fillOpacity:1});
    return L.circleMarker(ll,{radius:4});},
  onEachFeature:(f,l)=>{const p=f.properties;
    l.bindPopup(p.scenario_role?`<b>${p.scenario_role.replaceAll("_"," ")}</b><br>${p.osm_id} · levels ${p.levels??"?"}`
      :p.kind==="fire_station"?`<b>${p.name}</b><br>${Math.round(p.dist_line_m)} m from incident`
      :`<b>hydrant</b> ${p.osm_id}<br>${p.dist_m} m from incident`);}
}).addTo(map);

// CCP marker (appears at 02:58:30)
const ccp=L.marker(toLL(-27,-45),{icon:L.divIcon({className:"u-label",html:'<span class="u-chip" style="background:#0F766E">CCP — casualty collection</span>'})});
// staging label
const stag=L.marker(toLL(-40,-125),{icon:L.divIcon({className:"u-label",html:'<span class="u-chip" style="background:#5B6470">STAGING</span>'})});
// exclusion circle
L.circle(toLL(3,1),{radius:35,color:"#C0392B",weight:1.5,dashArray:"6 5",fill:false}).addTo(map);

const COLORS={engine:"#C0392B",ladder:"#8E241D",medic:"#0F766E",SAMU:"#0F766E",ICU:"#0F766E","command post":"#1A3E8C",commander:"#1A3E8C",director:"#0F766E",logistics:"#5B6470"};
const SHORT=__SHORT__;
function color(u){for(const k in COLORS)if(u.type.includes(k))return COLORS[k];return"#5B6470";}
function posAt(tr,t){
  if(t<=T(tr[0].t))return{...tr[0]};
  for(let i=0;i<tr.length-1;i++){const a=tr[i],b=tr[i+1];
    if(t>=T(a.t)&&t<=T(b.t)){const f=(t-T(a.t))/Math.max(1,T(b.t)-T(a.t));
      return{x:a.x+f*(b.x-a.x),y:a.y+f*(b.y-a.y),status:b.status};}}
  return{...tr[tr.length-1]};}

const unitMarkers=UNITS.units.map(u=>{
  const m=L.marker(toLL(0,0),{icon:L.divIcon({className:"u-label",
    html:`<span class="u-chip" style="background:${color(u)}">${SHORT[u.callsign]||u.callsign}</span>`}),
    zIndexOffset:500});
  m.bindPopup(`<b>${u.callsign}</b><br>${u.type} · ${u.station}<br>crew ${u.crew} · cdr ${u.crew_commander}<br><span class="st"></span>`);
  return{u,m,on:false};});

const victMarkers=VICT.victims.filter(v=>v.id!=="V09").map(v=>{
  const m=L.circleMarker(toLL(v.x,v.y),{radius:7,color:"#fff",weight:1.5,fillColor:"#B45309",fillOpacity:.95,pane:"markerPane"});
  m.bindPopup(`<b>${v.name}</b><br>${v.location}<br>triage: ${v.triage}<br>resolved ${v.resolved} — ${v.resolution}`);
  return{v,m,on:false};});

const fire=L.circle(toLL(6,-2),{radius:12,color:"#D94436",fillColor:"#E67E22",fillOpacity:.6,weight:2});
let fireOn=false;

const evDiv=document.getElementById("events");
EVENTS.forEach(([t,txt],i)=>{
  const d=document.createElement("div");d.className="ev";d.id="ev"+i;
  d.innerHTML=`<span class="t">${t}</span><span>${txt}</span>`;
  d.onclick=()=>setTime(T(t));evDiv.appendChild(d);});

const jump=document.getElementById("jump");
[["02:51:05","T1 · first due"],["02:58:30","T2 · group command"],["03:12:00","T3 · MAYDAY"],["03:35:00","T4 · surrounded"],["04:05:40","under control"],["05:45:00","extinguished"]].forEach(([t,l])=>{
  const o=document.createElement("option");o.value=T(t);o.textContent=l+" ("+t+")";jump.appendChild(o);});
jump.onchange=()=>{if(jump.value)setTime(+jump.value);};

const slider=document.getElementById("slider"),clock=document.getElementById("clock");
function setTime(t){
  slider.value=t;clock.textContent=fmt(t);
  unitMarkers.forEach(o=>{
    const p=posAt(o.u.track,t);const st=String(p.status);
    const vis=!(st==="at_station"||st==="at_hospital"&&Math.hypot(p.x,p.y)>500&&false)&&st!=="at_station";
    if(vis){o.m.setLatLng(toLL(p.x,p.y));o.m.setOpacity(st==="responding"||st.startsWith("returning")?0.55:1);
      if(!o.on){o.m.addTo(map);o.on=true;}
      const el=o.m.getPopup().getContent();o.m.getPopup().setContent(el.replace(/<span class="st">.*?<\\/span>/,`<span class="st">status: ${st} @ ${fmt(t)}</span>`));
    }else if(o.on){map.removeLayer(o.m);o.on=false;}});
  victMarkers.forEach(o=>{
    const res=T(o.v.resolved);const start=o.v.found?T(o.v.found):T("02:46:55");
    const show=t>=Math.min(start,T("02:47:12"));
    if(show&&!o.on){o.m.addTo(map);o.on=true;}
    if(o.on)o.m.setStyle({fillColor:t>=res?"#2E7D32":"#B45309",radius:t>=res?5:7});});
  // fire
  const fs=VICT.fire_state.filter(f=>T(f.t)<=t);const cur=fs[fs.length-1];
  if(cur&&cur.floors.length){const r=8+5*cur.floors.length;fire.setRadius(r);
    fire.setStyle({fillOpacity:cur.extent.includes("SURROUND")||cur.extent.includes("CONTROL")?0.35:0.6});
    if(!fireOn){fire.addTo(map);fireOn=true;}}
  else if(fireOn){map.removeLayer(fire);fireOn=false;}
  if(t>=T("02:58:30")&&!map.hasLayer(ccp))ccp.addTo(map);
  if(t<T("02:58:30")&&map.hasLayer(ccp))map.removeLayer(ccp);
  if(t>=T("02:57:30")&&t<=T("03:20:00")&&!map.hasLayer(stag))stag.addTo(map);
  if((t<T("02:57:30")||t>T("03:20:00"))&&map.hasLayer(stag))map.removeLayer(stag);
  // events highlight
  let cur_i=-1;
  EVENTS.forEach(([et],i)=>{const d=document.getElementById("ev"+i);
    const p=T(et)<=t;d.classList.toggle("past",p);if(p)cur_i=i;d.classList.remove("current");});
  if(cur_i>=0){const d=document.getElementById("ev"+cur_i);d.classList.add("current");
    d.scrollIntoView({block:"nearest"});}
}
slider.oninput=()=>setTime(+slider.value);

let playing=false,timer=null;
const playBtn=document.getElementById("play");
playBtn.onclick=()=>{playing=!playing;playBtn.textContent=playing?"⏸":"▶";
  if(playing){timer=setInterval(()=>{
    const sp=+document.getElementById("speed").value;
    let t=+slider.value+sp/10;
    if(t>=25200){t=25200;playBtn.click();}
    setTime(t);},100);}
  else clearInterval(timer);};

setTime(10015);
</script>
</body>
</html>
"""

SHORT = {
    "ENGINE LOUVAIN 1": "E·LV1", "LADDER LOUVAIN": "L·LV", "MEDIC LOUVAIN": "M·LV",
    "ENGINE SAINT-PIERRE 1": "E·SP1", "GROUP SOUTH": "GRP·S", "ENGINE ENDOUME 1": "E·ED1",
    "MEDIC SAINT-PIERRE": "M·SP", "ENGINE CANEBIERE 1": "E·CB1", "LADDER SAINT-PIERRE": "L·SP",
    "COLUMN 1": "COL·1", "MEDIC ENDOUME": "M·ED", "GROUP NORTH": "GRP·N",
    "COMMAND POST": "PC", "AIR SUPPORT": "AIR", "SMUR 1": "SMUR", "MEDICAL 1": "DSM",
}

import math
mx = 111320 * math.cos(math.radians(43.278230))
html = (HTML
        .replace("__UNITS__", json.dumps(units, ensure_ascii=False))
        .replace("__VICTIMS__", json.dumps(victims, ensure_ascii=False))
        .replace("__OVERLAY__", json.dumps(overlay, ensure_ascii=False))
        .replace("__EVENTS__", json.dumps(EVENTS, ensure_ascii=False))
        .replace("__SHORT__", json.dumps(SHORT, ensure_ascii=False))
        .replace("__MX__", f"{mx:.2f}"))
OUT.write_text(html, encoding="utf-8")
print(f"interactive_map.html written ({len(html)/1024:.0f} KB)")
