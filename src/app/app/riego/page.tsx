"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/Sidebar";
import { EmptyParcels, Notice, ParcelSelect } from "@/components/ui";
import { AnnualPlan } from "@/components/riego/AnnualPlan";
import { DesignView } from "@/components/riego/DesignView";
import { IrrigatedTable, WeekView } from "@/components/riego/WeekView";
import { useHydrated, useStore } from "@/lib/store";
import { useClimate } from "@/lib/useClimate";
import { study } from "@/lib/study";
import { cropById } from "@/lib/agro";

type View = "plan" | "diseno" | "semana";
const VIEWS: { id: View; label: string }[] = [
  { id: "plan", label: "Plan anual" },
  { id: "diseno", label: "Diseño del riego" },
  { id: "semana", label: "Esta semana" },
];

export default function RiegoPage() {
  return (
    <Suspense fallback={<TopBar title="Riego" />}>
      <Riego />
    </Suspense>
  );
}

function Riego() {
  const hyd = useHydrated();
  const params = useSearchParams();
  const { parcels, selectedId, select } = useStore();
  const [view, setView] = useState<View>((params.get("vista") as View) || "plan");
  const [assume, setAssume] = useState(true);
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const irrigated = parcels.filter((p) => p.irrigation.system !== "secano");
  const current = parcels.find((p) => p.id === selectedId) ?? irrigated[0] ?? parcels[0] ?? null;
  const cl = useClimate(current);
  const s = useMemo(() => (current && cl.data ? study(current, cl.data) : null), [current, cl.data]);

  useEffect(() => {
    if (hyd && current && current.id !== selectedId) select(current.id);
  }, [hyd, current, selectedId, select]);

  if (!hyd) return <TopBar title="Riego" />;
  if (!parcels.length || !current) return (<><TopBar title="Riego" /><EmptyParcels what="el riego" /></>);

  const crop = cropById(current.cropId);

  return (
    <>
      <TopBar title="Riego">
        <ParcelSelect parcels={parcels} value={current.id} onChange={select} />
        <div role="tablist" aria-label="Vista" className="flex rounded-xl bg-rastrojo p-1">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
              className={`h-8 rounded-lg px-3 text-[13.5px] font-semibold transition-colors ${view === v.id ? "bg-white text-tinta shadow-[0_1px_3px_oklch(0.2_0.02_155/0.15)]" : "text-tinta-2 hover:text-tinta"}`}>{v.label}</button>
          ))}
        </div>
        <div className="flex-1" />
        {view === "semana" && (
          <div role="group" aria-label="Periodo" className="flex overflow-hidden rounded-[10px] border border-linea">
            {([7, 14, 30] as const).map((r) => (
              <button key={r} className={`h-9 px-3.5 text-[13px] font-semibold ${range === r ? "bg-olivo text-white" : "bg-white text-tinta-2"}`} onClick={() => setRange(r)}>{r} días</button>
            ))}
          </div>
        )}
      </TopBar>

      {view === "semana" ? (
        <>
          <WeekView parcel={current} assume={assume} setAssume={setAssume} range={range} />
          {irrigated.length > 0 && <IrrigatedTable parcels={irrigated} assume={assume} onPick={select} />}
        </>
      ) : (
        <div className="px-4 pt-2 pb-6 sm:px-6">
          {!crop.agro ? (
            <Notice tone="mute">La parcela está en barbecho: no hay necesidades de riego que calcular.</Notice>
          ) : cl.error ? (
            <Notice>No se ha podido descargar el clima de los últimos 10 años: {cl.error}. <button className="font-semibold underline" onClick={cl.retry}>Reintentar</button></Notice>
          ) : !s || !cl.data ? (
            <div className="card flex items-center gap-3 p-6 text-tinta-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-acequia border-t-transparent" />
              Descargando 10 años de clima diario de la parcela…
            </div>
          ) : view === "plan" ? (
            <AnnualPlan parcel={current} s={s} cl={cl.data} />
          ) : (
            <DesignView parcel={current} s={s} cl={cl.data} />
          )}
        </div>
      )}
    </>
  );
}
