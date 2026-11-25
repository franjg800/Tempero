"use client";

import type { Parcel } from "@/lib/types";
import type { Climate } from "@/lib/climate";
import type { Study } from "@/lib/study";
import { MON3, MONTHS } from "@/lib/agro";
import { IRRIGATION } from "@/lib/irrigation";
import { nf } from "@/lib/format";
import { Kpi, Notice } from "@/components/ui";

function order(s: Study) {
  const start = s.A.kcm ? 0 : Math.min(11, Math.floor(s.sowDoy / 30.42));
  return s.months.slice(start).concat(s.months.slice(0, start)).filter((m) => m.kc != null);
}

function MonthChart({ s, secano }: { s: Study; secano: boolean }) {
  const rows = order(s);
  const W = 760, H = 260, L = 44, R = 16, T = 14, B = 34;
  const max = Math.max(10, ...rows.map((r) => Math.max(r.etc, r.pe, secano ? r.nn : r.nb))) * 1.1;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const step = (W - L - R) / Math.max(1, rows.length);
  const bw = Math.min(18, step * 0.28);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((max * f) / 5) * 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Necesidades de riego por mes" className="block h-auto w-full">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={i === 0 ? "#B8B5A8" : "#ECEAE2"} />
          <text x={L - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#5E6A62">{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x = L + step * i + step / 2;
        const need = secano ? r.nn : r.nb;
        return (
          <g key={r.m}>
            <rect x={x - bw - 1} y={y(r.pe)} width={bw} height={y(0) - y(r.pe)} rx="3" fill="#7FB0D6" />
            <rect x={x + 1} y={y(need)} width={bw} height={y(0) - y(need)} rx="3" fill={secano ? "#D9A21B" : "#1E6AA0"} />
            <text x={x} y={H - B + 18} fontSize="11.5" textAnchor="middle" fill="#46554B">{MON3[r.m]}</text>
          </g>
        );
      })}
      <polyline points={rows.map((r, i) => `${L + step * i + step / 2},${y(r.etc)}`).join(" ")} fill="none" stroke="#A85A24" strokeWidth="2.5" />
      {rows.map((r, i) => <circle key={r.m} cx={L + step * i + step / 2} cy={y(r.etc)} r="3" fill="#A85A24" />)}
    </svg>
  );
}

function BalanceChart({ s, secano }: { s: Study; secano: boolean }) {
  const sim = s.med;
  if (!sim || !sim.series.length) return null;
  const W = 760, H = 200, L = 44, R = 12, T = 10, B = 26;
  const n = sim.series[sim.series.length - 1][0] + 1;
  const mx = Math.max(...sim.series.map((x) => x[3])) || 1;
  const X = (i: number) => L + (i / n) * (W - L - R);
  const Y = (v: number) => T + (H - T - B) * (v / mx);
  const path = (k: 1 | 2) => sim.series.map((x, j) => (j ? "L" : "M") + X(x[0]).toFixed(1) + " " + Y(x[k]).toFixed(1)).join("");
  const monthTicks: { i: number; m: number }[] = [];
  for (let i = 0; i < n; i += 30.42 * (n > 200 ? 2 : 1)) monthTicks.push({ i, m: Math.floor(((s.sowDoy + i) % 365) / 30.42) });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Agotamiento del agua del suelo en el año mediano" className="block h-auto w-full">
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="#F3F2EC" rx="6" />
      <text x={L - 8} y={T + 10} fontSize="11" textAnchor="end" fill="#5E6A62">0</text>
      <text x={L - 8} y={H - B} fontSize="11" textAnchor="end" fill="#5E6A62">{Math.round(mx)}</text>
      <path d={path(2)} fill="none" stroke="#D9A21B" strokeWidth="1.8" strokeDasharray="5 4" />
      <path d={path(1)} fill="none" stroke="#2E5B3B" strokeWidth="2" />
      {!secano && sim.series.filter((x) => x[4] > 0).map((x, j) => <line key={j} x1={X(x[0])} x2={X(x[0])} y1={H - B} y2={H - B - 9} stroke="#1E6AA0" strokeWidth="1.6" />)}
      {monthTicks.map((t, j) => <text key={j} x={X(t.i)} y={H - 8} fontSize="11" fill="#5E6A62">{MON3[t.m]}</text>)}
    </svg>
  );
}

export function AnnualPlan({ parcel, s, cl }: { parcel: Parcel; s: Study; cl: Climate }) {
  const secano = parcel.irrigation.system === "secano";
  const sys = IRRIGATION.find((x) => x.id === parcel.irrigation.system)!;
  const rows = order(s);
  const ha = parcel.areaHa;
  const nets = s.sims.map((x) => x.net), ns = s.sims.map((x) => x.n);
  const local = parcel.irrigation.system === "goteo" || parcel.irrigation.system === "microaspersion";
  return (
    <div className="enter flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <Kpi label={s.A.kcm ? "ETc anual" : "ETc del ciclo"} value={nf(s.tot.etc, 0)} unit="mm" sub={`ETo anual ${nf(cl.et0, 0)} mm`} />
        <Kpi label="Lluvia efectiva" value={nf(s.tot.pe, 0)} unit="mm" tone="water" sub={`Lluvia media ${nf(cl.p, 0)} mm/año`} />
        <Kpi label={secano ? "Déficit (secano)" : "Necesidades netas"} value={nf(s.tot.nn, 0)} unit="mm" tone={secano ? "earth" : undefined} />
        {secano ? (
          <Kpi label="Riego" value="Secano" sub="Elige un sistema para calcular el riego" />
        ) : (
          <Kpi tone="solid-water" label="Necesidades brutas" value={nf(s.tot.nb, 0)} unit="mm" sub={`${nf(s.tot.nb * 10, 0)} m³/ha · ${nf(s.tot.nb * 10 * ha, 0)} m³ en la parcela`} />
        )}
      </div>

      <div className="flex flex-wrap gap-5">
        <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2">Necesidades mes a mes</h2>
            <div className="flex flex-wrap gap-4 text-[13px] text-tinta-2">
              <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-[#7FB0D6]" />Lluvia efectiva</span>
              <span className="flex items-center gap-1.5"><i className={`h-3 w-3 rounded-[3px] ${secano ? "bg-trigo" : "bg-acequia"}`} />{secano ? "Déficit" : "Riego bruto"}</span>
              <span className="flex items-center gap-1.5"><i className="h-[3px] w-3.5 bg-barro" />ETc</span>
            </div>
          </div>
          <MonthChart s={s} secano={secano} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-linea text-left text-xs font-bold text-tinta-3">
                  {["MES", "ETo", "Kc", "ETc", "LLUVIA", "Pe", "NN", secano ? "" : "NB", secano ? "" : "m³ PARCELA"].map((h, i) => <th key={i} className={`py-2 pr-3 ${i ? "text-right" : ""}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.m} className={`border-b border-linea-2 ${m.m === s.peak && !secano ? "bg-acequia-claro/60" : ""}`}>
                    <td className="py-1.5 pr-3 capitalize">{MONTHS[m.m]}</td>
                    <td className="num py-1.5 pr-3 text-right">{nf(m.et0, 0)}</td>
                    <td className="num py-1.5 pr-3 text-right">{nf(m.kc ?? 0, 2)}</td>
                    <td className="num py-1.5 pr-3 text-right">{nf(m.etc, 0)}</td>
                    <td className="num py-1.5 pr-3 text-right">{nf(m.p, 0)}</td>
                    <td className="num py-1.5 pr-3 text-right">{nf(m.pe, 0)}</td>
                    <td className="num py-1.5 pr-3 text-right">{nf(m.nn, 0)}</td>
                    <td className="num py-1.5 pr-3 text-right font-semibold">{secano ? "" : nf(m.nb, 0)}</td>
                    <td className="num py-1.5 text-right">{secano ? "" : nf(m.nb * 10 * ha, 0)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  <td className="num py-2 pr-3 text-right">{nf(rows.reduce((a, m) => a + m.et0, 0), 0)}</td>
                  <td />
                  <td className="num py-2 pr-3 text-right">{nf(s.tot.etc, 0)}</td>
                  <td className="num py-2 pr-3 text-right">{nf(rows.reduce((a, m) => a + m.p, 0), 0)}</td>
                  <td className="num py-2 pr-3 text-right">{nf(s.tot.pe, 0)}</td>
                  <td className="num py-2 pr-3 text-right">{nf(s.tot.nn, 0)}</td>
                  <td className="num py-2 pr-3 text-right">{secano ? "" : nf(s.tot.nb, 0)}</td>
                  <td className="num py-2 text-right">{secano ? "" : nf(s.tot.nb * 10 * ha, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-tinta-3">mm al mes. NN = ETc − Pe. {secano ? "" : local ? `NB = NN / ((1 − K) · CU), con K = ${nf(s.K, 2)} y CU = ${nf(parcel.irrigation.cu, 2)}.` : `NB = NN / eficiencia (${Math.round(s.eff * 100)} %${s.lr > 0 ? `) × lavado (${nf(s.lr * 100, 0)} %` : ""}).`} Mes punta resaltado.</p>
        </section>

        <section className="card flex min-w-0 flex-[1_1_330px] flex-col gap-3 p-5">
          <h2 className="h2">Cómo se ha calculado</h2>
          <dl className="flex flex-col text-[13.5px]">
            <Row k="Clima" v={`${cl.from}–${cl.to} (${s.years} años)`} />
            <Row k="Suelo" v={`${s.soil.tex} · ${nf(s.soil.awc, 0)} mm/m`} />
            {s.ks.kmid != null ? (
              <>
                <Row k="Siembra" v={parcel.sowDate ? new Date(parcel.sowDate + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : MONTHS[(s.A.sow ?? 4) - 1]} />
                <Row k="Etapas (días)" v={`${s.A.L!.join(" + ")} = ${s.A.L!.reduce((a, b) => a + b, 0)}`} />
                <Row k="Kc inicial" v={nf(s.ks.kini!, 2)} />
                <Row k="Kc medio (corregido)" v={`${nf(s.ks.kmid, 2)} · tabla ${nf(s.A.k![1], 2)}`} />
                <Row k="Kc final (corregido)" v={nf(s.ks.kend!, 2)} />
              </>
            ) : (
              <Row k="Kc" v="Mensual de leñoso" />
            )}
            {s.crop.woody && <Row k={local ? "Kl (localización)" : "Kr (cobertura)"} v={nf(local ? s.kl : s.kr, 2)} />}
            <Row k="Profundidad de raíces" v={`${nf(s.A.zr[0], 1)}–${nf(s.A.zr[1], 1)} m`} />
            <Row k="ADT · AFA" v={`${nf(s.adtMax, 0)} mm · p = ${nf(s.A.p, 2)}`} />
            {!secano && <Row k="Sistema" v={`${sys.name} · ${Math.round(s.eff * 100)} %`} />}
          </dl>
          <p className="text-xs leading-relaxed text-tinta-3">FAO-56: ETc = ETo · Kc, Kc medio y final corregidos con la humedad mínima y el viento de tu parcela (ec. 62). Lluvia efectiva mensual por USDA-SCS. Datos del cultivo de Brote (FAO-56). Clima diario de Open-Meteo (reanálisis ERA5) en el centro de la parcela.</p>
        </section>
      </div>

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h2">Agua del suelo en un año normal <span className="font-sans text-[15px] font-normal text-tinta-3">· año mediano {s.med?.y}</span></h2>
          <div className="flex flex-wrap gap-4 text-[13px] text-tinta-2">
            <span className="flex items-center gap-1.5"><i className="h-[3px] w-3.5 bg-olivo" />Agotamiento (DAS)</span>
            <span className="flex items-center gap-1.5"><i className="h-[3px] w-3.5 bg-trigo" />Umbral AFA = p · ADT</span>
            {!secano && <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] bg-acequia" />Riegos</span>}
          </div>
        </div>
        <BalanceChart s={s} secano={secano} />
        {!secano && s.med && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-[13.5px]">
            <Fact k={local ? "Días de riego (año mediano)" : "Riegos (año mediano)"} v={`${s.med.n} · de ${Math.min(...ns)} a ${Math.max(...ns)} según el año`} />
            <Fact k="Dosis neta media" v={`${nf(s.med.n ? s.med.net / s.med.n : 0, 1)} mm`} />
            <Fact k="Riego neto en el año" v={`${nf(Math.min(...nets), 0)}–${nf(Math.max(...nets), 0)} mm`} />
            <Fact k="Bruto año mediano" v={`${nf(s.med.net / s.denom, 0)} mm · ${nf((s.med.net / s.denom) * 10 * parcel.areaHa, 0)} m³`} />
          </div>
        )}
        {secano && <Notice tone="mute">En secano el cultivo pasa sed cuando la línea verde baja del umbral amarillo.</Notice>}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-linea-2 py-1.5 last:border-0">
      <dt className="text-tinta-2">{k}</dt>
      <dd className="num text-right">{v}</dd>
    </div>
  );
}
function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-rastrojo px-3 py-2.5">
      <span className="block text-xs font-semibold text-tinta-3">{k}</span>
      <span className="num font-semibold">{v}</span>
    </div>
  );
}
