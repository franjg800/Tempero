"use client";

import type { IrrigationSystem, Parcel, SoilTexture } from "@/lib/types";
import { CROPS, IRRIGATION, SOILS, USOS_SIGPAC } from "@/lib/crops";
import { useStore } from "@/lib/store";
import { NumberInput } from "./ui";
import { systemRateMmH } from "@/lib/water";
import { nf } from "@/lib/format";

export function ParcelEditor({ parcel }: { parcel: Parcel }) {
  const update = useStore((s) => s.updateParcel);
  const set = (patch: Partial<Parcel>) => update(parcel.id, patch);
  const ir = parcel.irrigation;
  const setIr = (patch: Partial<Parcel["irrigation"]>) => set({ irrigation: { ...ir, ...patch } });
  const rate = systemRateMmH(parcel);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="label col-span-2">Nombre
          <input className="input" value={parcel.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="label">Cultivo
          <select className="input" value={parcel.cropId} onChange={(e) => {
            const c = CROPS.find((x) => x.id === e.target.value)!;
            set({ cropId: c.id, fert: { ...parcel.fert, yieldT: c.yieldT, overrides: {} } });
          }}>
            {CROPS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="label">Variedad
          <input className="input" value={parcel.variety} onChange={(e) => set({ variety: e.target.value })} placeholder="Opcional" />
        </label>
        <label className="label">Suelo
          <select className="input" value={parcel.soil} onChange={(e) => set({ soil: e.target.value as SoilTexture })}>
            {SOILS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="label">Riego
          <select className="input" value={ir.system} onChange={(e) => {
            const sys = e.target.value as IrrigationSystem;
            setIr({ system: sys, efficiency: IRRIGATION.find((x) => x.id === sys)!.eff });
          }}>
            {IRRIGATION.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      {ir.system !== "secano" && (
        <fieldset className="grid grid-cols-2 gap-3 rounded-xl border border-linea p-3">
          <legend className="px-1 text-xs font-bold tracking-wide text-tinta-3">SISTEMA DE RIEGO</legend>
          {ir.system === "goteo" ? (
            <>
              <label className="label">Caudal gotero (L/h)<NumberInput value={ir.emitterFlowLh} onChange={(v) => setIr({ emitterFlowLh: v ?? 0 })} /></label>
              <label className="label">Entre goteros (m)<NumberInput value={ir.emitterSpacingM} onChange={(v) => setIr({ emitterSpacingM: v ?? 0 })} /></label>
              <label className="label">Entre ramales (m)<NumberInput value={ir.lineSpacingM} onChange={(v) => setIr({ lineSpacingM: v ?? 0 })} /></label>
            </>
          ) : ir.system !== "gravedad" ? (
            <label className="label">Pluviometría (mm/h)<NumberInput value={ir.rateMmH} onChange={(v) => setIr({ rateMmH: v ?? 0 })} /></label>
          ) : null}
          <label className="label">Eficiencia (%)<NumberInput value={Math.round(ir.efficiency * 100)} onChange={(v) => setIr({ efficiency: Math.min(1, Math.max(0.1, (v ?? 100) / 100)) })} /></label>
          {rate != null && <p className="col-span-2 text-xs text-tinta-3">Aplica {nf(rate, 1)} mm cada hora.</p>}
        </fieldset>
      )}

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" className="h-4.5 w-4.5 accent-olivo" checked={parcel.vulnerable} onChange={(e) => set({ vulnerable: e.target.checked })} />
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
