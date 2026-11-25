"use client";

import { Icon } from "./Icon";
import type { Parcel } from "@/lib/types";
import { cropById } from "@/lib/agro";
import Link from "next/link";

export function Kpi({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: "water" | "earth" | "olive" | "solid-water" }) {
  const color = tone === "water" ? "text-acequia" : tone === "earth" ? "text-barro" : tone === "olive" ? "text-olivo" : "text-tinta";
  if (tone === "solid-water")
    return (
      <div className="flex flex-col gap-1 rounded-[14px] bg-acequia p-4 text-white">
        <span className="text-xs font-bold tracking-wide text-[#D3E5F3] uppercase">{label}</span>
        <span className="num text-[28px] font-semibold">{value} {unit && <small className="text-[15px]">{unit}</small>}</span>
        {sub && <span className="text-[13px] text-[#D3E5F3]">{sub}</span>}
      </div>
    );
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="kpi-label">{label}</span>
      <span className={`num text-[28px] font-semibold ${color}`}>{value} {unit && <small className="text-[15px]">{unit}</small>}</span>
      {sub && <span className="text-[13px] text-tinta-2">{sub}</span>}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "water" | "earth" | "mute"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "bg-trigo-claro text-[#4D3905]" : tone === "water" ? "bg-acequia-claro text-tinta" : tone === "earth" ? "bg-barro-claro text-[#5C3110]" : "bg-linea-2 text-tinta-2";
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed ${cls}`}>
      {tone === "warn" && <Icon name="warn" size={18} className="mt-0.5 flex-none text-[#8A6508]" stroke={1.9} />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ParcelSelect({ parcels, value, onChange, filter }: { parcels: Parcel[]; value: string | null; onChange: (id: string) => void; filter?: (p: Parcel) => boolean }) {
  const list = filter ? parcels.filter(filter) : parcels;
  return (
    <select className="input h-10 w-auto min-w-56 font-semibold" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label="Parcela">
      {list.map((p) => (
        <option key={p.id} value={p.id}>{p.name} · {cropById(p.cropId).name} · {p.areaHa.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ha</option>
      ))}
    </select>
  );
}

export function EmptyParcels({ what }: { what: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="card flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-olivo-claro text-olivo"><Icon name="map" size={28} /></span>
        <h2 className="h2">Primero, tus parcelas</h2>
        <p className="text-tinta-2">Para ver {what} necesitas añadir al menos una parcela en el mapa. Puedes elegir tus recintos SIGPAC con un clic.</p>
        <Link href="/app/mapa" className="btn btn-primary">Ir al mapa</Link>
      </div>
    </div>
  );
}

export function NumberInput({ value, onChange, step = "any", min, ...rest }: { value: number | null; onChange: (v: number | null) => void; step?: string; min?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      className={"input num " + (rest.className ?? "")}
      value={value == null || Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}
