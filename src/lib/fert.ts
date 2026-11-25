// Plan de abonado por balance, con las dosis de referencia de Brote (Guía de la fertilización racional, MAPA).
// N: necesidad = rendimiento × N por tonelada (dosis de referencia ÷ rendimiento de referencia), menos lo que aportan
// el suelo, el agua de riego, el cultivo anterior y los orgánicos. P y K: dosis de referencia ajustada al rendimiento
// y corregida por el nivel del análisis de suelo. Orientativo: el técnico ajusta los coeficientes.
import type { Parcel } from "./types";
import { cropById, nFractions } from "./agro";

export type Level = "sin análisis" | "bajo" | "medio" | "alto" | "muy alto";

export function pLevel(ppm: number | null): Level {
  if (ppm == null) return "sin análisis";
  if (ppm < 10) return "bajo";
  if (ppm < 20) return "medio";
  if (ppm < 30) return "alto";
  return "muy alto";
}
export function kLevel(ppm: number | null): Level {
  if (ppm == null) return "sin análisis";
  if (ppm < 100) return "bajo";
  if (ppm < 200) return "medio";
  if (ppm < 300) return "alto";
  return "muy alto";
}
const FACTOR: Record<Level, number> = { "sin análisis": 1, bajo: 1.5, medio: 1, alto: 0.5, "muy alto": 0 };

export type FertResult = {
  needN: number;
  soilN: number;
  waterN: number;
  prevN: number;
  organicN: number;
  extraN: number;
  applyN: number;
  applyP: number;
  applyK: number;
  pLevel: Level;
  kLevel: Level;
  ext: { n: number; p: number; k: number }; // kg por t de cosecha
  fractions: { label: string; share: number; month: number; kgN: number }[];
  warnings: string[];
};

export function sowMonthOf(p: Parcel) {
  const c = cropById(p.cropId);
  if (p.sowDate) return new Date(p.sowDate + "T12:00:00").getMonth();
  return (c.agro?.sow ?? 4) - 1;
}

export function fertPlan(p: Parcel, seasonVolumeM3Ha?: number): FertResult {
  const crop = cropById(p.cropId);
  const A = crop.agro;
  const yRef = A?.y || 1;
  const base = A ? { n: A.rec[0] / yRef, p: A.rec[1] / yRef, k: A.rec[2] / yRef } : { n: 0, p: 0, k: 0 };
  const ext = { n: p.fert.overrides.n ?? base.n, p: p.fert.overrides.p ?? base.p, k: p.fert.overrides.k ?? base.k };
  const y = p.fert.yieldT || 0;
  const ratio = Math.min(1.6, Math.max(0.4, y / yRef));
  const needN = y * ext.n;
  const soilN = p.analysis.nMinKgHa ?? 0;
  const vol = p.irrigation.system === "secano" ? 0 : p.irrigation.seasonVolumeM3Ha || seasonVolumeM3Ha || 0;
  // N (kg/ha) = NO3 (mg/L) × 0,2259 × volumen (m³/ha) / 1000
  const waterN = ((p.irrigation.waterNitrateMgL || 0) * 0.2259 * vol) / 1000;
  const prevN = p.fert.prevLegume ? 30 : 0;
  const organicN = p.fert.organicNKgHa || 0;
  const extraN = p.fert.extraNKgHa || 0;
  const applyN = crop.legume ? 0 : Math.max(0, needN - soilN - waterN - prevN - organicN - extraN);
  const pl = pLevel(p.analysis.pOlsenPpm);
  const kl = kLevel(p.analysis.kPpm);
  // P y K: la dosis de referencia escala a medias con el rendimiento (parte es mantenimiento del suelo)
  const scalePK = (v: number) => v * yRef * (0.5 + 0.5 * ratio);
  const applyP = scalePK(ext.p) * FACTOR[pl];
  const applyK = scalePK(ext.k) * FACTOR[kl];
  const warnings: string[] = [];
  if (A?.note) warnings.push(A.note);
  if (p.analysis.nMinKgHa == null && !crop.legume) warnings.push("Sin dato de N mineral del suelo: no se descuenta.");
  if (pl === "sin análisis" || kl === "sin análisis") warnings.push("Sin análisis de suelo para P o K: se aplica la dosis de referencia.");
  if (p.vulnerable && organicN > 170) warnings.push("Zona vulnerable: el N de estiércoles supera 170 kg/ha·año (Directiva de Nitratos). Revisa el programa de actuación de tu comunidad.");
  if (p.vulnerable) warnings.push("Zona vulnerable: aplica los límites y épocas del programa de actuación de tu comunidad autónoma.");
  const fractions = nFractions(crop, sowMonthOf(p)).map((f) => ({ ...f, kgN: applyN * f.share }));
  return { needN, soilN, waterN, prevN, organicN, extraN, applyN, applyP, applyK, pLevel: pl, kLevel: kl, ext, fractions, warnings };
}
