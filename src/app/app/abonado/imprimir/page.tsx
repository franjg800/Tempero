"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useHydrated, useStore } from "@/lib/store";
import { cropById, MONTHS } from "@/lib/crops";
import { fertPlan } from "@/lib/fert";
import { fmtDate, nf, sigpacCode, todayIso } from "@/lib/format";

export default function PrintPlan() {
  const hyd = useHydrated();
  const { farm, parcels } = useStore();
  if (!hyd) return null;
  return (
    <div className="mx-auto w-full max-w-[1100px] bg-white p-8 print:p-0">
      <div className="no-print mb-6 flex gap-3">
        <Link href="/app/abonado" className="btn btn-ghost"><Icon name="back" size={18} />Volver</Link>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={18} />Imprimir o guardar en PDF</button>
      </div>
      <header className="mb-6 flex items-end justify-between border-b-2 border-tinta pb-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Plan de abonado · campaña {farm.campaign}</h1>
          <p className="text-sm">{farm.name}{farm.holder && ` · Titular: ${farm.holder}`}{farm.nif && ` · NIF ${farm.nif}`}{farm.rea && ` · REA ${farm.rea}`}</p>
        </div>
        <p className="text-right text-xs text-tinta-2">Elaborado el {fmtDate(todayIso())}{farm.advisor && <><br />Asesor: {farm.advisor}</>}</p>
      </header>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-tinta text-left">
            {["Parcela", "SIGPAC", "Sup. (ha)", "Cultivo", "Suelo", "Rend. obj.", "N kg/ha", "P₂O₅ kg/ha", "K₂O kg/ha", "Reparto del N"].map((h) => <th key={h} className="py-1.5 pr-2">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => {
            const fp = fertPlan(p);
            const c = cropById(p.cropId);
            return (
              <tr key={p.id} className="border-b border-linea align-top">
                <td className="py-1.5 pr-2 font-semibold">{p.name}{p.vulnerable && " (ZV)"}</td>
                <td className="code py-1.5 pr-2">{sigpacCode(p.sigpac)}</td>
                <td className="num py-1.5 pr-2">{nf(p.areaHa, 2)}</td>
                <td className="py-1.5 pr-2">{c.name}</td>
                <td className="py-1.5 pr-2">{p.soil}{p.analysis.pOlsenPpm != null ? ` · P ${p.analysis.pOlsenPpm} · K ${p.analysis.kPpm ?? "—"} ppm` : " · sin análisis"}</td>
                <td className="num py-1.5 pr-2">{nf(p.fert.yieldT, 1)} {c.unit}</td>
                <td className="num py-1.5 pr-2">{nf(fp.applyN, 0)}</td>
                <td className="num py-1.5 pr-2">{nf(fp.applyP, 0)}</td>
                <td className="num py-1.5 pr-2">{nf(fp.applyK, 0)}</td>
                <td className="py-1.5">{fp.fractions.filter((f) => f.kgN > 0).map((f) => `${f.label} (${MONTHS[f.month]}): ${nf(f.kgN, 0)}`).join(" · ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-5 text-[11px] leading-relaxed text-tinta-2">
        Balance de nitrógeno: necesidades del cultivo (rendimiento objetivo × extracción) menos N mineral del suelo, N del agua de riego, cultivo anterior y aportes orgánicos. P y K: extracción corregida según el nivel del análisis de suelo.
        (ZV) parcela en zona vulnerable: se aplican los límites del programa de actuación de la comunidad autónoma. Documento de apoyo generado con Tempero; revisa los coeficientes con tu técnico.
      </p>
    </div>
  );
}
