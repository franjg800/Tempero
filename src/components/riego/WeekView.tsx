"use client";

import { useState } from "react";
import Link from "next/link";
import { Kpi, Notice } from "@/components/ui";
import { WaterChart, WaterLegend } from "@/components/WaterChart";
import { useStore } from "@/lib/store";
import { sumLast, useWeather } from "@/lib/useWater";
import { systemRateMmH, waterBalance } from "@/lib/water";
import { cropById, MONTHS } from "@/lib/agro";
import { IRRIGATION } from "@/lib/irrigation";
import { hoursText, longDate, nf, todayIso } from "@/lib/format";
import type { Parcel } from "@/lib/types";

export function WeekView({ parcel, assume, setAssume, range }: { parcel: Parcel; assume: boolean; setAssume: (b: boolean) => void; range: number }) {
  const entries = useStore((s) => s.entries);
  const addEntry = useStore((s) => s.addEntry);
  const w = useWeather(parcel);
  const crop = cropById(parcel.cropId);
  const irrigated = parcel.irrigation.system !== "secano";
  const [done, setDone] = useState(false);

  if (w.error) return <div className="p-6"><Notice>No se han podido cargar los datos del tiempo: {w.error}. Comprueba tu conexión y vuelve a intentarlo.</Notice></div>;
  if (!w.data) return <div className="p-6 text-tinta-3">Cargando lluvia y evapotranspiración…</div>;

  const wb = waterBalance(parcel, w.data, entries, { assumePastIrrigation: assume });
  const t = wb.todayIndex;
  const rain7 = sumLast(w.data.rain, t, 7);
  const etc7 = wb.days.slice(Math.max(0, t - 6), t + 1).reduce((s, d) => s + d.etc, 0);
  const today = wb.days[t];
  const rate = systemRateMmH(parcel);
  const sys = IRRIGATION.find((s) => s.id === parcel.irrigation.system)!;
  const half = Math.floor(range / 2);
  const from = range === 7 ? t - 6 : t - (range - Math.min(7, wb.days.length - 1 - t)) + 1;
  const to = range === 7 ? t + 1 : t + Math.min(7, wb.days.length - 1 - t) + 1;
  void half;

  function markIrrigated() {
    if (!wb.next) return;
    addEntry({
      type: "riego", date: todayIso(), parcelIds: [parcel.id], status: "hecho",
      data: { mm: String(Math.round(wb.next.grossMm)), horas: wb.next.hours != null ? wb.next.hours.toFixed(1) : "", m3: String(Math.round(wb.next.volumeM3)), obs: "Anotado desde Riego" },
    });
    setDone(true);
  }

  return (
    <div className="enter flex flex-col gap-5 px-4 pt-2 pb-6 sm:px-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Kpi label="Lluvia · 7 días" value={nf(rain7, 1)} unit="mm" tone="water" sub={`Datos ${w.data.source} para la parcela`} />
        <Kpi label="Consumo del cultivo · 7 días" value={nf(etc7, 1)} unit="mm" sub={`ETo ${nf(today.et0, 1)} mm/d × Kc ${nf(today.kc, 2)}`} />
        <Kpi label="Agua útil en el suelo" value={nf(today.awPct, 0)} unit="%" tone="olive" sub={`Umbral de riego: ${Math.round(wb.thresholdPct)} %`} />
        {irrigated ? (
          <Kpi tone="solid-water" label="Riego propuesto" value={wb.next ? nf(wb.next.grossMm, 0) : "0"} unit="mm" sub={wb.next ? `${longDate(wb.next.date)} · ${hoursText(wb.next.hours)}` : "No hace falta en 7 días"} />
        ) : (
          <Kpi label="Riego" value="Secano" sub="Cambia el sistema en el mapa si riegas" />
        )}
      </div>

      <div className="flex flex-wrap gap-5">
        <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-3.5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2">Balance hídrico · {crop.name}</h2>
            <WaterLegend />
          </div>
          <WaterChart wb={wb} from={from} to={to} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-tinta-3">
            <span>Lluvia y ETo diarias de {w.data.source} (modelo meteorológico) para el centro de la parcela. Kc de {crop.name.toLowerCase()} hoy: {today.kc.toFixed(2)} ({MONTHS[new Date().getMonth()]}).</span>
            {irrigated && (
              <label className="flex items-center gap-2 text-[13px] text-tinta-2">
                <input type="checkbox" className="accent-olivo" checked={!assume} onChange={(e) => setAssume(!e.target.checked)} />Usar solo riegos anotados
              </label>
            )}
          </div>
        </section>

        <section className="card flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 p-5">
          <h2 className="h2">Qué hacer</h2>
          {!irrigated ? (
            <Notice tone="mute">Parcela de secano: el balance sirve para seguir la humedad del suelo. {today.awPct < wb.thresholdPct ? "El cultivo está por debajo del umbral, puede sufrir estrés." : "El suelo está por encima del umbral."}</Notice>
          ) : wb.noCropNow && !wb.next ? (
            <Notice tone="mute">Ahora no hay cultivo en la parcela según su fecha de siembra. No se propone riego.</Notice>
          ) : wb.next ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-acequia-claro p-3.5">
              <b className="font-display text-lg text-acequia-oscuro">Riega el {longDate(wb.next.date)}</b>
              <span className="text-sm leading-relaxed">El suelo baja del {Math.round(wb.thresholdPct)} % de agua útil. Con {nf(wb.next.netMm, 0)} mm netos vuelve a capacidad de campo.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 rounded-xl bg-olivo-claro p-3.5">
              <b className="font-display text-lg text-olivo-oscuro">No hace falta regar esta semana</b>
              <span className="text-sm">Con la lluvia y la previsión, el suelo se mantiene por encima del umbral.</span>
            </div>
          )}
          <dl className="flex flex-col text-sm">
            <Row k="Sistema" v={`${sys.name}${rate ? ` · ${nf(rate, 1)} mm/h` : ""}`} />
            <Row k="Eficiencia" v={`${Math.round(parcel.irrigation.efficiency * 100)} %`} />
            <Row k="Agua útil total" v={`${nf(wb.taw, 0)} mm`} />
            {wb.next && <Row k="Lámina bruta" v={`${nf(wb.next.grossMm, 1)} mm`} />}
            {wb.next && <Row k="Volumen total" v={`${nf(wb.next.volumeM3, 0)} m³`} />}
            {wb.next && <Row k="Tiempo de riego" v={hoursText(wb.next.hours)} />}
          </dl>
          <div className="flex-1" />
          {irrigated && wb.next && (
            <div className="flex gap-2.5">
              <button className="btn btn-water flex-1" onClick={markIrrigated} disabled={done}>{done ? "Anotado en el cuaderno" : "Marcar como regado hoy"}</button>
              <Link href="/app/mapa" className="btn btn-outline flex-1 border-acequia text-acequia">Cambiar datos</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-linea-2 py-2 last:border-0">
      <dt className="text-tinta-2">{k}</dt>
      <dd className="num text-right">{v}</dd>
    </div>
  );
}

export function IrrigatedTable({ parcels, assume, onPick }: { parcels: Parcel[]; assume: boolean; onPick: (id: string) => void }) {
  return (
    <section className="card mx-4 mb-6 animate-rise overflow-x-auto px-5 py-2 sm:mx-6">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3 border-b border-linea py-3 text-xs font-bold text-tinta-3">
          <span>PARCELAS DE REGADÍO</span><span>AGUA ÚTIL</span><span>PRÓXIMO RIEGO</span><span>DOSIS</span><span>ESTADO</span>
        </div>
        {parcels.map((p) => <IrrRow key={p.id} parcel={p} assume={assume} onPick={onPick} />)}
      </div>
    </section>
  );
}

function IrrRow({ parcel, assume, onPick }: { parcel: Parcel; assume: boolean; onPick: (id: string) => void }) {
  const entries = useStore((s) => s.entries);
  const w = useWeather(parcel);
  const wb = w.data ? waterBalance(parcel, w.data, entries, { assumePastIrrigation: assume }) : null;
  const today = wb?.days[wb.todayIndex];
  const isToday = wb?.next?.date === todayIso();
  return (
    <button className="grid w-full grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-linea-2 py-3 text-left text-sm last:border-0 hover:bg-rastrojo" onClick={() => onPick(parcel.id)}>
      <b>{parcel.name} · {cropById(parcel.cropId).name}</b>
      <span className="num">{today ? nf(today.awPct, 0) + " %" : "…"}</span>
      <span>{wb ? (wb.next ? (isToday ? "hoy" : longDate(wb.next.date)) : "no en 7 días") : "…"}</span>
      <span className="num">{wb?.next ? nf(wb.next.grossMm, 0) + " mm" : "—"}</span>
      <span>{wb ? (isToday ? <span className="chip chip-warn">Regar hoy</span> : <span className="chip chip-ok">Al día</span>) : null}</span>
    </button>
  );
}
