"""Build the compact site geodata (site.geojson + site_meta.json) from raw OSM data.

Input : osm_raw.json (produced by fetch_osm.py - raw Overpass response)
Output: ../data/site.geojson   - buildings / streets / hydrants / fire stations near the site
        ../data/site_meta.json - incident site metadata, local metric CRS origin, stations

Local CRS: equirectangular approximation centred on the target building
  x [m] = (lon - lon0) * cos(lat0) * 111320
  y [m] = (lat - lat0) * 110540
Accurate to well under 1 m over the ~500 m scenario extent.

Data source: OpenStreetMap contributors, ODbL 1.0.
All operational overlays (unit positions, victims) are FICTIONAL training data.
"""
import json
import math
import sys
import pathlib

HERE = pathlib.Path(__file__).parent
DATA = HERE.parent / "data"

TARGET_WAY = 154626611          # 167 avenue du Prado / 3 rue Borde - incident building
FACING_WAY = 154633505          # 174 avenue du Prado (witness building, levels=11)
OFFICE_WAY = 154611589          # office building immediately north (night security guard)
ADJACENT_WAY = 154633440        # 165 avenue du Prado, mitoyen north (witness resident)

LAT0, LON0 = 43.27823, 5.38854  # target building centroid (set precisely below)

BUILDING_RADIUS = 260           # m - keep neighbouring buildings within this range
STREET_RADIUS = 320
HYDRANT_RADIUS = 600


def to_local(lat, lon, lat0, lon0):
    x = (lon - lon0) * math.cos(math.radians(lat0)) * 111320.0
    y = (lat - lat0) * 110540.0
    return round(x, 2), round(y, 2)


def haversine(lat1, lon1, lat2, lon2):
    R, p = 6371000, math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def centroid(geom):
    return (sum(g["lat"] for g in geom) / len(geom),
            sum(g["lon"] for g in geom) / len(geom))


def main(raw_path):
    d = json.loads(pathlib.Path(raw_path).read_text(encoding="utf-8"))
    els = d["elements"]
    ways = {e["id"]: e for e in els if e["type"] == "way" and "geometry" in e}

    target = ways[TARGET_WAY]
    lat0, lon0 = centroid(target["geometry"])

    features = []

    def poly_feature(e, role=None):
        lat, lon = centroid(e["geometry"])
        coords = [[g["lon"], g["lat"]] for g in e["geometry"]]
        props = {
            "kind": "building",
            "osm_id": f"way/{e['id']}",
            "building": e["tags"].get("building"),
            "levels": e["tags"].get("building:levels"),
            "dist_m": round(haversine(lat0, lon0, lat, lon), 1),
            "local_centroid": to_local(lat, lon, lat0, lon0),
        }
        if role:
            props["scenario_role"] = role
        return {"type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": props}

    # --- buildings ------------------------------------------------------
    roles = {TARGET_WAY: "incident_building",
             FACING_WAY: "witness_building_174_prado",
             OFFICE_WAY: "witness_office_163_prado",
             ADJACENT_WAY: "witness_adjacent_165_prado"}
    n_buildings = 0
    for e in ways.values():
        t = e.get("tags", {})
        if "building" not in t:
            continue
        lat, lon = centroid(e["geometry"])
        if haversine(lat0, lon0, lat, lon) > BUILDING_RADIUS and e["id"] not in roles:
            continue
        features.append(poly_feature(e, roles.get(e["id"])))
        n_buildings += 1

    # --- streets ---------------------------------------------------------
    n_streets = 0
    for e in ways.values():
        t = e.get("tags", {})
        if "highway" not in t:
            continue
        dmin = min(haversine(lat0, lon0, g["lat"], g["lon"]) for g in e["geometry"])
        if dmin > STREET_RADIUS:
            continue
        coords = [[g["lon"], g["lat"]] for g in e["geometry"]]
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"kind": "street", "osm_id": f"way/{e['id']}",
                           "name": t.get("name"), "highway": t["highway"],
                           "oneway": t.get("oneway"), "lanes": t.get("lanes")},
        })
        n_streets += 1

    # --- hydrants ----------------------------------------------------------
    n_hyd = 0
    for e in els:
        if e["type"] != "node" or e.get("tags", {}).get("emergency") != "fire_hydrant":
            continue
        dm = haversine(lat0, lon0, e["lat"], e["lon"])
        if dm > HYDRANT_RADIUS:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]},
            "properties": {"kind": "fire_hydrant", "osm_id": f"node/{e['id']}",
                           "hydrant_type": e["tags"].get("fire_hydrant:type"),
                           "dist_m": round(dm, 1),
                           "local": to_local(e["lat"], e["lon"], lat0, lon0)},
        })
        n_hyd += 1

    # --- fire stations -------------------------------------------------------
    stations = []
    for e in els:
        t = e.get("tags", {})
        if t.get("amenity") != "fire_station":
            continue
        if "geometry" in e:
            lat, lon = centroid(e["geometry"])
        elif "lat" in e:
            lat, lon = e["lat"], e["lon"]
        else:
            continue
        dm = haversine(lat0, lon0, lat, lon)
        st = {"name": t.get("name", "unnamed"), "operator": t.get("operator"),
              "lat": round(lat, 6), "lon": round(lon, 6),
              "dist_line_m": round(dm), "osm_id": f"{e['type']}/{e['id']}"}
        stations.append(st)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {"kind": "fire_station", **st},
        })
    stations.sort(key=lambda s: s["dist_line_m"])

    fc = {"type": "FeatureCollection",
          "name": "athena_scenario_site_prado_marseille",
          "attribution": "Map data (c) OpenStreetMap contributors, ODbL 1.0",
          "features": features}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "site.geojson").write_text(
        json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    tgt_coords = [[g["lon"], g["lat"]] for g in target["geometry"]]
    meta = {
        "incident_address": "167 avenue du Prado / 3 rue Borde, 13008 Marseille, France",
        "incident_building": {
            "osm_id": f"way/{TARGET_WAY}",
            "centroid": {"lat": round(lat0, 6), "lon": round(lon0, 6)},
            "levels_osm": target["tags"].get("building:levels"),
            "footprint_wgs84": tgt_coords,
            "footprint_local_m": [to_local(la, lo, lat0, lon0)
                                  for lo, la in [(c[0], c[1]) for c in tgt_coords]],
        },
        "local_crs": {
            "origin": {"lat": round(lat0, 6), "lon": round(lon0, 6)},
            "formula": "x=(lon-lon0)*cos(lat0)*111320 ; y=(lat-lat0)*110540 (metres)",
        },
        "fire_stations": stations,
        "counts": {"buildings": n_buildings, "streets": n_streets, "hydrants": n_hyd,
                   "stations": len(stations)},
    }
    (DATA / "site_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"site.geojson: {n_buildings} buildings, {n_streets} street segments, "
          f"{n_hyd} hydrants, {len(stations)} stations")
    print(f"origin (target centroid): {lat0:.6f}, {lon0:.6f}")
    print("target footprint (local m):", meta["incident_building"]["footprint_local_m"])
    for s in stations[:5]:
        print(f"  station: {s['name']}  {s['dist_line_m']} m")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "osm_raw.json")
