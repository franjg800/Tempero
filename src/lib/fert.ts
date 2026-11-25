// Plan de abonado por balance. Orientativo: el técnico ajusta los coeficientes.
import type { Parcel } from "./types";
import { cropById, type Fraction } from "./crops";

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
  ext: { n: number; p: number; k: number };
  fractions: (Fraction & { kgN: number })[];
  warnings: string[];
};

export function fertPlan(p: Parcel): FertResult {
  const crop = cropById(p.cropId);
  const ext = { n: p.fert.overrides.n ?? crop.ext.n, p: p.fert.overrides.p ?? crop.ext.p, k: p.fert.overrides.k ?? crop.ext.k };
  const y = p.fert.yieldT || 0;
  const needN = y * ext.n;
  const soilN = p.analysis.nMinKgHa ?? 0;
  const vol = p.irrigation.system === "secano" ? 0 : p.irrigation.seasonVolumeM3Ha || 0;
  // N (kg/ha) = NO3 (mg/L) × 0,2259 × volumen (m³/ha) / 1000
  const waterN = (p.irrigation.waterNitrateMgL || 0) * 0.2259 * vol / 1000;
  const prevN = p.fert.prevLegume ? 30 : 0;
  const organicN = p.fert.organicNKgHa || 0;
  const extraN = p.fert.extraNKgHa || 0;
  const applyN = crop.legume ? 0 : Math.max(0, needN - soilN - waterN - prevN - organicN - extraN);
  const pl = pLevel(p.analysis.pOlsenPpm);
  const kl = kLevel(p.analysis.kPpm);
  const applyP = y * ext.p * FACTOR[pl];
  const applyK = y * ext.k * FACTOR[kl];
  const warnings: string[] = [];
  if (p.analysis.nMinKgHa == null) warnings.push("Sin dato de N mineral del suelo: no se descuenta.");
  if (pl === "sin análisis" || kl === "sin análisis") warnings.push("Sin análisis de suelo para P o K: se repone lo que extrae la cosecha.");
  if (p.vulnerable && organicN > 170) warnings.push("Zona vulnerable: el N de estiércoles supera 170 kg/ha·año (Directiva de Nitratos). Revisa el programa de actuación de tu comunidad.");
  if (p.vulnerable) warnings.push("Zona vulnerable: aplica los límites y épocas del programa de actuación de tu comunidad autónoma.");
  const fractions = crop.fractions.map((f) => ({ ...f, kgN: applyN * f.share }));
  return { needN, soilN, waterN, prevN, organicN, extraN, applyN, applyP, applyK, pLevel: pl, kLevel: kl, ext, fractions, warnings };
}
