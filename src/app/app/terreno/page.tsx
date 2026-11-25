"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/Sidebar";
import { EmptyParcels, Notice } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { boundsOf, centerOf } from "@/lib/geo";
import { cropById } from "@/lib/agro";
import { ha, nf } from "@/lib/format";
import { bboxSizeM, fetchIgnDem, padBBox, sample, type Dem } from "@/lib/dem";
import { analyse, contourLines, contourStep, maskOf, poolPolygons, stats, streams, type Hydro } from "@/lib/hydro";
import type { MaquetaApi } from "@/components/terreno/Maqueta";
import type { Parcel } from "@/lib/types";
import { CRS, buildModel, guessCrs, loadModel, modelDem, parseCad, saveModel, type CadData, type CadModel, type CrsId } from "@/lib/cad";
import { TIME_SCALE } from "@/lib/flow";

const Maqueta = dynamic(() => import("@/components/terreno/Maqueta"), { ssr: false });

/** Agrupa las parcelas en fincas: las que están a menos de ~400 m unas de otras van juntas. */
function fincas(parcels: Parcel[]): Parcel[][] {
  const bb = parcels.map((p) => boundsOf([p])!);
  const parent = parcels.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const gx = 0.0048, gy = 0.0036;
  for (let i = 0; i < parcels.length; i++)
    for (let j = i + 1; j < parcels.length; j++) {
      const a = bb[i], b = bb[j];
      if (a[0] - gx <= b[2] && b[0] - gx <= a[2] && a[1] - gy <= b[3] && b[1] - gy <= a[3]) parent[find(i)] = find(j);
    }
  const groups = new Map<number, Parcel[]>();
  parcels.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
  return [...groups.values()].sort((a, b) => b.reduce((s, p) => s + p.areaHa, 0) - a.reduce((s, p) => s + p.areaHa, 0));
}

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
  const [focus, setFocus] = useState<string>("finca:0");
  const [ex, setEx] = useState(2);
  const [crop, setCrop] = useState<"parcelas" | "entorno">("parcelas");
  const api = useRef<MaquetaApi | null>(null);

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

  const groups = useMemo(() => fincas(parcels), [parcels]);
  const sel = useMemo(() => {
    if (focus.startsWith("finca:")) return groups[Number(focus.slice(6))] ?? groups[0] ?? [];
    const one = parcels.filter((x) => x.id === focus);
    return one.length ? one : groups[0] ?? [];
  }, [parcels, groups, focus]);
  const selKey = sel.map((p) => p.id).join(",");
  const selPolys = useMemo(() => sel.map((p) => p.geometry), [sel]);
  useEffect(() => setPoint(null), [selKey]);

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

  const p = sel.length === 1 && !focus.startsWith("finca:") ? sel[0] : null;
  const fincaName = (g: Parcel[]) => (groups.length === 1 ? "Toda la finca" : `Finca de ${g[0].name}${g.length > 1 ? ` y ${g.length - 1} más` : ""}`);
  const title = p ? p.name : fincaName(sel);
  const selHa = sel.reduce((a, x) => a + x.areaHa, 0);
  const b = boundsOf(sel);
  const st = an?.stats ?? null;
  const farFromFarm = cadDem && b ? distKm(cadDem.bounds, b) : 0;
  const areaHa = an ? (an.spawn.length * an.dem.cellM[0] * an.dem.cellM[1]) / 10000 : 0;
  const nParticles = Math.round(Math.min(1200, Math.max(200, areaHa * 400)));

  async function download() {
    const blob = await api.current?.snapshot();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tempero-${title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#f5f3ee] lg:block">
      <div className="relative h-[62vh] min-h-[460px] lg:absolute lg:inset-0 lg:right-[410px] lg:h-auto">
        {an && (
          <Maqueta
            dem={an.dem}
            hy={an.hy}
            spawn={an.spawn}
            polys={selPolys}
            crop={crop}
            ex={ex}
            overlays={an}
            show={{ contours: showContours, streams: showStreams, pools: showPools }}
            exits={st?.exits ?? []}
            playing={playing}
            mode={mode}
            point={point}
            particles={nParticles}
            onPoint={setPoint}
            apiRef={api}
          />
        )}
        <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 rounded-xl bg-white/90 px-3.5 py-2 text-[13px] text-tinta-2 shadow-[0_2px_8px_oklch(0.2_0.02_155/0.1)] lg:block">
          {mode === "punto" ? (point ? "Clic en otro sitio para mover el punto de riego" : "Haz clic en el terreno donde sale el agua") : "Arrastra para girar · clic derecho para desplazar · rueda para acercar"}
        </div>
        {(ign.loading || analysing || !an) && !ign.error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-[14px] text-tinta-2 shadow-[var(--shadow-float)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-olivo border-t-transparent" />
              {ign.loading ? "Descargando el LiDAR del IGN de tu finca…" : "Montando la maqueta y calculando el agua…"}
            </div>
          </div>
        )}
      </div>

      <div className="lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:[&>*]:pointer-events-auto">
        <TopBar title="Terreno 3D">
          <select className="input h-10 w-auto max-w-[300px] font-semibold" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Finca o parcela">
            <optgroup label={groups.length === 1 ? "Finca" : "Fincas"}>
              {groups.map((g, i) => <option key={i} value={`finca:${i}`}>{fincaName(g)} · {ha(g.reduce((a, x) => a + x.areaHa, 0))}</option>)}
            </optgroup>
            <optgroup label="Parcelas">
              {parcels.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </optgroup>
          </select>
          <div role="radiogroup" aria-label="Recorte" className="flex rounded-xl bg-rastrojo p-1">
            {([["parcelas", "Solo mis parcelas"], ["entorno", "Con el entorno"]] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={crop === id} onClick={() => setCrop(id)}
                className={`h-8 rounded-lg px-3 text-[13.5px] font-semibold transition-colors ${crop === id ? "bg-white text-tinta shadow-[0_1px_3px_oklch(0.2_0.02_155/0.15)]" : "text-tinta-2 hover:text-tinta"}`}>{label}</button>
            ))}
          </div>
          <div className="flex-1" />
          <label className="flex items-center gap-2.5 pr-1 text-sm font-semibold text-tinta-2">Relieve
            <input type="range" min={1} max={6} step={0.5} value={ex} onChange={(e) => setEx(Number(e.target.value))} className="w-28 accent-olivo" aria-label="Exagerar relieve" />
            <span className="num w-8">×{ex}</span>
          </label>
          <button className="btn btn-ghost btn-sm" onClick={download} disabled={!an}>Descargar imagen</button>
        </TopBar>
      </div>

      <section aria-label="Datos del terreno" className="flex animate-rise flex-col gap-4 bg-white p-5 lg:absolute lg:top-[84px] lg:right-4 lg:bottom-4 lg:w-[390px] lg:overflow-y-auto lg:rounded-[22px] lg:border lg:border-linea/80 lg:shadow-[var(--shadow-float)]">
        <div>
          <span className="kpi-label">{p ? "Parcela" : "Finca"}</span>
          <h2 className="font-display text-[26px] leading-tight font-semibold">{title}</h2>
          <span className="text-sm text-tinta-3">{p ? `${cropById(p.cropId).name} · ${ha(p.areaHa)}` : `${sel.length} parcela${sel.length === 1 ? "" : "s"} · ${ha(selHa)}`}</span>
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
          <span className="text-xs text-tinta-3">{mode === "lluvia" ? "Llueve sobre " + (p ? "la parcela" : "las parcelas de la finca") : point ? "El agua sale del punto marcado" : "Marca en el mapa la boca de riego, hidrante o cabecera"} · 1 s de animación = {TIME_SCALE / 60} min</span>
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
          {an ? an.dem.source : "Relieve"}. Escorrentía por la dirección de máxima pendiente (D8) tras rellenar los hoyos del terreno (Priority-Flood). Ortofoto PNOA © IGN.
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
