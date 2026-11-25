"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/Sidebar";
import { EmptyParcels, Notice } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { boundsOf } from "@/lib/geo";
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
  const [fit, setFit] = useState<{ bounds: [number, number, number, number]; key: number } | null>(null);

  useEffect(() => {
    const pid = params.get("parcela");
    if (hyd && pid) setFocus(pid);
  }, [hyd, params]);

  useEffect(() => {
    if (!hyd) return;
    const sel = parcels.filter((x) => !focus || x.id === focus);
    const bb = boundsOf(sel);
    if (bb) setFit({ bounds: bb, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, hyd]);

  if (!hyd) return <TopBar title="Terreno 3D" />;
  if (!parcels.length) return (<><TopBar title="Terreno 3D" /><EmptyParcels what="tu terreno en 3D" /></>);

  const p = parcels.find((x) => x.id === focus);
  const b = boundsOf(parcels);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:block">
      <div className="relative h-[62vh] min-h-[460px] overflow-hidden bg-noche lg:absolute lg:inset-0 lg:h-auto">
        <FarmMap
          parcels={parcels}
          selectedId={focus || null}
          showSigpac={sigpac}
          terrain={ex}
          fitTo={fit}
          padding={{ top: 90, right: 24, bottom: 24, left: 24 }}
          initialView={!focus && b ? { center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], zoom: 14.5 } : null}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-noche/50 to-transparent" />
        <div className="pointer-events-none absolute right-4 bottom-6 hidden rounded-xl bg-noche/80 px-3.5 py-2 text-[13px] text-white backdrop-blur lg:right-[420px] lg:block">
          Gira con clic derecho o Ctrl + arrastrar
        </div>
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

      <section aria-label="Datos del terreno" className="flex animate-rise flex-col gap-4 bg-white p-5 lg:absolute lg:top-[84px] lg:right-4 lg:w-[380px] lg:rounded-[22px] lg:border lg:border-linea/80 lg:shadow-[var(--shadow-float)]">
        {p ? (
          <div>
            <span className="kpi-label">Parcela</span>
            <h2 className="font-display text-[26px] leading-tight font-semibold">{p.name}</h2>
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
            <h2 className="font-display text-[26px] font-semibold">{parcels.length} parcela{parcels.length === 1 ? "" : "s"}</h2>
          </div>
        )}
        <Notice tone="water">
          <b>Próximamente:</b> curvas de nivel, el agua animada bajando por el terreno, zonas que se encharcan y tu plano de AutoCAD (DXF o LandXML).
        </Notice>
        <p className="text-xs leading-relaxed text-tinta-3">Relieve: modelo global de elevaciones (Terrain Tiles, unos 30 m en España). Más adelante, LiDAR del IGN. Ortofoto PNOA © IGN.</p>
      </section>
    </div>
  );
}
