"use client";

import { useRef, useState } from "react";
import { TopBar } from "@/components/Sidebar";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { todayIso } from "@/lib/format";
import type { Farm } from "@/lib/types";

export default function AjustesPage() {
  const hyd = useHydrated();
  const { farm, setFarm, parcels, entries, importAll, reset } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  if (!hyd) return <TopBar title="Ajustes" />;

  function backup() {
    const blob = new Blob([JSON.stringify({ app: "tempero", v: 1, farm, parcels, entries }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tempero-copia-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function restore(f: File) {
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== "tempero" || !Array.isArray(j.parcels)) throw new Error("formato");
      if (!confirm(`Se sustituirán tus datos actuales por la copia (${j.parcels.length} parcelas, ${j.entries?.length ?? 0} anotaciones). ¿Seguir?`)) return;
      importAll(j);
      setMsg("Copia restaurada.");
    } catch {
      setMsg("Ese archivo no es una copia válida de Tempero.");
    }
  }

  const F = ({ k, label, ph }: { k: keyof Farm; label: string; ph?: string }) => (
    // función normal (no componente) para no perder el foco al escribir
    <label className="label">{label}<input className="input" value={farm[k]} placeholder={ph} onChange={(e) => setFarm({ [k]: e.target.value })} /></label>
  );

  return (
    <>
      <TopBar title="Ajustes" />
      <div className="grid max-w-5xl gap-5 p-6 lg:grid-cols-2">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="h2">Explotación</h2>
          {F({ k: "name", label: "Nombre de la explotación" })}
          <div className="grid grid-cols-2 gap-3">
            {F({ k: "holder", label: "Titular" })}
            {F({ k: "nif", label: "NIF" })}
            {F({ k: "rea", label: "Nº de registro (REA/REGEPA)" })}
            {F({ k: "campaign", label: "Campaña", ph: "2026/27" })}
          </div>
          {F({ k: "advisor", label: "Asesor (nombre y nº)" })}
          <p className="text-xs text-tinta-3">Estos datos salen en la cabecera del plan de abonado y del cuaderno.</p>
        </section>

        <section className="card flex flex-col gap-4 p-5">
          <h2 className="h2">Tus datos</h2>
          <Notice tone="water">En esta primera versión todo se guarda <b>solo en este navegador</b>. Si borras los datos del navegador o cambias de ordenador, se pierden. Haz copias de vez en cuando.</Notice>
          <div className="flex flex-wrap gap-2.5">
            <button className="btn btn-primary" onClick={backup}><Icon name="download" size={18} />Descargar copia</button>
            <button className="btn btn-outline" onClick={() => file.current?.click()}><Icon name="upload" size={18} />Restaurar copia</button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </div>
          {msg && <Notice tone="mute">{msg}</Notice>}
          <div className="flex-1" />
          <button className="btn btn-danger self-start" onClick={() => { if (confirm("¿Borrar todas las parcelas y anotaciones de este navegador? No se puede deshacer.")) reset(); }}><Icon name="trash" size={18} />Borrar todo</button>
        </section>

        <section className="card flex flex-col gap-3 p-5 lg:col-span-2">
          <h2 className="h2">Fuentes de datos</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-tinta-2">
            <li>Ortofoto PNOA y mapa base: Instituto Geográfico Nacional (IGN).</li>
            <li>Recintos SIGPAC: FEGA, servicio de teselas vectoriales (licencia CC BY 4.0).</li>
            <li>Lluvia y evapotranspiración (ETo FAO): Open-Meteo, modelo meteorológico para cada parcela. AEMET y estaciones SiAR llegarán en la fase 3.</li>
            <li>Relieve 3D: Terrain Tiles (AWS / Mapzen).</li>
            <li>Coeficientes de cultivo, suelos y extracciones: valores orientativos editables; revísalos con tu técnico.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
