"use client";

import writeXlsxFile from "write-excel-file";
import type { Entry, Farm, Parcel } from "./types";
import { SECTIONS } from "./notebook";
import { fmtDate, parcelNames, parcelsArea, sigpacCode } from "./format";
import { cropById } from "./agro";

type Cell = { value: string | number; fontWeight?: "bold"; type?: StringConstructor | NumberConstructor } | null;

export async function exportNotebookXlsx(farm: Farm, parcels: Parcel[], entries: Entry[]) {
  const sheets: string[] = [];
  const data: Cell[][][] = [];

  // Hoja de parcelas
  const head = (labels: string[]): Cell[] => labels.map((l) => ({ value: l, fontWeight: "bold" as const }));
  sheets.push("Parcelas");
  data.push([
    head(["Nombre", "Código SIGPAC", "Uso SIGPAC", "Superficie (ha)", "Cultivo", "Variedad", "Regadío", "Zona vulnerable"]),
    ...parcels.map((p) => [
      { value: p.name },
      { value: sigpacCode(p.sigpac) },
      { value: p.usoSigpac ?? "" },
      { value: Number(p.areaHa.toFixed(4)), type: Number },
      { value: cropById(p.cropId).name },
      { value: p.variety },
      { value: p.irrigation.system === "secano" ? "No" : "Sí" },
      { value: p.vulnerable ? "Sí" : "No" },
    ] as Cell[]),
  ]);

  for (const s of SECTIONS) {
    const list = entries.filter((e) => e.type === s.type && e.status === "hecho").sort((a, b) => a.date.localeCompare(b.date));
    sheets.push(s.short);
    data.push([
      head(["Fecha", "Parcelas", "Códigos SIGPAC", "Superficie (ha)", "Cultivo", ...s.fields.map((f) => f.label + (f.unit ? ` (${f.unit})` : ""))]),
      ...list.map((e) => {
        const ps = e.parcelIds.map((id) => parcels.find((p) => p.id === id)).filter(Boolean) as Parcel[];
        return [
          { value: fmtDate(e.date) },
          { value: parcelNames(e.parcelIds, parcels) },
          { value: ps.map((p) => sigpacCode(p.sigpac)).join(" · ") },
          { value: Number(parcelsArea(e.parcelIds, parcels).toFixed(4)), type: Number },
          { value: [...new Set(ps.map((p) => cropById(p.cropId).name))].join(", ") },
          ...s.fields.map((f) => ({ value: e.data[f.key] ?? "" })),
        ] as Cell[];
      }),
    ]);
  }

  sheets.unshift("Explotación");
  data.unshift([
    head(["Dato", "Valor"]),
    [{ value: "Explotación" }, { value: farm.name }],
    [{ value: "Titular" }, { value: farm.holder }],
    [{ value: "NIF" }, { value: farm.nif }],
    [{ value: "Nº de registro de explotación" }, { value: farm.rea }],
    [{ value: "Campaña" }, { value: farm.campaign }],
    [{ value: "Asesor" }, { value: farm.advisor }],
    [{ value: "Generado con" }, { value: "Tempero · cuaderno de apoyo, no sustituye al cuaderno oficial (CUE)" }],
  ]);

  await writeXlsxFile(data as never, { sheets, fileName: `cuaderno-${farm.campaign.replace("/", "-")}.xlsx` } as never);
}
