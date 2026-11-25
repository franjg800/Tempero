"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useHydrated, useStore } from "@/lib/store";
import { SECTIONS } from "@/lib/notebook";
import { cropById } from "@/lib/crops";
import { fmtDate, nf, parcelNames, parcelsArea, sigpacCode, todayIso } from "@/lib/format";

export default function PrintNotebook() {
  const hyd = useHydrated();
  const { farm, parcels, entries } = useStore();
  if (!hyd) return null;
  return (
    <div className="mx-auto w-full max-w-[1100px] bg-white p-8 text-[12px] print:p-0">
      <div className="no-print mb-6 flex gap-3">
        <Link href="/app/cuaderno" className="btn btn-ghost"><Icon name="back" size={18} />Volver</Link>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={18} />Imprimir o guardar en PDF</button>
      </div>
      <header className="mb-5 flex items-end justify-between border-b-2 border-tinta pb-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Cuaderno de campo · campaña {farm.campaign}</h1>
          <p className="text-sm">{farm.name}{farm.holder && ` · Titular: ${farm.holder}`}{farm.nif && ` · NIF ${farm.nif}`}{farm.rea && ` · REA ${farm.rea}`}</p>
        </div>
        <p className="text-right text-xs text-tinta-2">Generado el {fmtDate(todayIso())}<br />Cuaderno de apoyo · no sustituye al CUE oficial</p>
      </header>

      <h2 className="mt-4 mb-2 font-display text-base font-bold">Parcelas</h2>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-tinta text-left">{["Nombre", "SIGPAC", "Uso", "Sup. (ha)", "Cultivo", "Variedad", "Regadío"].map((h) => <th key={h} className="py-1 pr-2">{h}</th>)}</tr></thead>
        <tbody>
          {parcels.map((p) => (
            <tr key={p.id} className="border-b border-linea">
              <td className="py-1 pr-2 font-semibold">{p.name}</td><td className="code py-1 pr-2">{sigpacCode(p.sigpac)}</td><td className="py-1 pr-2">{p.usoSigpac ?? ""}</td>
              <td className="num py-1 pr-2">{nf(p.areaHa, 2)}</td><td className="py-1 pr-2">{cropById(p.cropId).name}</td><td className="py-1 pr-2">{p.variety}</td><td className="py-1 pr-2">{p.irrigation.system === "secano" ? "No" : "Sí"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {SECTIONS.map((s) => {
        const list = entries.filter((e) => e.type === s.type && e.status === "hecho").sort((a, b) => a.date.localeCompare(b.date));
        if (!list.length) return null;
        const fields = s.fields;
        return (
          <section key={s.type} className="break-inside-avoid-page">
            <h2 className="mt-6 mb-2 font-display text-base font-bold">{s.name}</h2>
            <table className="w-full border-collapse">
              <thead><tr className="border-b border-tinta text-left align-bottom"><th className="py-1 pr-2">Fecha</th><th className="py-1 pr-2">Parcelas</th><th className="py-1 pr-2">Sup. (ha)</th>{fields.map((f) => <th key={f.key} className="py-1 pr-2">{f.label.split(" (")[0]}{f.unit ? ` (${f.unit})` : ""}</th>)}</tr></thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-linea align-top">
                    <td className="num py-1 pr-2">{fmtDate(e.date)}</td><td className="py-1 pr-2">{parcelNames(e.parcelIds, parcels)}</td><td className="num py-1 pr-2">{nf(parcelsArea(e.parcelIds, parcels), 2)}</td>
                    {fields.map((f) => <td key={f.key} className="py-1 pr-2">{e.data[f.key] ?? ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
