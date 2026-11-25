"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/Sidebar";
import { EmptyParcels, Notice } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { boundsOf, centerOf } from "@/lib/geo";
import { cropById } from "@/lib/crops";
import { ha, nf } from "@/lib/format";

const FarmMap = dynamic(() => import("@/components/FarmMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-noche" /> });

export default function TerrenoPage() {
  return (
    <Suspense fallback={<TopBar title="Terreno 3D" />}>
      <Terreno />
    </Suspense>
  );
}

function Terreno() {
  const hyd = useHydrated();
  const params = useSearchParams();
  const { parcels } = useStore();
  const [focus, setFocus] = useState<string>("");
  const [ex, setEx] = useState(2);
  const [sigpac, setSigpac] = useState(false);
  const [fly, setFly] = useState<{ center: [number, number]; zoom: number; key: number } | null>(null);

  useEffect(() => {
    const pid = params.get("parcela");
    if (hyd && pid) setFocus(pid);
  }, [hyd, params]);

  useEffect(() => {
    const p = parcels.find((x) => x.id === focus);
    if (p) setFly({ center: centerOf(p.geometry), zoom: 16, key: Date.now() });
  }, [focus, parcels]);

  if (!hyd) return <TopBar title="Terreno 3D" />;
  if (!parcels.length) return (<><TopBar title="Terreno 3D" /><EmptyParcels what="tu terreno en 3D" /></>);

  const p = parcels.find((x) => x.id === focus);
  const b = boundsOf(parcels);

  return (
    <>
      <TopBar title="Terreno 3D">
        <select className="input h-10 w-auto font-semibold" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Parcela">
          <option value="">Toda la finca</option>
          {parcels.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="flex-1" />
        <label className="flex items-center gap-2.5 text-sm font-semibold text-tinta-2">Exagerar relieve
          <input type="range" min={1} max={5} step={0.5} value={ex} onChange={(e) => setEx(Number(e.target.value))} className="w-32 accent-olivo" />
          <span className="num w-8">×{ex}</span>
        </label>
      </TopBar>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[520px] flex-1 overflow-hidden bg-noche">
          <FarmMap
            parcels={parcels}
            selectedId={focus || null}
            showSigpac={sigpac}
            terrain={ex}
            flyTo={fly}
            initialView={!focus && b ? { center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], zoom: 14.5 } : null}
          />
          <div className="absolute top-3 left-3 flex gap-1 rounded-xl bg-white p-1.5 shadow-lg">
            <button className={`btn btn-sm ${sigpac ? "btn-primary" : "btn-ghost"}`} onClick={() => setSigpac(!sigpac)}>Recintos SIGPAC</button>
          </div>
          <div className="pointer-events-none absolute bottom-10 left-3 rounded-xl bg-noche/85 px-3.5 py-2 text-[13px] text-white">
            Gira con clic derecho (o Ctrl + arrastrar) · inclina con dos dedos
          </div>
        </div>
        <section className="flex w-full flex-col gap-4 border-l border-linea bg-white p-5 lg:w-[380px] lg:flex-none">
          {p ? (
            <div>
              <span className="kpi-label">Parcela</span>
              <h2 className="font-display text-[24px] font-bold">{p.name}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-tinta-3">Cultivo</dt><dd className="text-right">{cropById(p.cropId).name}</dd>
                <dt className="text-tinta-3">Superficie</dt><dd className="num text-right">{ha(p.areaHa)}</dd>
                <dt className="text-tinta-3">Pendiente media</dt><dd className="num text-right">{p.slopePct != null ? nf(p.slopePct, 1) + " %" : "—"}</dd>
                <dt className="text-tinta-3">Altitud media</dt><dd className="num text-right">{p.altitudeM != null ? p.altitudeM + " m" : "—"}</dd>
              </dl>
            </div>
          ) : (
            <div>
              <span className="kpi-label">Toda la finca</span>
              <h2 className="font-display text-[24px] font-bold">{parcels.length} parcelas</h2>
            </div>
          )}
          <Notice tone="water">
            <b>Fase 2:</b> curvas de nivel, animación del agua (lluvia, boca de riego o surco), zonas que se encharcan e importación de tu plano de AutoCAD (DXF o LandXML).
          </Notice>
          <p className="text-xs leading-relaxed text-tinta-3">Relieve: modelo global de elevaciones (Terrain Tiles, unos 30 m de resolución en España). En la fase 2 se usará el LiDAR del IGN (2–5 m) para más detalle. Ortofoto PNOA © IGN.</p>
        </section>
      </div>
    </>
  );
}
