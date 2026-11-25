// Seguimiento diario (esta semana): balance del suelo con la lluvia y la ETo reales de los últimos 60 días y la previsión.
import type { Entry, Parcel } from "./types";
import { cropById } from "./agro";
import { soilProps } from "./soil";
import type { DailyWeather } from "./weather";
import { todayIso } from "./format";
import { D0, doyOf, isLocalized, kcSeries, klOf } from "./study";

export type WaterDay = {
  date: string;
  forecast: boolean;
  rain: number;
  effRain: number;
  et0: number;
  kc: number;
  etc: number;
  irrigation: number;
  irrigationKind: "anotado" | "supuesto" | null;
  depletion: number;
  awPct: number;
};

export type WaterResult = {
  days: WaterDay[];
  todayIndex: number;
  taw: number;
  raw: number;
  thresholdPct: number;
  next: null | { date: string; netMm: number; grossMm: number; hours: number | null; volumeM3: number; inCrop: boolean };
  noCropNow: boolean;
};

export const effectiveRain = (p: number) => (p < 3 ? 0 : 0.85 * p);

/** Pluviometría del sistema en mm/h (goteo: caudal del gotero / superficie que riega cada gotero). */
export function systemRateMmH(p: Parcel): number | null {
  const ir = p.irrigation;
  const c = cropById(p.cropId);
  if (ir.system === "goteo" || ir.system === "microaspersion") {
    const [row, plant] = p.spacing;
    const area = c.woody ? (row * plant) / Math.max(1, ir.emittersPerPlant ?? 2) : (row * Math.max(0.1, ir.emitterSpacingM)) / Math.max(1, ir.lateralsPerRow);
    return area > 0 ? ir.emitterFlowLh / area : null;
  }
  if (ir.system === "gravedad" || ir.system === "secano") return null;
  return ir.rateMmH > 0 ? ir.rateMmH : null;
}

export function loggedIrrigationByDate(p: Parcel, entries: Entry[]) {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== "riego" || e.status !== "hecho" || !e.parcelIds.includes(p.id)) continue;
    const mm = parseFloat((e.data.mm || "0").replace(",", "."));
    if (mm > 0) map.set(e.date, (map.get(e.date) ?? 0) + mm * (p.irrigation.efficiency || 1));
  }
  return map;
}

export function waterBalance(p: Parcel, w: DailyWeather, entries: Entry[], opts: { assumePastIrrigation: boolean }): WaterResult {
  const crop = cropById(p.cropId);
  const A = crop.agro;
  const soil = soilProps(p.soil, p.analysis.organicMatterPct);
  const irrigated = p.irrigation.system !== "secano";
  const sowDoy = !A || A.kcm ? 0 : p.sowDate ? doyOf(p.sowDate) : D0[(A.sow ?? 4) - 1];
  const ks = A ? kcSeries(A, null, sowDoy) : null;
  const cover = crop.woody ? Math.min(1, Math.max(0.05, p.coverPct / 100)) : 1;
  const factor = crop.woody ? (isLocalized(p) ? klOf(cover).kl : Math.min(1, cover * 2)) : 1;
  const zrMax = A ? A.zr[1] : 0.5;
  const pFrac = A ? A.p : 0.5;
  const taw = soil.awc * zrMax;
  const raw = pFrac * taw;
  const logged = loggedIrrigationByDate(p, entries);
  const today = todayIso();
  let todayIndex = w.time.findIndex((t) => t >= today);
  if (todayIndex < 0) todayIndex = w.time.length - 1;

  let dr = 0;
  const days: WaterDay[] = [];
  const inCropAt = (date: string) => (ks ? ks.kc[doyOf(date)] != null : false);
  for (let i = 0; i < w.time.length; i++) {
    const date = w.time[i];
    const kcCrop = ks ? ks.kc[doyOf(date)] : null;
    const kc = kcCrop != null ? kcCrop * factor : 0.15;
    const rain = w.rain[i] ?? 0;
    const et0 = w.et0[i] ?? 0;
    const etc = kc * et0;
    const effRain = effectiveRain(rain);
    let irrigation = logged.get(date) ?? 0;
    let kind: WaterDay["irrigationKind"] = irrigation > 0 ? "anotado" : null;
    let next = dr - effRain - irrigation + etc;
    if (irrigated && opts.assumePastIrrigation && i < todayIndex && irrigation === 0 && logged.size === 0 && kcCrop != null && next > raw) {
      irrigation = next;
      kind = "supuesto";
      next = 0;
    }
    dr = Math.min(taw, Math.max(0, next));
    days.push({ date, forecast: i > todayIndex, rain, effRain, et0, kc, etc, irrigation, irrigationKind: kind, depletion: dr, awPct: 100 * (1 - dr / taw) });
  }

  let result: WaterResult["next"] = null;
  if (irrigated) {
    for (let i = todayIndex; i < days.length; i++) {
      const d = days[i];
      if (inCropAt(d.date) && d.depletion >= raw) {
        const netMm = d.depletion;
        const grossMm = netMm / (p.irrigation.efficiency || 1);
        const rate = systemRateMmH(p);
        result = { date: d.date, netMm, grossMm, hours: rate ? grossMm / rate : null, volumeM3: grossMm * 10 * p.areaHa, inCrop: true };
        break;
      }
    }
  }
  return { days, todayIndex, taw, raw, thresholdPct: 100 * (1 - pFrac), next: result, noCropNow: !inCropAt(today) };
}
