"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MultiPolygon, Polygon } from "geojson";
import type { Parcel, SigpacRef } from "@/lib/types";
import { cropById } from "@/lib/crops";
import { centerOf, mergePolygons, boundsOf } from "@/lib/geo";

const PNOA =
  "https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}";
const IGNBASE =
  "https://www.ign.es/wmts/ign-base?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=IGNBaseTodo&Style=default&Format=image/png&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}";
const SIGPAC = "https://sigpac-hubcloud.es/mvt/recinto@3857@pbf/{z}/{x}/{y}.pbf";
const DEM = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";

export type SigpacPick = {
  ref: SigpacRef;
  uso: string | null;
  areaHa: number;
  slopePct: number | null;
  altitudeM: number | null;
  coefRegadio: number | null;
  geometry: Polygon | MultiPolygon;
};

type Props = {
  parcels: Parcel[];
  selectedId?: string | null;
  highlightIds?: string[];
  base?: "pnoa" | "ign";
  showSigpac?: boolean;
  interactive?: boolean;
  terrain?: number | null; // exageración del relieve; null = mapa plano
  drawing?: boolean;
  drawPoints?: [number, number][];
  pick?: SigpacPick | null;
  fitKey?: number; // al cambiar, encuadra todas las parcelas
  flyTo?: { center: [number, number]; zoom: number; key: number } | null;
  initialView?: { center: [number, number]; zoom: number } | null;
  onSelect?: (id: string | null) => void;
  onPickSigpac?: (p: SigpacPick | null) => void;
  onDrawPoint?: (pt: [number, number]) => void;
  onDrawFinish?: () => void;
  onViewChange?: (v: { center: [number, number]; zoom: number }) => void;
  onZoomChange?: (z: number) => void;
  className?: string;
};

const SIGPAC_KEYS = ["provincia", "municipio", "agregado", "zona", "poligono", "parcela", "recinto"] as const;

function parcelsFC(parcels: Parcel[], selectedId?: string | null, highlightIds?: string[]) {
  return {
    type: "FeatureCollection" as const,
    features: parcels.map((p) => ({
      type: "Feature" as const,
      geometry: p.geometry,
      properties: {
        id: p.id,
        name: p.name,
        color: p.color ?? cropById(p.cropId).color,
        selected: p.id === selectedId || (highlightIds?.includes(p.id) ?? false),
      },
    })),
  };
}

function drawFC(pts: [number, number][]) {
  const features: GeoJSON.Feature[] = pts.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} }));
  if (pts.length >= 2) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: pts.length >= 3 ? [...pts, pts[0]] : pts }, properties: {} });
  if (pts.length >= 3) features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] }, properties: {} });
  return { type: "FeatureCollection" as const, features };
}

function pickFC(p: SigpacPick | null | undefined) {
  return { type: "FeatureCollection" as const, features: p ? [{ type: "Feature" as const, geometry: p.geometry, properties: {} }] : [] };
}

export default function FarmMap(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const cb = useRef(props);
  cb.current = props;
  const ready = useRef(false);

  // Creación del mapa (una sola vez)
  useEffect(() => {
    if (!box.current) return;
    const p = cb.current;
    const b = boundsOf(p.parcels);
    const map = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          pnoa: { type: "raster", tiles: [PNOA], tileSize: 256, maxzoom: 19, attribution: "Ortofoto PNOA © Instituto Geográfico Nacional" },
          ign: { type: "raster", tiles: [IGNBASE], tileSize: 256, maxzoom: 18, attribution: "Mapa base © Instituto Geográfico Nacional" },
          sigpac: { type: "vector", tiles: [SIGPAC], minzoom: 12, maxzoom: 15, attribution: "SIGPAC © FEGA (CC BY 4.0)" },
          parcels: { type: "geojson", data: parcelsFC(p.parcels, p.selectedId, p.highlightIds) },
          pick: { type: "geojson", data: pickFC(p.pick) },
          draw: { type: "geojson", data: drawFC(p.drawPoints ?? []) },
        },
        layers: [
          { id: "pnoa", type: "raster", source: "pnoa", layout: { visibility: p.base === "ign" ? "none" : "visible" } },
          { id: "ign", type: "raster", source: "ign", layout: { visibility: p.base === "ign" ? "visible" : "none" } },
          { id: "sigpac-fill", type: "fill", source: "sigpac", "source-layer": "recinto", minzoom: 13, paint: { "fill-color": "#ffffff", "fill-opacity": 0.01 }, layout: { visibility: p.showSigpac === false ? "none" : "visible" } },
          { id: "sigpac-line", type: "line", source: "sigpac", "source-layer": "recinto", minzoom: 13, paint: { "line-color": "#FFE27A", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.6, 17, 1.6] }, layout: { visibility: p.showSigpac === false ? "none" : "visible" } },
          { id: "sigpac-hover", type: "line", source: "sigpac", "source-layer": "recinto", minzoom: 13, filter: ["==", ["get", "provincia"], -1], paint: { "line-color": "#FFFFFF", "line-width": 3 } },
          { id: "parcels-fill", type: "fill", source: "parcels", paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "selected"], 0.42, 0.26] } },
          { id: "parcels-line", type: "line", source: "parcels", paint: { "line-color": "#FFFFFF", "line-width": ["case", ["get", "selected"], 4, 2] } },
          { id: "parcels-sel", type: "line", source: "parcels", filter: ["==", ["get", "selected"], true], paint: { "line-color": "#1E6AA0", "line-width": 1.6, "line-dasharray": [3, 2] } },
          { id: "pick-fill", type: "fill", source: "pick", paint: { "fill-color": "#D9A21B", "fill-opacity": 0.3 } },
          { id: "pick-line", type: "line", source: "pick", paint: { "line-color": "#FFFFFF", "line-width": 4 } },
          { id: "draw-fill", type: "fill", source: "draw", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#1E6AA0", "fill-opacity": 0.25 } },
          { id: "draw-line", type: "line", source: "draw", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#FFFFFF", "line-width": 2.5, "line-dasharray": [2, 1.5] } },
          { id: "draw-pt", type: "circle", source: "draw", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#FFFFFF", "circle-stroke-color": "#1E6AA0", "circle-stroke-width": 2 } },
        ],
      },
      center: p.initialView?.center ?? [-3.7, 40.2],
      zoom: p.initialView?.zoom ?? 5.4,
      maxPitch: 80,
      attributionControl: { compact: true },
      interactive: p.interactive !== false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    map.on("load", () => {
      ready.current = true;
      if (!p.initialView && b) map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 16 });
      applyTerrain(map, cb.current.terrain ?? null);
      renderMarkers();
      cb.current.onZoomChange?.(map.getZoom());
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      cb.current.onViewChange?.({ center: [c.lng, c.lat], zoom: map.getZoom() });
    });
    map.on("zoom", () => cb.current.onZoomChange?.(map.getZoom()));

    map.on("mousemove", (e) => {
      const c = cb.current;
      if (c.drawing) {
        map.getCanvas().style.cursor = "crosshair";
        return;
      }
      const own = map.queryRenderedFeatures(e.point, { layers: ["parcels-fill"] });
      if (own.length) {
        map.getCanvas().style.cursor = "pointer";
        map.setFilter("sigpac-hover", ["==", ["get", "provincia"], -1]);
        return;
      }
      const f = c.showSigpac !== false && map.getZoom() >= 13 ? map.queryRenderedFeatures(e.point, { layers: ["sigpac-fill"] })[0] : undefined;
      map.getCanvas().style.cursor = f ? "pointer" : "";
      map.setFilter("sigpac-hover", f ? sigpacFilter(f) : ["==", ["get", "provincia"], -1]);
    });

    map.on("click", (e) => {
      const c = cb.current;
      if (c.drawing) {
        c.onDrawPoint?.([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      const own = map.queryRenderedFeatures(e.point, { layers: ["parcels-fill"] })[0];
      if (own) {
        c.onPickSigpac?.(null);
        c.onSelect?.(String(own.properties.id));
        return;
      }
      if (c.showSigpac !== false && map.getZoom() >= 13) {
        const f = map.queryRenderedFeatures(e.point, { layers: ["sigpac-fill"] })[0];
        if (f) {
          c.onSelect?.(null);
          c.onPickSigpac?.(buildPick(map, f));
          return;
        }
      }
      c.onSelect?.(null);
      c.onPickSigpac?.(null);
    });

    map.on("dblclick", (e) => {
      if (cb.current.drawing) {
        e.preventDefault();
        cb.current.onDrawFinish?.();
      }
    });

    return () => {
      markers.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, []);

  function renderMarkers() {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    if (cb.current.terrain != null) {
      markers.current = [];
      return;
    }
    markers.current = cb.current.parcels.map((p) => {
      const el = document.createElement("div");
      el.className = "pointer-events-none rounded-md px-2 py-0.5 text-xs font-bold text-white whitespace-nowrap";
      el.style.background = p.id === cb.current.selectedId ? "#1E6AA0" : "rgba(20,32,26,.78)";
      el.textContent = `${p.name} · ${cropById(p.cropId).name}`;
      return new maplibregl.Marker({ element: el }).setLngLat(centerOf(p.geometry)).addTo(map);
    });
  }

  // Datos de parcelas y selección
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("parcels") as GeoJSONSource | undefined)?.setData(parcelsFC(props.parcels, props.selectedId, props.highlightIds));
    renderMarkers();
  }, [props.parcels, props.selectedId, props.highlightIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("pick") as GeoJSONSource | undefined)?.setData(pickFC(props.pick));
  }, [props.pick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("draw") as GeoJSONSource | undefined)?.setData(drawFC(props.drawPoints ?? []));
    if (props.drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [props.drawPoints, props.drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    map.setLayoutProperty("pnoa", "visibility", props.base === "ign" ? "none" : "visible");
    map.setLayoutProperty("ign", "visibility", props.base === "ign" ? "visible" : "none");
  }, [props.base]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const v = props.showSigpac === false ? "none" : "visible";
    ["sigpac-fill", "sigpac-line", "sigpac-hover"].forEach((l) => map.setLayoutProperty(l, "visibility", v));
  }, [props.showSigpac]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    applyTerrain(map, props.terrain ?? null);
  }, [props.terrain]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.fitKey) return;
    const b = boundsOf(cb.current.parcels);
    if (b) map.fitBounds(b, { padding: 60, maxZoom: 16, duration: 800 });
  }, [props.fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.flyTo) return;
    map.flyTo({ center: props.flyTo.center, zoom: props.flyTo.zoom, duration: 1200 });
  }, [props.flyTo]);

  return (
    <div className={props.className ?? "absolute inset-0"}>
      <div ref={box} className="h-full w-full" />
    </div>
  );
}

function sigpacFilter(f: MapGeoJSONFeature): maplibregl.FilterSpecification {
  return ["all", ...SIGPAC_KEYS.map((k) => ["==", ["get", k], f.properties[k]])] as unknown as maplibregl.FilterSpecification;
}

function buildPick(map: maplibregl.Map, f: MapGeoJSONFeature): SigpacPick {
  const pr = f.properties as Record<string, number | string>;
  const parts = map
    .querySourceFeatures("sigpac", { sourceLayer: "recinto", filter: sigpacFilter(f) })
    .map((x) => x.geometry)
    .filter((g): g is Polygon | MultiPolygon => g.type === "Polygon" || g.type === "MultiPolygon");
  const geometry = mergePolygons(parts.length ? parts : [f.geometry as Polygon]) ?? (f.geometry as Polygon);
  const num = (k: string) => (pr[k] == null || pr[k] === "" ? null : Number(pr[k]));
  return {
    ref: {
      provincia: Number(pr.provincia), municipio: Number(pr.municipio), agregado: Number(pr.agregado), zona: Number(pr.zona),
      poligono: Number(pr.poligono), parcela: Number(pr.parcela), recinto: Number(pr.recinto),
    },
    uso: pr.uso_sigpac ? String(pr.uso_sigpac) : null,
    areaHa: Number(pr.superficie || 0) / 10000,
    slopePct: num("pendiente_media") != null ? (num("pendiente_media") as number) / 10 : null,
    altitudeM: num("altitud"),
    coefRegadio: num("coef_regadio"),
    geometry,
  };
}

function applyTerrain(map: maplibregl.Map, ex: number | null) {
  if (ex == null) {
    if (map.getTerrain()) map.setTerrain(null);
    if (map.getLayer("hillshade")) map.removeLayer("hillshade");
    return;
  }
  if (!map.getSource("dem")) {
    map.addSource("dem", { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 15, encoding: "terrarium", attribution: "Relieve: Terrain Tiles (AWS / Mapzen)" });
  }
  if (!map.getSource("dem-shade")) {
    map.addSource("dem-shade", { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 15, encoding: "terrarium" });
  }
  if (!map.getLayer("hillshade")) {
    map.addLayer({ id: "hillshade", type: "hillshade", source: "dem-shade", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#14201A" } }, "sigpac-fill");
  }
  map.setTerrain({ source: "dem", exaggeration: ex });
  if (map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 900 });
}
