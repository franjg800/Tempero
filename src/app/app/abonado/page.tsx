"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/Sidebar";
import { Icon } from "@/components/Icon";
import { EmptyParcels, Notice, NumberInput } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { cropById, MONTHS } from "@/lib/crops";
import { fertPlan, type Level } from "@/lib/fert";
import { ha, nf } from "@/lib/format";
import type { Parcel } from "@/lib/types";

const lvlChip = (l: Level) => (l === "sin análisis" ? "chip-bad" : l === "bajo" ? "chip-warn" : l === "muy alto" ? "chip-water" : "chip-ok");

export default function AbonadoPage() {
  const hyd = useHydrated();
  const { parcels, selectedId, select, entries, addEntry, farm } = useStore();
  const current = parcels.find((p) => p.id === selectedId) ?? parcels.find((p) => cropById(p.cropId).id !== "barbecho") ?? parcels[0] ?? null;
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (hyd && current && current.id !== selectedId) select(current.id);
  }, [hyd, current, selectedId, select]);

  if (!hyd) return <TopBar title="Plan de abonado" />;
  if (!parcels.length || !current) return (<><TopBar title="Plan de abonado" /><EmptyParcels what="el plan de abonado" /></>);

  const noAnalysis = parcels.filter((p) => p.analysis.pOlsenPpm == null || p.analysis.kPpm == null).length;

  function toNotebook() {
    let n = 0;
    for (const p of parcels) {
      const fp = fertPlan(p);
      fp.fractions.forEach((f) => {
        if (f.kgN <= 0 && fp.applyP <= 0 && fp.applyK <= 0) return;
        const exists = entries.some((e) => e.type === "fertilizacion" && e.parcelIds.includes(p.id) && e.data.momento === f.label && e.data.plan === farm.campaign);
        if (exists) return;
        const year = new Date().getFullYear();
        const now = new Date().getMonth();
        const y = f.month >= 8 && now < 8 ? year - 1 : f.month < 8 && now >= 8 ? year + 1 : year;
        addEntry({
          type: "fertilizacion",
          date: `${y}-${String(f.month + 1).padStart(2, "0")}-01`,
          parcelIds: [p.id],
          status: "pendiente",
          data: { momento: f.label, tipo: "Mineral", producto: "", dosis: "", plan: farm.campaign, obs: `Plan: ${nf(f.kgN, 0)} kg N/ha${f.share === fp.fractions[0].share && fp.applyP + fp.applyK > 0 ? ` · P₂O₅ ${nf(fp.applyP, 0)} · K₂O ${nf(fp.applyK, 0)} kg/ha` : ""}` },
        });
        n++;
      });
    }
    setMsg(n ? `${n} aplicaciones añadidas al cuaderno como pendientes.` : "El cuaderno ya tenía todas las aplicaciones del plan.");
  }

  return (
    <>
      <TopBar title="Plan de abonado">
        <span className="chip chip-ok">Campaña {farm.campaign}</span>
        {noAnalysis > 0 && <span className="chip chip-warn">{noAnalysis} parcela{noAnalysis > 1 ? "s" : ""} sin análisis de suelo</span>}
        <div className="flex-1" />
        <Link href="/app/abonado/imprimir" className="btn btn-sm btn-outline"><Icon name="print" size={18} />Exportar plan (PDF)</Link>
        <button className="btn btn-sm btn-primary" onClick={toNotebook}>Pasar al cuaderno</button>
      </TopBar>
      {msg && <div className="px-6 pt-4"><Notice tone="mute">{msg} <Link href="/app/cuaderno?seccion=fertilizacion" className="font-semibold underline">Ver en el cuaderno</Link></Notice></div>}

      <div className="enter flex flex-wrap items-start gap-5 px-4 pt-2 pb-6 sm:px-6">
        <section className="card min-w-0 flex-[999_1_600px] overflow-x-auto px-5 pt-1.5 pb-3">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.6fr_.8fr_.9fr_.6fr_.6fr_.6fr_1fr] gap-2.5 border-b border-linea py-3.5 text-xs font-bold text-tinta-3">
              <span>PARCELA</span><span>SUPERFICIE</span><span>OBJETIVO</span><span>N</span><span>P₂O₅</span><span>K₂O</span><span>ESTADO</span>
            </div>
            {parcels.map((p) => {
              const fp = fertPlan(p);
              const c = cropById(p.cropId);
              const pend = entries.filter((e) => e.type === "fertilizacion" && e.parcelIds.includes(p.id));
              const doneN = pend.filter((e) => e.status === "hecho").length;
              const status = c.id === "barbecho" ? <span className="chip chip-mute">Sin cultivo</span>
                : p.analysis.pOlsenPpm == null || p.analysis.kPpm == null ? <span className="chip chip-bad">Falta análisis</span>
                : pend.length === 0 ? <span className="chip chip-mute">Planificado</span>
                : doneN === pend.length ? <span className="chip chip-ok">Hecho</span>
                : <span className="chip chip-warn">{doneN}/{pend.length} hechas</span>;
              const on = p.id === current.id;
              return (
                <button key={p.id} onClick={() => select(p.id)}
                  className={`grid w-full grid-cols-[1.6fr_.8fr_.9fr_.6fr_.6fr_.6fr_1fr] items-center gap-2.5 py-3 text-left text-sm ${on ? "-mx-2.5 my-1 w-[calc(100%+20px)] rounded-[10px] bg-barro-claro px-2.5" : "border-b border-linea-2"}`}>
                  <b className="truncate">{p.name} · {c.name}</b>
                  <span className="num">{ha(p.areaHa)}</span>
                  <span className="num">{c.id === "barbecho" ? "—" : `${nf(p.fert.yieldT, 1)} t/ha`}</span>
                  <span className={`num ${on ? "font-semibold text-barro" : ""}`}>{nf(fp.applyN, 0)}</span>
                  <span className="num">{nf(fp.applyP, 0)}</span>
                  <span className="num">{nf(fp.applyK, 0)}</span>
                  <span>{status}</span>
                </button>
              );
            })}
            <p className="mt-3 text-xs text-tinta-3">Dosis en kg/ha a aportar después de descontar lo que aportan el suelo, el agua de riego, el cultivo anterior y los abonos orgánicos. Coeficientes orientativos: revísalos en cada parcela.</p>
          </div>
        </section>
        <Detail parcel={current} />
      </div>
    </>
  );
}

function Detail({ parcel }: { parcel: Parcel }) {
  const update = useStore((s) => s.updateParcel);
  const fp = fertPlan(parcel);
  const c = cropById(parcel.cropId);
  const setA = (patch: Partial<Parcel["analysis"]>) => update(parcel.id, { analysis: { ...parcel.analysis, ...patch } });
  const setF = (patch: Partial<Parcel["fert"]>) => update(parcel.id, { fert: { ...parcel.fert, ...patch } });
  const setI = (patch: Partial<Parcel["irrigation"]>) => update(parcel.id, { irrigation: { ...parcel.irrigation, ...patch } });
  const bars = [
    { label: "Necesidad", v: fp.needN, color: "#B8B5A8", sign: "" },
    { label: "Suelo", v: fp.soilN, color: "#2E5B3B", sign: "−" },
    { label: "Agua de riego", v: fp.waterN, color: "#1E6AA0", sign: "−" },
    { label: "Cultivo anterior", v: fp.prevN, color: "#7FA36E", sign: "−" },
    { label: "Orgánicos y otros", v: fp.organicN + fp.extraN, color: "#8C6A4A", sign: "−" },
    { label: "A aportar", v: fp.applyN, color: "#A85A24", sign: "" },
  ];
  const max = Math.max(1, fp.needN);

  return (
    <section className="card flex min-w-0 flex-[1_1_380px] flex-col gap-4 p-5">
      <div>
        <span className="kpi-label">Balance de nitrógeno · {parcel.name}</span>
        <h2 className="font-display text-[22px] font-bold">{c.legume ? "Leguminosa: sin aporte de N" : `Aportar ${nf(fp.applyN, 0)} kg N/ha`}</h2>
        <span className="num text-[13px] text-tinta-3">Total parcela: {nf(fp.applyN * parcel.areaHa, 0)} kg N · {nf(fp.applyP * parcel.areaHa, 0)} kg P₂O₅ · {nf(fp.applyK * parcel.areaHa, 0)} kg K₂O</span>
      </div>
      <div className="flex flex-col gap-2" role="img" aria-label={`Necesidad ${nf(fp.needN, 0)} kg N/ha; a aportar ${nf(fp.applyN, 0)}`}>
        {bars.map((b) => (
          <div key={b.label} className="grid grid-cols-[120px_1fr_56px] items-center gap-2 text-[13px]">
            <span className={b.label === "A aportar" ? "font-bold" : "text-tinta-2"}>{b.label}</span>
            <span className="h-5 rounded bg-rastrojo"><span className="block h-5 rounded" style={{ width: `${Math.min(100, (b.v / max) * 100)}%`, background: b.color }} /></span>
            <span className="num text-right font-semibold">{Math.round(b.v) > 0 ? b.sign : ""}{nf(Math.abs(b.v), 0)}</span>
          </div>
        ))}
      </div>

      {fp.fractions.length > 0 && fp.applyN > 0 && (
        <div className="flex flex-col gap-2">
          <b className="kpi-label">Reparto del nitrógeno</b>
          {fp.fractions.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-xl border border-linea px-3 py-2.5 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-barro" />
              <span className="flex-1">{f.label} <span className="text-tinta-3">· {MONTHS[f.month]}</span></span>
              <span className="num">{nf(f.kgN, 0)} kg/ha</span>
            </div>
          ))}
        </div>
      )}

      <fieldset className="grid grid-cols-2 gap-3 rounded-xl border border-linea p-3">
        <legend className="px-1 text-xs font-bold tracking-wide text-tinta-3">COSECHA Y APORTES</legend>
        <label className="label">Rendimiento ({c.unit})<NumberInput value={parcel.fert.yieldT} onChange={(v) => setF({ yieldT: v ?? 0 })} /></label>
        <label className="label">N de orgánicos (kg/ha)<NumberInput value={parcel.fert.organicNKgHa} onChange={(v) => setF({ organicNKgHa: v ?? 0 })} /></label>
        <label className="label">Otros aportes de N (kg/ha)<NumberInput value={parcel.fert.extraNKgHa} onChange={(v) => setF({ extraNKgHa: v ?? 0 })} /></label>
        <label className="flex items-end gap-2 pb-3 text-[13px] font-semibold text-tinta-2"><input type="checkbox" className="h-4 w-4 accent-olivo" checked={parcel.fert.prevLegume} onChange={(e) => setF({ prevLegume: e.target.checked })} />Antes hubo leguminosa (−30 kg N)</label>
        {parcel.irrigation.system !== "secano" && (
          <>
            <label className="label">Nitratos del agua (mg/L)<NumberInput value={parcel.irrigation.waterNitrateMgL} onChange={(v) => setI({ waterNitrateMgL: v ?? 0 })} /></label>
            <label className="label">Riego previsto (m³/ha)<NumberInput value={parcel.irrigation.seasonVolumeM3Ha} onChange={(v) => setI({ seasonVolumeM3Ha: v ?? 0 })} /></label>
          </>
        )}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 rounded-xl border border-linea p-3">
        <legend className="px-1 text-xs font-bold tracking-wide text-tinta-3">ANÁLISIS DE SUELO</legend>
        <label className="label">N mineral (kg/ha)<NumberInput value={parcel.analysis.nMinKgHa} onChange={(v) => setA({ nMinKgHa: v })} placeholder="sin dato" /></label>
        <label className="label">Materia orgánica (%)<NumberInput value={parcel.analysis.organicMatterPct} onChange={(v) => setA({ organicMatterPct: v })} placeholder="sin dato" /></label>
        <label className="label">P Olsen (ppm) <span className={`chip ${lvlChip(fp.pLevel)} self-start`}>{fp.pLevel}</span><NumberInput value={parcel.analysis.pOlsenPpm} onChange={(v) => setA({ pOlsenPpm: v })} placeholder="sin dato" /></label>
        <label className="label">K (ppm) <span className={`chip ${lvlChip(fp.kLevel)} self-start`}>{fp.kLevel}</span><NumberInput value={parcel.analysis.kPpm} onChange={(v) => setA({ kPpm: v })} placeholder="sin dato" /></label>
      </fieldset>

      <details className="rounded-xl border border-linea p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-tinta-2">Extracciones del cultivo (kg por tonelada)</summary>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className="label">N<NumberInput value={fp.ext.n} onChange={(v) => setF({ overrides: { ...parcel.fert.overrides, n: v ?? undefined } })} /></label>
          <label className="label">P₂O₅<NumberInput value={fp.ext.p} onChange={(v) => setF({ overrides: { ...parcel.fert.overrides, p: v ?? undefined } })} /></label>
          <label className="label">K₂O<NumberInput value={fp.ext.k} onChange={(v) => setF({ overrides: { ...parcel.fert.overrides, k: v ?? undefined } })} /></label>
        </div>
      </details>

      {fp.warnings.map((w) => <Notice key={w} tone={w.startsWith("Zona") ? "earth" : "warn"}>{w}</Notice>)}
    </section>
  );
}
