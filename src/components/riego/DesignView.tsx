"use client";

import type { Parcel } from "@/lib/types";
import type { Climate } from "@/lib/climate";
import { dripDesign, sprinklerDesign, isLocalized, type Study } from "@/lib/study";
import { MONTHS } from "@/lib/agro";
import { useStore } from "@/lib/store";
import { hoursText, nf } from "@/lib/format";
import { Kpi, Notice, NumberInput } from "@/components/ui";

export function DesignView({ parcel, s, cl }: { parcel: Parcel; s: Study; cl: Climate }) {
  const update = useStore((st) => st.updateParcel);
  const ir = parcel.irrigation;
  const setIr = (patch: Partial<Parcel["irrigation"]>) => update(parcel.id, { irrigation: { ...ir, ...patch } });
  if (ir.system === "secano")
    return <Notice tone="mute">Esta parcela está en secano. Elige un sistema de riego en el mapa (ficha de la parcela) para diseñarlo.</Notice>;
  if (isLocalized(parcel)) return <Drip parcel={parcel} s={s} cl={cl} setIr={setIr} setCover={(v) => update(parcel.id, { coverPct: v })} />;
  return <Sprinkler parcel={parcel} s={s} cl={cl} setIr={setIr} />;
}

function Drip({ parcel, s, cl, setIr, setCover }: { parcel: Parcel; s: Study; cl: Climate; setIr: (p: Partial<Parcel["irrigation"]>) => void; setCover: (v: number) => void }) {
  const ir = parcel.irrigation;
  const d = dripDesign(parcel, s, cl);
  const micro = ir.system === "microaspersion";
  const em = micro ? "microaspersor" : "gotero";
  const ems = micro ? "microaspersores" : "goteros";
  return (
    <div className="enter flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <Kpi tone="solid-water" label="Riego diario en el mes punta" value={d.woody ? nf(d.vPlant ?? 0, 0) : nf(d.nt, 1)} unit={d.woody ? "L/planta" : "mm"} sub={`${MONTHS[d.peakMonth]} · ${nf(d.nt, 2)} mm/día`} />
        <Kpi label="Tiempo de riego" value={hoursText(d.hours)} sub={`al día con ${em}s de ${nf(d.qa, 1)} L/h`} />
        <Kpi label="Sectores" value={String(d.sectors)} sub={`en ${nf(ir.hoursPerDay, 0)} h de riego al día`} />
        <Kpi label="Caudal por sector" value={nf(d.qSectorM3h, 1)} unit="m³/h" sub={`${nf(d.qSectorLs, 2)} L/s · total ${nf(d.qTotalM3h, 1)} m³/h`} />
      </div>
      {d.warnings.map((w) => <Notice key={w}>{w}</Notice>)}

      <div className="flex flex-wrap gap-5">
        <section className="card flex min-w-0 flex-[1_1_320px] flex-col gap-4 p-5">
          <h2 className="h2">Datos de la instalación</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">Caudal del {em} (L/h)<NumberInput value={ir.emitterFlowLh} onChange={(v) => setIr({ emitterFlowLh: Math.max(0.5, v ?? 2.2) })} /></label>
            {d.woody ? (
              <label className="label">{micro ? "Microaspersores" : "Goteros"} por planta<NumberInput value={ir.emittersPerPlant} placeholder={`auto (${d.eMin})`} onChange={(v) => setIr({ emittersPerPlant: v == null ? null : Math.max(1, Math.round(v)) })} /></label>
            ) : (
              <label className="label">Entre {ems} (m)<NumberInput value={ir.emitterSpacingM} onChange={(v) => setIr({ emitterSpacingM: Math.max(0.1, v ?? 0.3) })} /></label>
            )}
            {!d.woody && <label className="label">Laterales por línea<NumberInput value={ir.lateralsPerRow} step="0.5" onChange={(v) => setIr({ lateralsPerRow: Math.max(0.25, v ?? 1) })} /><span className="text-[11px] font-normal text-tinta-3">0,5 = un lateral cada dos líneas</span></label>}
            {d.woody && <label className="label">Cobertura de la copa (%)<NumberInput value={parcel.coverPct} onChange={(v) => setCover(Math.min(100, Math.max(5, v ?? 50)))} /></label>}
            {d.woody && <label className="label">Superficie mojada mínima (%)<NumberInput value={ir.wetPct ?? 25} onChange={(v) => setIr({ wetPct: v == null ? null : Math.min(80, Math.max(5, v)) })} /></label>}
            <label className="label">Coef. de uniformidad (CU)<NumberInput value={ir.cu} step="0.01" onChange={(v) => setIr({ cu: Math.min(1, Math.max(0.5, v ?? 0.9)) })} /></label>
            <label className="label">CE del agua (dS/m)<NumberInput value={ir.ceWater} step="0.1" onChange={(v) => setIr({ ceWater: Math.max(0, v ?? 0) })} /></label>
            <label className="label">Horas de riego al día<NumberInput value={ir.hoursPerDay} onChange={(v) => setIr({ hoursPerDay: Math.min(24, Math.max(1, v ?? 20)) })} /></label>
            <label className="label">Eficiencia (Ea, %)<NumberInput value={Math.round(ir.efficiency * 100)} onChange={(v) => setIr({ efficiency: Math.min(1, Math.max(0.5, (v ?? 90) / 100)) })} /></label>
          </div>
          <p className="text-xs text-tinta-3">Marco {nf(parcel.spacing[0], 2)} × {nf(parcel.spacing[1], 2)} m ({nf(d.sp, 2)} m² por planta). Se cambia en la ficha de la parcela.</p>
        </section>

        <section className="card flex min-w-0 flex-[999_1_480px] flex-col gap-4 p-5">
          <h2 className="h2">Necesidades en el mes punta · {MONTHS[d.peakMonth]}</h2>
          <Steps rows={[
            ["ETo media diaria", `${nf(d.etoD, 2)} mm/día`],
            ["Kc del cultivo", nf(d.kc, 2)],
            [s.crop.woody ? `Kl · localización (cobertura ${Math.round(s.cover * 100)} %)` : "Kl · localización", nf(d.kl, 2)],
            ["Variación climática", nf(d.kvc, 2)],
            ["ETrl = ETo · Kc · Kl · 1,15", `${nf(d.etrl, 2)} mm/día`],
            ["Lluvia efectiva del mes", `${nf(d.peD, 2)} mm/día`],
            ["Necesidades netas Nn", `${nf(d.nn, 2)} mm/día`],
            ["Lavado LR = CEi / (2 · CEe máx)", s.ceMax ? `${nf(d.lr * 100, 1)} % (CEe máx ${nf(s.ceMax, 1)} dS/m)` : `${nf(d.lr * 100, 1)} % (sin dato del cultivo: 10 dS/m)`],
            ["K = máx(1 − Ea, LR)", nf(d.K, 3)],
            ["Necesidades totales Nt = Nn / ((1 − K) · CU)", `${nf(d.nt, 2)} mm/día`],
            ...(d.woody ? [["Por planta", `${nf(d.vPlant ?? 0, 1)} L/planta·día`] as [string, string]] : []),
          ]} />
          <h3 className="mt-1 font-display text-[17px] font-semibold">Emisores</h3>
          <Steps rows={[
            [`Radio mojado de un ${em} (suelo ${s.soil.tex.toLowerCase()})`, `${nf(d.r, 2)} m`],
            ["Superficie mojada por emisor", `${nf(d.ae, 2)} m²`],
            ...(d.woody
              ? ([
                  [`Superficie mojada mínima`, `${d.pMin} %`],
                  [`${ems[0].toUpperCase() + ems.slice(1)} mínimos por planta`, String(d.eMin)],
                  [`${ems[0].toUpperCase() + ems.slice(1)} por planta usados`, String(d.e)],
                  ["Superficie mojada resultante", `${nf(d.pWet, 0)} %`],
                ] as [string, string][])
              : ([["Franja mojada continua", d.stripOk ? "sí" : "no: acerca los goteros"]] as [string, string][])),
            [`${ems[0].toUpperCase() + ems.slice(1)} por hectárea`, nf(d.emittersHa, 0)],
            [`${ems[0].toUpperCase() + ems.slice(1)} en la parcela`, nf(d.emittersTotal, 0)],
          ]} />
          <h3 className="mt-1 font-display text-[17px] font-semibold">Funcionamiento</h3>
          <Steps rows={[
            ["Tiempo de riego = Nt · superficie por emisor / qa", `${hoursText(d.hours)} al día`],
            ["Sectores que caben en el día", String(d.sectors)],
            ["Caudal si riega toda la parcela", `${nf(d.qTotalM3h, 1)} m³/h`],
            ["Caudal por sector", `${nf(d.qSectorM3h, 1)} m³/h · ${nf(d.qSectorLs, 2)} L/s`],
            ["Volumen diario en el mes punta", `${nf(d.volDayM3, 1)} m³`],
            ["Volumen anual (necesidades brutas)", `${nf(d.volYearM3, 0)} m³ · ${nf(s.tot.nb * 10, 0)} m³/ha`],
          ]} />
        </section>
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="h2 mb-3">Programa de riego por meses</h2>
        <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-left text-xs font-bold text-tinta-3">
              <th className="py-2 pr-3">MES</th><th className="py-2 pr-3 text-right">mm/DÍA</th>{d.woody && <th className="py-2 pr-3 text-right">L/PLANTA·DÍA</th>}<th className="py-2 pr-3 text-right">TIEMPO/DÍA</th><th className="py-2 text-right">m³/DÍA PARCELA</th>
            </tr>
          </thead>
          <tbody>
            {d.monthly.map((m) => (
              <tr key={m.m} className={`border-b border-linea-2 ${m.m === d.peakMonth ? "bg-acequia-claro/60" : ""}`}>
                <td className="py-1.5 pr-3 capitalize">{MONTHS[m.m]}</td>
                <td className="num py-1.5 pr-3 text-right">{nf(m.mmDay, 2)}</td>
                {d.woody && <td className="num py-1.5 pr-3 text-right">{nf(m.lPlantDay ?? 0, 1)}</td>}
                <td className="num py-1.5 pr-3 text-right">{hoursText(m.minDay / 60)}</td>
                <td className="num py-1.5 text-right">{nf(m.mmDay * 10 * parcel.areaHa, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-tinta-3">Medias de 10 años de clima. En riego localizado se riega a diario: reparte el tiempo entre los sectores. Ajusta con la pestaña «Esta semana» según la lluvia real.</p>
      </section>
    </div>
  );
}

function Sprinkler({ parcel, s, cl, setIr }: { parcel: Parcel; s: Study; cl: Climate; setIr: (p: Partial<Parcel["irrigation"]>) => void }) {
  const ir = parcel.irrigation;
  const d = sprinklerDesign(parcel, s, cl);
  const grav = ir.system === "gravedad";
  return (
    <div className="enter flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <Kpi tone="solid-water" label="Dosis bruta por riego" value={nf(d.db, 0)} unit="mm" sub={`${nf(d.volM3, 0)} m³ en la parcela`} />
        <Kpi label="Cada cuántos días" value={String(d.interval)} unit="días" sub={`en ${MONTHS[d.peakMonth]} (mes punta)`} />
        {!grav && <Kpi label="Tiempo por postura" value={hoursText(d.hours)} sub={`${d.positions} posturas en ${nf(ir.hoursPerDay, 0)} h`} />}
        <Kpi label="Riegos al año" value={d.riegosMed != null ? String(d.riegosMed) : "—"} sub="necesidades netas ÷ dosis neta" />
      </div>
      {d.warnings.map((w) => <Notice key={w}>{w}</Notice>)}
      <div className="flex flex-wrap gap-5">
        <section className="card flex min-w-0 flex-[1_1_300px] flex-col gap-4 p-5">
          <h2 className="h2">Datos de la instalación</h2>
          <div className="grid grid-cols-2 gap-3">
            {!grav && <label className="label">Pluviometría (mm/h)<NumberInput value={ir.rateMmH} onChange={(v) => setIr({ rateMmH: Math.max(0.5, v ?? 6) })} /></label>}
            <label className="label">Horas de riego al día<NumberInput value={ir.hoursPerDay} onChange={(v) => setIr({ hoursPerDay: Math.min(24, Math.max(1, v ?? 20)) })} /></label>
            <label className="label">Eficiencia (Ea, %)<NumberInput value={Math.round(ir.efficiency * 100)} onChange={(v) => setIr({ efficiency: Math.min(1, Math.max(0.3, (v ?? 75) / 100)) })} /></label>
            <label className="label">CE del agua (dS/m)<NumberInput value={ir.ceWater} step="0.1" onChange={(v) => setIr({ ceWater: Math.max(0, v ?? 0) })} /></label>
          </div>
        </section>
        <section className="card flex min-w-0 flex-[999_1_460px] flex-col gap-3 p-5">
          <h2 className="h2">Cálculo · {MONTHS[d.peakMonth]}</h2>
          <Steps rows={[
            ["ETc diaria del mes punta", `${nf(d.etcD, 2)} mm/día`],
            ["Agua disponible total ADT (raíz máx.)", `${nf(d.adt, 0)} mm`],
            ["Agua fácilmente disponible AFA = p · ADT", `${nf(d.afa, 0)} mm`],
            [ir.system === "pivot" ? "Intervalo (riegos cortos de pívot, ≤ 15 mm)" : grav ? "Intervalo = AFA / ETc" : "Intervalo (AFA / ETc y posturas ≤ 8 h)", `${d.interval} días`],
            ["Dosis neta = intervalo · ETc", `${nf(d.dn, 1)} mm`],
            [`Dosis bruta = Dn / (Ea${s.lr > 0 ? " · (1 − LR)" : ""})`, `${nf(d.db, 1)} mm`],
            ...(!grav ? ([["Tiempo de riego = Db / pluviometría", hoursText(d.hours)], ["Infiltración del suelo", `≈ ${d.infil} mm/h ${d.rateOk ? "· correcto" : "· la supera"}`]] as [string, string][]) : []),
            ["Volumen por riego", `${nf(d.volM3, 0)} m³`],
            ["Volumen anual (necesidades brutas)", `${nf(s.tot.nb * 10 * parcel.areaHa, 0)} m³`],
          ]} />
        </section>
      </div>
    </div>
  );
}

function Steps({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col text-[13.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-linea-2 py-1.5 last:border-0">
          <dt className="text-tinta-2">{k}</dt>
          <dd className="num text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
