"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/Sidebar";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/ui";
import { CropSelect as CropSel, ParcelEditor } from "@/components/ParcelEditor";
import { newParcel, useHydrated, useStore } from "@/lib/store";
import { cropById, cropFromUso } from "@/lib/agro";
import { USOS_SIGPAC } from "@/lib/irrigation";
import { ha, nf, sigpacCode, longDate } from "@/lib/format";
import { areaHa } from "@/lib/geo";
import { sumLast, useWeather } from "@/lib/useWater";
import { waterBalance } from "@/lib/water";
import { fertPlan } from "@/lib/fert";
import type { SigpacPick } from "@/components/FarmMap";
import type { Parcel } from "@/lib/types";

const FarmMap = dynamic(() => import("@/components/FarmMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-[#6E8F4E]" /> });

type Place = { display_name: string; lat: string; lon: string; type: string };

function useWide() {
  const [w, setW] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const on = () => setW(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return w;
}

export default function MapaPage() {
  const hyd = useHydrated();
  const { parcels, selectedId, select, addParcel, removeParcel, mapView, setMapView, entries } = useStore();
  const [pick, setPick] = useState<SigpacPick | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pts, setPts] = useState<[number, number][]>([]);
  const [base, setBase] = useState<"pnoa" | "ign">("pnoa");
  const [showSigpac, setShowSigpac] = useState(true);
  const [zoom, setZoom] = useState(mapView?.zoom ?? 5);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [fly, setFly] = useState<{ center: [number, number]; zoom: number; key: number } | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [newName, setNewName] = useState("");
  const [newCrop, setNewCrop] = useState("triticum-aestivum");
  const selected = parcels.find((p) => p.id === selectedId) ?? null;
  const wide = useWide();
  const total = parcels.reduce((s, p) => s + p.areaHa, 0);

  const already = useMemo(() => {
    if (!pick) return null;
    const code = sigpacCode(pick.ref);
    return parcels.find((p) => sigpacCode(p.sigpac) === code) ?? null;
  }, [pick, parcels]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=es&limit=6&accept-language=es&q=${encodeURIComponent(q)}`);
      const j = (await r.json()) as Place[];
      setPlaces(j);
      if (j.length === 1) goPlace(j[0]);
    } catch {
      setPlaces([]);
    }
  }
  function goPlace(pl: Place) {
    setFly({ center: [Number(pl.lon), Number(pl.lat)], zoom: 15, key: Date.now() });
    setPlaces([]);
  }
  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => setFly({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, key: Date.now() }));
  }

  function addPick() {
    if (!pick) return;
    const p = newParcel({
      name: newName.trim() || `Pol ${pick.ref.poligono} · Par ${pick.ref.parcela} · Rec ${pick.ref.recinto}`,
      geometry: pick.geometry,
      areaHa: pick.areaHa || areaHa(pick.geometry),
      sigpac: pick.ref,
      usoSigpac: pick.uso,
      slopePct: pick.slopePct,
      altitudeM: pick.altitudeM,
      cropId: newCrop,
    });
    if (pick.coefRegadio && pick.coefRegadio > 0) p.irrigation = { ...p.irrigation, system: "goteo", efficiency: 0.9 };
    addParcel(p);
    setPick(null);
    setNewName("");
  }

  function finishDraw() {
    if (pts.length < 3) return;
    const geometry = { type: "Polygon" as const, coordinates: [[...pts, pts[0]]] };
    const p = newParcel({ name: newName.trim() || `Parcela ${parcels.length + 1}`, geometry, areaHa: areaHa(geometry), cropId: newCrop });
    addParcel(p);
    setPts([]);
    setDrawing(false);
    setNewName("");
  }

  const onPick = (p: SigpacPick | null) => {
    setPick(p);
    if (p) {
      setNewCrop(cropFromUso(p.uso));
      setNewName("");
    }
  };

  const pad = wide ? { top: 96, right: 440, bottom: 24, left: 24 } : { top: 24, right: 24, bottom: 24, left: 24 };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:block">
      <div className="relative h-[62vh] min-h-[420px] overflow-hidden bg-[#5f7448] lg:absolute lg:inset-0 lg:h-auto">
        {hyd && (
          <FarmMap
            parcels={parcels}
            selectedId={selectedId}
            base={base}
            showSigpac={showSigpac}
            drawing={drawing}
            drawPoints={pts}
            pick={pick}
            fitKey={fitKey}
            flyTo={fly}
            initialView={mapView}
            padding={pad}
            onSelect={(id) => select(id)}
            onPickSigpac={onPick}
            onDrawPoint={(pt) => setPts((x) => [...x, pt])}
            onDrawFinish={finishDraw}
            onViewChange={setMapView}
            onZoomChange={setZoom}
          />
        )}
        <div className="dock absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1 rounded-2xl p-1.5 lg:top-[88px] lg:bottom-auto lg:left-4 lg:translate-x-0">
          <button className={`btn btn-sm ${base === "pnoa" ? "btn-primary" : "btn-ghost"}`} aria-pressed={base === "pnoa"} onClick={() => setBase("pnoa")}>Ortofoto</button>
          <button className={`btn btn-sm ${base === "ign" ? "btn-primary" : "btn-ghost"}`} aria-pressed={base === "ign"} onClick={() => setBase("ign")}>Mapa</button>
          <span className="mx-0.5 w-px self-stretch bg-linea" />
          <button className={`btn btn-sm ${showSigpac ? "btn-primary" : "btn-ghost"}`} aria-pressed={showSigpac} onClick={() => setShowSigpac(!showSigpac)}>SIGPAC</button>
        </div>
        {!drawing && showSigpac && zoom < 13 && (
          <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 animate-rise rounded-2xl bg-noche/85 px-4 py-2.5 text-center text-sm font-medium text-white backdrop-blur lg:bottom-8 lg:left-[calc(50%-210px)]">
            Acércate más para ver los recintos SIGPAC y elegirlos con un clic
          </div>
        )}
        {drawing && (
          <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 animate-rise items-center gap-3 rounded-2xl bg-noche/90 px-4 py-2.5 text-sm text-white backdrop-blur lg:bottom-8 lg:left-[calc(50%-210px)]">
            <span>{pts.length < 3 ? "Haz clic en las esquinas de la parcela" : "Doble clic o «Terminar» para cerrar"} · {pts.length} puntos</span>
            {pts.length > 0 && <button className="btn btn-sm bg-white/15 text-white" onClick={() => setPts((x) => x.slice(0, -1))}>Deshacer</button>}
          </div>
        )}
      </div>

      <div className="lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:[&>*]:pointer-events-auto">
        <TopBar title="Mapa de la explotación">
          <form onSubmit={search} className="relative flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-linea bg-white px-3 transition-shadow focus-within:border-olivo focus-within:shadow-[0_0_0_3px_oklch(0.43_0.075_150/0.14)]">
              <Icon name="search" size={18} className="text-tinta-3" />
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar municipio o lugar" aria-label="Buscar municipio o lugar" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {places.length > 1 && (
              <ul className="dock absolute top-12 left-0 z-20 w-full animate-rise overflow-hidden rounded-2xl">
                {places.map((pl, i) => (
                  <li key={i}><button type="button" className="w-full px-3 py-2.5 text-left text-sm hover:bg-rastrojo" onClick={() => goPlace(pl)}>{pl.display_name}</button></li>
                ))}
              </ul>
            )}
          </form>
          <button className="btn btn-sm btn-ghost" onClick={locate}><Icon name="locate" size={18} />Mi ubicación</button>
          <div className="flex-1" />
          {parcels.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setFitKey(Date.now())}>Ver toda la finca</button>}
          <button className={`btn btn-sm ${drawing ? "btn-outline" : "btn-primary"}`} onClick={() => { setDrawing(!drawing); setPts([]); setPick(null); select(null); }}>
            <Icon name={drawing ? "x" : "pencil"} size={18} />{drawing ? "Cancelar dibujo" : "Dibujar parcela"}
          </button>
        </TopBar>
      </div>

      <section aria-label="Panel de la parcela" key={drawing ? "d" : pick ? "p" : selected?.id ?? "l"}
        className="flex animate-rise flex-col gap-5 bg-white p-5 lg:absolute lg:top-[84px] lg:right-4 lg:bottom-4 lg:w-[400px] lg:overflow-y-auto lg:rounded-[22px] lg:border lg:border-linea/80 lg:shadow-[var(--shadow-float)]">
        {drawing ? (
          <DrawPanel pts={pts} name={newName} setName={setNewName} crop={newCrop} setCrop={setNewCrop} onFinish={finishDraw} />
        ) : pick ? (
          <PickPanel pick={pick} already={already} name={newName} setName={setNewName} crop={newCrop} setCrop={setNewCrop} onAdd={addPick} onCancel={() => setPick(null)} onOpen={(id) => { setPick(null); select(id); }} />
        ) : selected ? (
          <SelectedPanel parcel={selected} entriesCount={entries.filter((e) => e.parcelIds.includes(selected.id)).length} onClose={() => select(null)} onDelete={() => { if (confirm(`¿Quitar «${selected.name}» de la explotación? Se borran también sus anotaciones del cuaderno.`)) removeParcel(selected.id); }} />
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <span className="kpi-label">Tu explotación</span>
              <h2 className="font-display text-[26px] font-bold">{hyd ? `${parcels.length} parcela${parcels.length === 1 ? "" : "s"} · ${nf(total, 2)} ha` : "…"}</h2>
            </div>
            {hyd && parcels.length === 0 && (
              <Notice tone="water">
                <b>Cómo empezar:</b> busca tu municipio arriba, acércate hasta ver las líneas amarillas de los recintos SIGPAC y haz clic en los tuyos. Si una parcela no coincide con un recinto, dibújala.
              </Notice>
            )}
            <ul className="flex flex-col">
              {parcels.map((p) => (
                <li key={p.id}>
                  <button className="flex w-full items-center gap-3 border-b border-linea-2 py-3 text-left hover:bg-rastrojo" onClick={() => select(p.id)}>
                    <span className="h-3.5 w-3.5 flex-none rounded" style={{ background: cropById(p.cropId).color }} />
                    <span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="text-xs text-tinta-3">{cropById(p.cropId).name} · {p.irrigation.system === "secano" ? "secano" : "regadío"}</span></span>
                    <span className="num text-sm">{ha(p.areaHa)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-tinta-3">Los datos se guardan en este navegador. Haz copias desde Ajustes.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function CropSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <CropSel value={value} onChange={onChange} />;
}

function PickPanel({ pick, already, name, setName, crop, setCrop, onAdd, onCancel, onOpen }: {
  pick: SigpacPick; already: Parcel | null; name: string; setName: (s: string) => void; crop: string; setCrop: (s: string) => void; onAdd: () => void; onCancel: () => void; onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="kpi-label">Recinto SIGPAC</span>
          <h2 className="code mt-1 text-lg font-semibold">{sigpacCode(pick.ref)}</h2>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onCancel} aria-label="Cerrar"><Icon name="x" size={18} /></button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-rastrojo p-3 text-sm">
        <dt className="text-tinta-3">Superficie</dt><dd className="num text-right">{ha(pick.areaHa)}</dd>
        <dt className="text-tinta-3">Uso</dt><dd className="text-right">{pick.uso ? `${pick.uso} · ${USOS_SIGPAC[pick.uso] ?? ""}` : "—"}</dd>
        <dt className="text-tinta-3">Pendiente</dt><dd className="num text-right">{pick.slopePct != null ? nf(pick.slopePct, 1) + " %" : "—"}</dd>
        <dt className="text-tinta-3">Altitud</dt><dd className="num text-right">{pick.altitudeM != null ? pick.altitudeM + " m" : "—"}</dd>
        <dt className="text-tinta-3">Coef. regadío</dt><dd className="num text-right">{pick.coefRegadio ?? "—"}</dd>
      </dl>
      {already ? (
        <>
          <Notice tone="mute">Este recinto ya está en tu explotación como <b>{already.name}</b>.</Notice>
          <button className="btn btn-outline" onClick={() => onOpen(already.id)}>Abrir la parcela</button>
        </>
      ) : (
        <>
          <label className="label">Nombre de la parcela
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Pol ${pick.ref.poligono} · Par ${pick.ref.parcela} · Rec ${pick.ref.recinto}`} />
          </label>
          <label className="label">Cultivo esta campaña<CropSelect value={crop} onChange={setCrop} /></label>
          <button className="btn btn-primary" onClick={onAdd}><Icon name="plus" size={18} />Añadir a mi explotación</button>
        </>
      )}
    </div>
  );
}

function DrawPanel({ pts, name, setName, crop, setCrop, onFinish }: { pts: [number, number][]; name: string; setName: (s: string) => void; crop: string; setCrop: (s: string) => void; onFinish: () => void }) {
  const a = pts.length >= 3 ? areaHa({ type: "Polygon", coordinates: [[...pts, pts[0]]] }) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="kpi-label">Dibujar parcela</span>
        <h2 className="h2 mt-1">{pts.length >= 3 ? ha(a) : "Marca las esquinas"}</h2>
      </div>
      <p className="text-sm text-tinta-2">Haz clic en cada esquina sobre el mapa. Para cerrar, haz doble clic o pulsa «Terminar».</p>
      <label className="label">Nombre<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo: La Hoya" /></label>
      <label className="label">Cultivo<CropSelect value={crop} onChange={setCrop} /></label>
      <button className="btn btn-primary" disabled={pts.length < 3} onClick={onFinish}><Icon name="check" size={18} />Terminar</button>
    </div>
  );
}

function SelectedPanel({ parcel, entriesCount, onClose, onDelete }: { parcel: Parcel; entriesCount: number; onClose: () => void; onDelete: () => void }) {
  const entries = useStore((s) => s.entries);
  const w = useWeather(parcel);
  const wb = w.data ? waterBalance(parcel, w.data, entries, { assumePastIrrigation: true }) : null;
  const rain7 = w.data && wb ? sumLast(w.data.rain, wb.todayIndex, 7) : null;
  const fp = fertPlan(parcel);
  const pendingN = entries.filter((e) => e.type === "fertilizacion" && e.status === "pendiente" && e.parcelIds.includes(parcel.id)).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <span className={`chip ${parcel.irrigation.system === "secano" ? "chip-mute" : "chip-water"}`}>{parcel.irrigation.system === "secano" ? "Secano" : "Regadío"}</span>
            {parcel.vulnerable && <span className="chip chip-earth">Zona vulnerable</span>}
          </div>
          <h2 className="font-display text-[26px] leading-tight font-bold">{parcel.name}</h2>
          <span className="text-[13px] text-tinta-3"><span className="code">{sigpacCode(parcel.sigpac)}</span> · {ha(parcel.areaHa)}</span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={18} /></button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/app/riego" className="rounded-xl border border-linea p-3 hover:border-acequia">
          <span className="kpi-label">Lluvia 7 días</span>
          <span className="num block text-[22px] font-semibold text-acequia">{rain7 != null ? nf(rain7, 1) + " mm" : w.error ? "sin datos" : "…"}</span>
        </Link>
        <Link href="/app/riego" className="rounded-xl border border-linea p-3 hover:border-acequia">
          <span className="kpi-label">Próximo riego</span>
          <span className="num block text-[22px] font-semibold">{parcel.irrigation.system === "secano" ? "secano" : wb?.next ? nf(wb.next.grossMm, 0) + " mm" : wb ? "no hace falta" : "…"}</span>
          {wb?.next && <span className="text-xs text-tinta-2">{longDate(wb.next.date)}</span>}
        </Link>
        <Link href="/app/abonado" className="rounded-xl border border-linea p-3 hover:border-barro">
          <span className="kpi-label">N a aportar</span>
          <span className="num block text-[22px] font-semibold text-barro">{nf(fp.applyN, 0)} kg/ha</span>
        </Link>
        <Link href="/app/cuaderno" className="rounded-xl border border-linea p-3 hover:border-olivo">
          <span className="kpi-label">Cuaderno</span>
          <span className="num block text-[22px] font-semibold">{entriesCount}</span>
          <span className="text-xs text-tinta-2">{pendingN ? `${pendingN} pendiente${pendingN > 1 ? "s" : ""}` : entriesCount === 1 ? "anotación" : "anotaciones"}</span>
        </Link>
      </div>

      <ParcelEditor parcel={parcel} />

      <div className="flex gap-2.5">
        <Link href={`/app/cuaderno?parcela=${parcel.id}`} className="btn btn-primary flex-1">Anotar en el cuaderno</Link>
        <Link href={`/app/terreno?parcela=${parcel.id}`} className="btn btn-outline flex-1">Ver en 3D</Link>
      </div>
      <button className="btn btn-sm btn-ghost self-start text-rojo" onClick={onDelete}><Icon name="trash" size={16} />Quitar parcela</button>
    </div>
  );
}
