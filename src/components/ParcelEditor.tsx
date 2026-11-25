"use client";

import Link from "next/link";
import type { IrrigationSystem, Parcel } from "@/lib/types";
import { CROPS, GROUPS, cropById } from "@/lib/agro";
import { IRRIGATION, USOS_SIGPAC } from "@/lib/irrigation";
import { TEXTURES, soilProps } from "@/lib/soil";
import { defaultSow, useStore } from "@/lib/store";
import { NumberInput } from "./ui";
import { nf } from "@/lib/format";

export function CropSelect({ value, onChange, className = "input" }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {CROPS.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function ParcelEditor({ parcel }: { parcel: Parcel }) {
  const update = useStore((s) => s.updateParcel);
  const set = (patch: Partial<Parcel>) => update(parcel.id, patch);
  const ir = parcel.irrigation;
  const c = cropById(parcel.cropId);
  const soil = soilProps(parcel.soil, parcel.analysis.organicMatterPct);
  const plants = c.agro && !c.agro.seed ? (parcel.areaHa * 10000) / Math.max(0.01, parcel.spacing[0] * parcel.spacing[1]) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="label col-span-2">Nombre
          <input className="input" value={parcel.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="label">Cultivo
          <CropSelect value={parcel.cropId} onChange={(id) => {
            const n = cropById(id);
            set({ cropId: id, sowDate: defaultSow(id), spacing: n.agro ? [n.agro.sp[0], n.agro.sp[1]] : parcel.spacing, fert: { ...parcel.fert, yieldT: n.agro?.y ?? 0, overrides: {} } });
          }} />
        </label>
        <label className="label">Variedad
          <input className="input" value={parcel.variety} onChange={(e) => set({ variety: e.target.value })} placeholder="Opcional" />
        </label>
        {c.agro && !c.woody && (
          <label className="label">Siembra o trasplante
            <input type="date" className="input num" value={parcel.sowDate ?? ""} onChange={(e) => set({ sowDate: e.target.value || null })} />
          </label>
        )}
        {c.woody && (
          <label className="label">Cobertura de la copa (%)
            <NumberInput value={parcel.coverPct} onChange={(v) => set({ coverPct: Math.min(100, Math.max(5, v ?? 50)) })} />
          </label>
        )}
        {c.agro && (
          <label className="label">Rendimiento ({c.unit})
            <NumberInput value={parcel.fert.yieldT} onChange={(v) => set({ fert: { ...parcel.fert, yieldT: v ?? 0 } })} />
          </label>
        )}
        {c.agro && !c.agro.seed && (
          <>
            <label className="label">Entre líneas (m)<NumberInput value={parcel.spacing[0]} onChange={(v) => set({ spacing: [Math.max(0.05, v ?? 1), parcel.spacing[1]] })} /></label>
            <label className="label">Entre plantas (m)<NumberInput value={parcel.spacing[1]} onChange={(v) => set({ spacing: [parcel.spacing[0], Math.max(0.01, v ?? 1)] })} /></label>
          </>
        )}
      </div>
      {plants != null && <p className="-mt-1 text-xs text-tinta-3">Marco {nf(parcel.spacing[0], 2)} × {nf(parcel.spacing[1], 2)} m · unas {nf(plants, 0)} plantas en la parcela ({nf(10000 / (parcel.spacing[0] * parcel.spacing[1]), 0)}/ha).</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="label">Textura del suelo
          <select className="input" value={soil.tex} onChange={(e) => set({ soil: e.target.value })}>
            {TEXTURES.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
          </select>
        </label>
        <label className="label">Materia orgánica (%)
          <NumberInput value={parcel.analysis.organicMatterPct} placeholder="1,5" onChange={(v) => set({ analysis: { ...parcel.analysis, organicMatterPct: v } })} />
        </label>
        <p className="col-span-2 -mt-1 text-xs text-tinta-3">Agua útil {nf(soil.awc, 0)} mm/m · capacidad de campo {nf(soil.fc * 100, 0)} % · punto de marchitez {nf(soil.wp * 100, 0)} % (Saxton y Rawls).</p>
        <label className="label">Sistema de riego
          <select className="input" value={ir.system} onChange={(e) => {
            const sys = e.target.value as IrrigationSystem;
            const d = IRRIGATION.find((x) => x.id === sys)!;
            set({ irrigation: { ...ir, system: sys, efficiency: d.eff, emitterFlowLh: sys === "microaspersion" ? 35 : sys === "goteo" && ir.emitterFlowLh > 16 ? 2.2 : ir.emitterFlowLh, emittersPerPlant: sys === "microaspersion" ? 1 : ir.emittersPerPlant } });
          }}>
            {IRRIGATION.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {ir.system !== "secano" && (
          <label className="label">Eficiencia (%)<NumberInput value={Math.round(ir.efficiency * 100)} onChange={(v) => set({ irrigation: { ...ir, efficiency: Math.min(1, Math.max(0.3, (v ?? 90) / 100)) } })} /></label>
        )}
      </div>
      {ir.system !== "secano" && (
        <Link href="/app/riego?vista=diseno" className="-mt-1 text-[13px] font-semibold text-acequia underline-offset-2 hover:underline">Diseñar el riego de esta parcela →</Link>
      )}

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" className="h-4 w-4 accent-olivo" checked={parcel.vulnerable} onChange={(e) => set({ vulnerable: e.target.checked })} />
        En zona vulnerable a nitratos
      </label>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-rastrojo p-3 text-[13px]">
        <dt className="text-tinta-3">Uso SIGPAC</dt><dd className="text-right">{parcel.usoSigpac ? `${parcel.usoSigpac} · ${USOS_SIGPAC[parcel.usoSigpac] ?? ""}` : "—"}</dd>
        <dt className="text-tinta-3">Pendiente media</dt><dd className="num text-right">{parcel.slopePct != null ? nf(parcel.slopePct, 1) + " %" : "—"}</dd>
        <dt className="text-tinta-3">Altitud</dt><dd className="num text-right">{parcel.altitudeM != null ? parcel.altitudeM + " m" : "—"}</dd>
      </dl>
    </div>
  );
}
