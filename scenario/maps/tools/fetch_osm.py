"""Fetch real OpenStreetMap data around the incident site (167 avenue du Prado, Marseille).

Downloads buildings, streets, fire hydrants and BMPM fire stations from the
Overpass API and stores the raw response as osm_raw.json (not committed - large).
Run build_geodata.py afterwards to produce the compact site.geojson used by the
scenario maps.

Data source: OpenStreetMap contributors, ODbL 1.0 - https://www.openstreetmap.org/copyright
"""
import urllib.request
import urllib.parse
import pathlib

CENTER = (43.2785, 5.3890)  # avenue du Prado, Marseille 8e

QUERY = f"""
[out:json][timeout:120];
(
  way["building"](around:350,{CENTER[0]},{CENTER[1]});
  way["highway"](around:450,{CENTER[0]},{CENTER[1]});
  node["emergency"="fire_hydrant"](around:600,{CENTER[0]},{CENTER[1]});
  nwr["amenity"="fire_station"](around:4500,{CENTER[0]},{CENTER[1]});
);
out body geom;
"""

def main(out_path="osm_raw.json"):
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": "AthenaScenario/0.1 (crisis-management demo dataset)"},
    )
    raw = urllib.request.urlopen(req, timeout=180).read()
    pathlib.Path(out_path).write_bytes(raw)
    print(f"saved {len(raw)/1e6:.1f} MB to {out_path}")

if __name__ == "__main__":
    main()
