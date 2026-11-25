"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { TopBar } from "@/components/Sidebar";
import { EmptyParcels, Notice } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { boundsOf, centerOf } from "@/lib/geo";
import { cropById } from "@/lib/agro";
import { ha, nf } from "@/lib/format";
import { bboxSizeM, fetchIgnDem, padBBox, sample, type Dem } from "@/lib/dem";
import { analyse, contourLines, contourStep, exitPoints, maskOf, poolPolygons, stats, streams, type Hydro } from "@/lib/hydro";
import { setDemLayers } from "@/lib/demTiles";
import { CRS, buildModel, guessCrs, loadModel, modelDem, parseCad, saveModel, type CadData, type CadModel, type CrsId } from "@/lib/cad";
import { TIME_SCALE, WaterSim } from "@/lib/flow";

const FarmMap = dynamic(() => import("@/components/FarmMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-noche" /> });

const EMPTY = { type: "FeatureCollection" as const, features: [] };

export default function TerrenoPage() {
  return (
    <Suspense fallback={<TopBar title="Terreno 3D" />}>
      <Terreno />
    </Suspense>
  );
}

type Analysis = {
  dem: Dem;
  hy: Hydro;
  step: number;
  contours: GeoJSON.FeatureCollection;
  streams: GeoJSON.FeatureCollection;
  pools: GeoJSON.FeatureCollection;
  stats: ReturnType<typeof stats>;
  spawn: Int32Array;
};

function Terreno() {
  const hyd = useHydrated();
  const params = useSearchParams();
  const { parcels } = useStore();
  const [focus, setFocus] = useState<string>("");
  const [ex, setEx] = useState(2);
  const [sigpac, setSigpac] = useState(false);
  const [fit, setFit] = useState<{ bounds: [number, number, number, number]; key: number } | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  // Relieve
  const [ign, setIgn] = useState<{ dem: Dem | null; error: string | null; loading: boolean }>({ dem: null, error: null, loading: false });
  const [model, setModel] = useState<CadModel | null>(null);
  const [src, setSrc] = useState<"ign" | "cad">("ign");
  const [align, setAlign] = useState(true);
  const [cad, setCad] = useState<CadData | null>(null);
  const [crs, setCrs] = useState<CrsId>("EPSG:25830");
  const [pickLayers, setPickLayers] = useState<string[]>([]);
  const [cadErr, setCadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Capas y simulación
  const [showContours, setShowContours] = useState(true);
  const [showStreams, setShowStreams] = useState(true);
  const [showPools, setShowPools] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<"lluvia" | "punto">("lluvia");
  const [point, setPoint] = useState<[number, number] | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sim = useRef<WaterSim | null>(null);

  useEffect(() => {
    const pid = params.get("parcela");
    if (hyd && pid) setFocus(pid);
  }, [hyd, params]);

  useEffect(() => {
    loadModel().then((m) => {
      if (m) {
        setModel(m);
        setSrc("cad");
      }
    });
  }, []);

  const sel = useMemo(() => parcels.filter((x) => !focus || x.id === focus), [parcels, focus]);
  const selKey = sel.map((p) => p.id).join(",");

  useEffect(() => {
    if (!hyd) return;
    const bb = boundsOf(sel);
    if (bb) setFit({ bounds: bb, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, hyd]);

  // MDT del IGN para la zona elegida
  useEffect(() => {
    if (!hyd) return;
    const bb = boundsOf(sel);
    if (!bb) return;
    const big = padBBox(bb);
    const [wm, hm] = bboxSizeM(big);
    if (Math.max(wm, hm) > 15000) {
      setIgn({ dem: null, error: "las parcelas están demasiado separadas para analizarlas juntas: elige una parcela", loading: false });
      return;
    }
    let alive = true;
    setIgn((s) => ({ ...s, error: null, loading: true }));
    fetchIgnDem(big)
      .then((dem) => alive && setIgn({ dem, error: null, loading: false }))
      .catch((e) => alive && setIgn({ dem: null, error: String(e.message || e), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, hyd]);

  const cadRaw = useMemo(() => (model ? modelDem(model) : null), [model]);

  // Desfase de cotas entre el plano y el IGN (planos con cotas relativas)
  const offset = useMemo(() => {
    if (!cadRaw || !ign.dem) return 0;
    const diffs: number[] = [];
    const stepI = Math.max(1, Math.floor(cadRaw.w / 60)), stepJ = Math.max(1, Math.floor(cadRaw.h / 60));
    for (let j = 0; j < cadRaw.h; j += stepJ)
      for (let i = 0; i < cadRaw.w; i += stepI) {
        const v = cadRaw.z[j * cadRaw.w + i];
        if (Number.isNaN(v)) continue;
        const [lng, lat] = cadRaw.toLngLat(i + 0.5, j + 0.5);
        const [x, y] = ign.dem.fromLngLat(lng, lat);
        const g = sample(ign.dem, x, y);
        if (!Number.isNaN(g)) diffs.push(g - v);
      }
    if (diffs.length < 10) return 0;
    diffs.sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)];
  }, [cadRaw, ign.dem]);
  const useOffset = align && Math.abs(offset) > 2 ? offset : 0;
  // Plano con las cotas ya ajustadas (curvas, estadísticas y relieve 3D con la misma referencia)
  const cadDem = useMemo(() => (cadRaw && useOffset ? { ...cadRaw, z: cadRaw.z.map((v) => v + useOffset) } : cadRaw), [cadRaw, useOffset]);

  const active = src === "cad" && cadDem ? cadDem : ign.dem;

  // Teselas de relieve: plano > IGN > relieve global
  const demTiles = useMemo(() => {
    const list: { dem: Dem; offset: number }[] = [];
    if (cadDem) list.push({ dem: cadDem, offset: 0 });
    if (ign.dem) list.push({ dem: ign.dem, offset: 0 });
    return list.length ? setDemLayers(list) : null;
  }, [cadDem, ign.dem]);

  // Análisis hidrológico
  const [an, setAn] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  useEffect(() => {
    if (!active) {
      setAn(null);
      return;
    }
    setAnalysing(true);
    const t = setTimeout(() => {
      const dem = active;
      const hy = analyse(dem);
      let lo = Infinity, hi = -Infinity;
      for (const v of dem.z) if (!Number.isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
      const step = contourStep(hi - lo);
      const mask = maskOf(dem, sel.map((p) => p.geometry));
      const cells: number[] = [];
      for (let i = 0; i < mask.length; i++) if (mask[i] && !Number.isNaN(dem.z[i])) cells.push(i);
      const valid = dem.w * dem.h;
      setAn({
        dem, hy, step,
        contours: contourLines(dem, step),
        streams: streams(dem, hy, Math.max(Math.round(2500 / (dem.cellM[0] * dem.cellM[1])), Math.round(valid / 300))),
        pools: poolPolygons(dem, hy),
        stats: stats(dem, hy, mask),
        spawn: Int32Array.from(cells),
      });
      setAnalysing(false);
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selKey]);

  // Capas del mapa
  useEffect(() => {
    if (!map) return;
    const add = (id: string, data: GeoJSON.FeatureCollection, extra: Record<string, unknown> = {}) => {
      const s = map.getSource(id) as GeoJSONSource | undefined;
      if (s) s.setData(data);
      else map.addSource(id, { type: "geojson", data, ...extra });
    };
    add("t-pools", an?.pools ?? EMPTY);
    add("t-contours", an?.contours ?? EMPTY);
    add("t-streams", an?.streams ?? EMPTY);
    add("t-exits", exitPoints(an?.stats ?? null));
    add("t-water-trail", EMPTY, { lineMetrics: true });
    add("t-water-head", EMPTY);
    add("t-source", point ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: point } }] } : EMPTY);
    const layer = (spec: maplibregl.LayerSpecification) => {
      if (!map.getLayer(spec.id)) map.addLayer(spec);
    };
    layer({ id: "t-pools", type: "fill", source: "t-pools", paint: { "fill-color": ["interpolate", ["linear"], ["get", "depth"], 0.05, "#5DB4EA", 0.5, "#1E5E9A"], "fill-opacity": 0.55 } });
    layer({ id: "t-contours", type: "line", source: "t-contours", paint: { "line-color": "#FBF1D6", "line-opacity": ["case", ["get", "master"], 0.9, 0.5], "line-width": ["case", ["get", "master"], 1.5, 0.7] } });
    layer({
      id: "t-contour-labels", type: "symbol", source: "t-contours", filter: ["==", ["get", "master"], true],
      layout: { "symbol-placement": "line", "symbol-spacing": 320, "text-field": ["number-format", ["get", "z"], { "max-fraction-digits": 1 }], "text-font": ["Open Sans Semibold"], "text-size": 11, "text-keep-upright": true },
      paint: { "text-color": "#FBF1D6", "text-halo-color": "rgba(20,32,26,0.85)", "text-halo-width": 1.4 },
    });
    layer({ id: "t-streams", type: "line", source: "t-streams", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#62C1F0", "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["ln", ["get", "acc"]], 4, 0.8, 11, 5] } });
    layer({ id: "t-water-trail", type: "line", source: "t-water-trail", layout: { "line-cap": "round" }, paint: { "line-width": 1.8, "line-opacity": ["*", 0.9, ["get", "o"]], "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "rgba(120,200,250,0)", 1, "rgba(190,232,255,0.95)"] } });
    layer({ id: "t-water-head", type: "circle", source: "t-water-head", paint: { "circle-radius": ["case", ["==", ["get", "s"], 1], 2.2, 1.6], "circle-color": ["case", ["==", ["get", "s"], 1], "#6FBFF0", "#D6F1FF"], "circle-opacity": ["*", 0.9, ["get", "o"]], "circle-pitch-alignment": "map" } });
    layer({ id: "t-exits", type: "circle", source: "t-exits", paint: { "circle-radius": 9, "circle-color": ["case", ["get", "pool"], "#1E5E9A", "#B4532A"], "circle-stroke-color": "#fff", "circle-stroke-width": 2, "circle-pitch-alignment": "map" } });
    layer({ id: "t-exits-label", type: "symbol", source: "t-exits", layout: { "text-field": ["get", "label"], "text-font": ["Open Sans Semibold"], "text-size": 12, "text-offset": [0, -1.6] }, paint: { "text-color": "#fff", "text-halo-color": "rgba(20,32,26,0.9)", "text-halo-width": 1.6 } });
    layer({ id: "t-source", type: "circle", source: "t-source", paint: { "circle-radius": 8, "circle-color": "#1E6AA0", "circle-stroke-color": "#fff", "circle-stroke-width": 3, "circle-pitch-alignment": "map" } });
    map.setLayoutProperty("t-contours", "visibility", showContours ? "visible" : "none");
    map.setLayoutProperty("t-contour-labels", "visibility", showContours ? "visible" : "none");
    map.setLayoutProperty("t-streams", "visibility", showStreams ? "visible" : "none");
    map.setLayoutProperty("t-pools", "visibility", showPools ? "visible" : "none");
  }, [map, an, showContours, showStreams, showPools, point]);

  // Clic para soltar agua en un punto
  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (modeRef.current === "punto") setPoint([e.lngLat.lng, e.lngLat.lat]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = mode === "punto" ? "crosshair" : "";
  }, [map, mode]);

  // Simulación del agua
  useEffect(() => {
    sim.current?.clear();
    sim.current = null;
    if (!map || !an) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const areaHa = (an.spawn.length * an.dem.cellM[0] * an.dem.cellM[1]) / 10000;
    const n = Math.round(Math.min(900, Math.max(160, areaHa * 500)));
    const s = new WaterSim(map, an.dem, an.hy, an.spawn, reduce ? Math.round(n / 3) : n);
    sim.current = s;
    return () => s.clear();
  }, [map, an]);
  useEffect(() => {
    const s = sim.current;
    if (!s) return;
    s.setSource(mode === "punto" ? point : null);
    if (playing && (mode === "lluvia" || point)) s.start();
    else if (mode === "punto" && !point) s.clear();
    else s.stop();
  }, [playing, mode, point, an]);

  // Importar plano
  async function onFile(f: File) {
    setCadErr(null);
    setBusy(true);
    try {
      const text = await f.text();
      const data = parseCad(f.name, text);
      setCad(data);
      setPickLayers(data.layers.map((l) => l.name));
      const c = sel[0] ? centerOf(sel[0].geometry) : [-3.7, 40];
      setCrs(guessCrs(c[0]));
    } catch (e) {
      setCadErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function build() {
    if (!cad) return;
    setBusy(true);
    setCadErr(null);
    setTimeout(() => {
      try {
        const m = buildModel(cad, crs, pickLayers);
        setModel(m);
        setSrc("cad");
        setCad(null);
        saveModel(m);
      } catch (e) {
        setCadErr(String((e as Error).message || e));
      } finally {
        setBusy(false);
      }
    }, 20);
  }
  function removeModel() {
    setModel(null);
    setSrc("ign");
    saveModel(null);
  }

  if (!hyd) return <TopBar title="Terreno 3D" />;
  if (!parcels.length) return (<><TopBar title="Terreno 3D" /><EmptyParcels what="tu terreno en 3D" /></>);

  const p = parcels.find((x) => x.id === focus);
  const b = boundsOf(parcels);
  const st = an?.stats ?? null;
  const farFromFarm = cadDem && b ? distKm(cadDem.bounds, b) : 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:block">
      <div className="relative h-[62vh] min-h-[460px] overflow-hidden bg-noche lg:absolute lg:inset-0 lg:h-auto">
        <FarmMap
          parcels={parcels}
          selectedId={focus || null}
          showSigpac={sigpac}
          terrain={ex}
          demTiles={demTiles}
          fitTo={fit}
          onReady={setMap}
          padding={{ top: 90, right: 420, bottom: 24, left: 24 }}
          initialView={!focus && b ? { center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], zoom: 14.5 } : null}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-noche/50 to-transparent" />
        <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 rounded-xl bg-noche/80 px-3.5 py-2 text-[13px] text-white backdrop-blur lg:block lg:left-[calc(50%-200px)]">
          {mode === "punto" ? (point ? "Clic en otro sitio para mover el punto de riego" : "Haz clic en el terreno donde sale el agua") : "Gira con clic derecho o Ctrl + arrastrar"}
        </div>
        {(ign.loading || analysing) && (
          <div className="absolute top-24 left-6 flex items-center gap-2.5 rounded-xl bg-noche/85 px-3.5 py-2 text-[13px] text-white backdrop-blur">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {ign.loading ? "Descargando el LiDAR del IGN…" : "Calculando por dónde corre el agua…"}
          </div>
        )}
      </div>

      <div className="lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:[&>*]:pointer-events-auto">
        <TopBar title="Terreno 3D">
          <select className="input h-10 w-auto font-semibold" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Parcela">
            <option value="">Toda la finca</option>
            {parcels.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className={`btn btn-sm ${sigpac ? "btn-primary" : "btn-ghost"}`} aria-pressed={sigpac} onClick={() => setSigpac(!sigpac)}>Recintos SIGPAC</button>
          <div className="flex-1" />
          <label className="flex items-center gap-2.5 pr-2 text-sm font-semibold text-tinta-2">Relieve
            <input type="range" min={1} max={5} step={0.5} value={ex} onChange={(e) => setEx(Number(e.target.value))} className="w-32 accent-olivo" aria-label="Exagerar relieve" />
            <span className="num w-8">×{ex}</span>
          </label>
        </TopBar>
      </div>

      <section aria-label="Datos del terreno" className="flex animate-rise flex-col gap-4 bg-white p-5 lg:absolute lg:top-[84px] lg:right-4 lg:bottom-4 lg:w-[390px] lg:overflow-y-auto lg:rounded-[22px] lg:border lg:border-linea/80 lg:shadow-[var(--shadow-float)]">
        <div>
          <span className="kpi-label">{p ? "Parcela" : "Toda la finca"}</span>
          <h2 className="font-display text-[26px] leading-tight font-semibold">{p ? p.name : `${parcels.length} parcela${parcels.length === 1 ? "" : "s"}`}</h2>
          {p && <span className="text-sm text-tinta-3">{cropById(p.cropId).name} · {ha(p.areaHa)}</span>}
        </div>

        {/* Fuente del relieve */}
        <div className="flex flex-col gap-2">
          <div role="radiogroup" aria-label="Relieve" className="flex rounded-xl bg-rastrojo p-1">
            {([["ign", "LiDAR del IGN"], ["cad", "Mi plano"]] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={src === id} disabled={id === "cad" && !model} onClick={() => setSrc(id)}
                className={`h-8 flex-1 rounded-lg text-[13.5px] font-semibold transition-colors disabled:opacity-40 ${src === id ? "bg-white text-tinta shadow-[0_1px_3px_oklch(0.2_0.02_155/0.15)]" : "text-tinta-2 hover:text-tinta"}`}>{label}</button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept=".dxf,.xml,.landxml" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>{model ? "Cambiar plano" : "Cargar plano de AutoCAD"}</button>
            {model && <button className="text-[13px] font-semibold text-tinta-3 underline" onClick={removeModel}>Quitar</button>}
            <span className="text-xs text-tinta-3">DXF o LandXML</span>
          </div>
          {cadErr && <Notice>{cadErr}</Notice>}
          {model && src === "cad" && (
            <div className="flex flex-col gap-1.5 text-[13px] text-tinta-2">
              <span>{cadDem?.source}</span>
              {farFromFarm > 3 && <Notice>El plano cae a {nf(farFromFarm, 0)} km de tus parcelas: revisa el sistema de coordenadas al cargarlo.</Notice>}
              {Math.abs(offset) > 2 && (
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-olivo" checked={align} onChange={(e) => setAlign(e.target.checked)} />
                  <span>Las cotas del plano están {nf(Math.abs(offset), 1)} m {offset > 0 ? "por debajo" : "por encima"} del IGN (¿cotas relativas?). Ajustarlas al terreno real.</span></label>
              )}
            </div>
          )}
        </div>

        {cad && (
          <fieldset className="flex flex-col gap-3 rounded-xl border border-acequia/40 bg-acequia/5 p-3">
            <legend className="px-1 text-xs font-bold tracking-wide text-acequia">{cad.format} · {cad.file}</legend>
            <label className="label">Sistema de coordenadas del plano
              <select className="input" value={crs} onChange={(e) => setCrs(e.target.value as CrsId)}>
                {CRS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {cad.fromText && <p className="text-[13px] text-tinta-2">El plano es 2D: se usan las cotas escritas como texto.</p>}
            {!cad.faces && (
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-tinta-2">Capas con cotas</span>
                {cad.layers.map((l) => (
                  <label key={l.name} className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" className="h-4 w-4 accent-olivo" checked={pickLayers.includes(l.name)}
                      onChange={(e) => setPickLayers(e.target.checked ? [...pickLayers, l.name] : pickLayers.filter((x) => x !== l.name))} />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className="num text-tinta-3">{l.withZ.toLocaleString("es-ES")} ptos</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={build} disabled={busy || (!cad.faces && !pickLayers.length)}>{busy ? "Generando…" : "Generar superficie"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCad(null)}>Cancelar</button>
            </div>
          </fieldset>
        )}

        {ign.error && src === "ign" && <Notice>No se ha podido cargar el relieve: {ign.error}.</Notice>}

        {/* Agua */}
        <div className="flex flex-col gap-2 rounded-xl border border-linea p-3">
          <div className="flex items-center gap-2">
            <b className="flex-1 text-sm">Agua sobre el terreno</b>
            <button className="btn btn-sm btn-primary" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pausa" : "Reproducir"}</button>
          </div>
          <div role="radiogroup" aria-label="Origen del agua" className="flex rounded-xl bg-rastrojo p-1">
            {([["lluvia", "Lluvia"], ["punto", "Punto de riego"]] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
                className={`h-8 flex-1 rounded-lg text-[13px] font-semibold ${mode === id ? "bg-white text-tinta shadow-[0_1px_3px_oklch(0.2_0.02_155/0.15)]" : "text-tinta-2"}`}>{label}</button>
            ))}
          </div>
          <span className="text-xs text-tinta-3">{mode === "lluvia" ? "Llueve sobre " + (p ? "la parcela" : "tus parcelas") : point ? "El agua sale del punto marcado" : "Marca en el mapa la boca de riego, hidrante o cabecera"} · 1 s de animación = {TIME_SCALE / 60} min</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[13px]">
            <Toggle on={showContours} set={setShowContours} label={`Curvas de nivel${an ? ` (${nf(an.step, an.step < 1 ? 2 : 0)} m)` : ""}`} />
            <Toggle on={showStreams} set={setShowStreams} label="Escorrentía" />
            <Toggle on={showPools} set={setShowPools} label="Encharcamientos" />
          </div>
        </div>

        {/* Resultados */}
        {an && !st && <Notice tone="mute">{an.dem.kind === "cad" ? "El plano no cubre la parcela elegida." : "No hay datos de relieve dentro de la parcela."}</Notice>}
        {st && (
          <>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-tinta-3">Cota mínima · máxima</dt><dd className="num text-right">{nf(st.zMin, 1)} · {nf(st.zMax, 1)} m</dd>
              <dt className="text-tinta-3">Desnivel</dt><dd className="num text-right">{nf(st.zMax - st.zMin, 1)} m</dd>
              <dt className="text-tinta-3">Pendiente media</dt><dd className="num text-right">{nf(st.slopeMean, 1)} %</dd>
              <dt className="text-tinta-3">Zonas más inclinadas</dt><dd className="num text-right">{nf(st.slopeP90, 1)} %</dd>
              <dt className="text-tinta-3">El terreno cae hacia</dt><dd className="text-right">{st.aspect ?? "llano"}</dd>
            </dl>
            <div className="flex flex-col gap-1.5">
              <b className="kpi-label">Por dónde sale el agua</b>
              {st.exits.map((e, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span className={`h-3 w-3 rounded-full ${e.pool ? "bg-[#1E5E9A]" : "bg-[#B4532A]"}`} />
                  <span className="flex-1">{e.pool ? "Se queda en una charca" : `Salida ${i + 1}`}</span>
                  <span className="num text-tinta-2">{Math.round(e.share * 100)} % · {ha(e.ha)}</span>
                </div>
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-tinta-3">Zonas encharcables</dt><dd className="num text-right">{st.pools.n ? `${st.pools.n} · ${nf(st.pools.areaM2, 0)} m²` : "ninguna"}</dd>
              {st.pools.n > 0 && (<><dt className="text-tinta-3">Agua retenida</dt><dd className="num text-right">{nf(st.pools.volM3, 0)} m³ · hasta {nf(st.pools.maxDepth * 100, 0)} cm</dd></>)}
            </dl>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-relaxed text-tinta-2">
              {readings(st).map((r) => <li key={r}>{r}</li>)}
            </ul>
          </>
        )}
        <p className="text-xs leading-relaxed text-tinta-3">
          {an ? an.dem.source : "Relieve"}. Escorrentía por la dirección de máxima pendiente (D8) tras rellenar los hoyos del terreno (Priority-Flood). Fuera de la zona analizada, relieve global Terrain Tiles. Ortofoto PNOA © IGN.
        </p>
      </section>
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" className="h-4 w-4 accent-olivo" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

/** Lectura práctica de los resultados para el riego y el manejo del suelo. */
function readings(st: NonNullable<ReturnType<typeof stats>>): string[] {
  const out: string[] = [];
  const s = st.slopeMean;
  if (s < 0.5) out.push("Terreno casi llano: el riego por superficie necesita nivelación láser y el agua tiende a quedarse.");
  else if (s < 2) out.push("Pendiente suave: válida para riego por surcos o a manta en el sentido de la pendiente.");
  else if (s < 5) out.push("Pendiente moderada: mejor goteo o aspersión; en goteo, laterales siguiendo las curvas de nivel.");
  else out.push(`Pendiente fuerte (${nf(s, 1)} %): goteros autocompensantes, laterales por curva de nivel y cuidado con la erosión.`);
  const main = st.exits.find((e) => !e.pool);
  if (main && main.share > 0.4) out.push(`El ${Math.round(main.share * 100)} % del agua sale por un mismo punto (salida 1): buen sitio para un desagüe, una franja de hierba o una balsa.`);
  if (st.pools.n) out.push(`Hay ${st.pools.n} zona${st.pools.n > 1 ? "s" : ""} donde se junta el agua: riesgo de asfixia radicular; conviene drenar o nivelar.`);
  return out;
}

function distKm(a: [number, number, number, number], b: [number, number, number, number]) {
  const ca = [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2], cb = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  return Math.hypot((ca[0] - cb[0]) * 111.32 * Math.cos((ca[1] * Math.PI) / 180), (ca[1] - cb[1]) * 110.54);
}
