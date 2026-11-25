// Definición de las secciones del cuaderno de campo (apoyo), inspirada en el modelo oficial.
import type { EntryType } from "./types";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  unit?: string;
  wide?: boolean;
  hint?: string;
};

export type SectionDef = { type: EntryType; name: string; short: string; color: string; fields: FieldDef[] };

export const SECTIONS: SectionDef[] = [
  {
    type: "tratamiento", name: "Tratamientos fitosanitarios", short: "Tratamientos", color: "#8A6508",
    fields: [
      { key: "problema", label: "Problema que se trata (plaga, enfermedad, malas hierbas)", required: true, wide: true },
      { key: "producto", label: "Producto (nombre comercial)", required: true },
      { key: "registro", label: "Nº de registro del producto", required: true },
      { key: "dosis", label: "Dosis", required: true },
      { key: "unidadDosis", label: "Unidad", type: "select", options: ["L/ha", "kg/ha", "mL/hL", "g/hL", "%"] },
      { key: "caldo", label: "Volumen de caldo", unit: "L/ha", type: "number" },
      { key: "aplicador", label: "Aplicador (nombre)", required: true },
      { key: "carne", label: "Nº de carné o ROPO del aplicador", required: true },
      { key: "equipo", label: "Equipo de aplicación" },
      { key: "roma", label: "Nº de inscripción ROMA del equipo" },
      { key: "asesor", label: "Asesor (si lo hay)" },
      { key: "eficacia", label: "Eficacia", type: "select", options: ["", "Buena", "Regular", "Mala"] },
      { key: "obs", label: "Observaciones", type: "textarea", wide: true },
    ],
  },
  {
    type: "fertilizacion", name: "Fertilización", short: "Fertilización", color: "#A85A24",
    fields: [
      { key: "momento", label: "Momento (fondo, cobertera…)" },
      { key: "tipo", label: "Tipo de fertilizante", type: "select", options: ["Mineral", "Orgánico (estiércol, purín…)", "Órgano-mineral", "Enmienda"], required: true },
      { key: "producto", label: "Producto o nombre comercial", required: true },
      { key: "n", label: "Riqueza N", unit: "%", type: "number" },
      { key: "p", label: "Riqueza P₂O₅", unit: "%", type: "number" },
      { key: "k", label: "Riqueza K₂O", unit: "%", type: "number" },
      { key: "dosis", label: "Dosis", unit: "kg/ha", type: "number", required: true },
      { key: "metodo", label: "Forma de aplicación", type: "select", options: ["Abonadora centrífuga", "Localizado", "Fertirrigación", "Enterrado", "Cuba de purín", "Otra"] },
      { key: "obs", label: "Observaciones", type: "textarea", wide: true },
    ],
  },
  {
    type: "riego", name: "Riegos", short: "Riegos", color: "#1E6AA0",
    fields: [
      { key: "mm", label: "Lámina aplicada", unit: "mm", type: "number", required: true },
      { key: "horas", label: "Duración", unit: "h", type: "number" },
      { key: "m3", label: "Volumen", unit: "m³", type: "number" },
      { key: "obs", label: "Observaciones", type: "textarea", wide: true },
    ],
  },
  {
    type: "labor", name: "Labores", short: "Labores", color: "#46554B",
    fields: [
      { key: "labor", label: "Labor", type: "select", options: ["Siembra", "Plantación", "Laboreo", "Poda", "Desbroce", "Cubierta vegetal", "Picado de restos", "Otra"], required: true },
      { key: "detalle", label: "Detalle (variedad, dosis de siembra…)" },
      { key: "maquinaria", label: "Maquinaria" },
      { key: "obs", label: "Observaciones", type: "textarea", wide: true },
    ],
  },
  {
    type: "cosecha", name: "Cosechas", short: "Cosechas", color: "#2E5B3B",
    fields: [
      { key: "kg", label: "Cantidad cosechada", unit: "kg", type: "number", required: true },
      { key: "destino", label: "Destino o comprador" },
      { key: "albaran", label: "Nº de albarán o factura" },
      { key: "obs", label: "Observaciones", type: "textarea", wide: true },
    ],
  },
];

export const sectionOf = (t: EntryType) => SECTIONS.find((s) => s.type === t)!;

export function missingFields(type: EntryType, data: Record<string, string>) {
  return sectionOf(type).fields.filter((f) => f.required && !String(data[f.key] ?? "").trim()).map((f) => f.label);
}
