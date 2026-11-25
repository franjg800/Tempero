// Balance hídrico diario simplificado (FAO-56, Kc único mensual).
import type { Entry, Parcel } from "./types";
import { cropById, SOILS } from "./crops";
import type { DailyWeather } from "./weather";
import { todayIso } from "./format";

export type WaterDay = {
  date: string;
  forecast: boolean;
  rain: number; // mm
  effRain: number;
  et0: number;
  kc: number;
  etc: number;
  irrigation: number; // mm netos aplicados
  irrigationKind: "anotado" | "supuesto" | null;
  depletion: number; // mm agotados al final del día
  awPct: number; // agua útil restante, %
};

export type WaterResult = {
  days: WaterDay[];
  todayIndex: number;
  taw: number;
  raw: number;
  thresholdPct: number;
  next: null | {
    date: string;
    netMm: number;
    grossMm: number;
    hours: number | null;
    volumeM3: number;
    inCrop: boolean;
  };
  noCropNow: boolean;
};

export function effectiveRain(p: number) {
  return p < 3 ? 0 : 0.85 * p;
}

/** Pluviometría del sistema en mm/h */
export function systemRateMmH(p: Parcel): number | null {
  const ir = p.irrigation;
  if (ir.system === "goteo") {
    const area = ir.emitterSpacingM * ir.lineSpacingM;
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
  const soil = SOILS.find((s) => s.id === p.soil) ?? SOILS[2];
  const taw = soil.awMmM * crop.rootM;
  const raw = crop.p * taw;
  const irrigated = p.irrigation.system !== "secano";
  const logged = loggedIrrigationByDate(p, entries);
  const today = todayIso();
  let todayIndex = w.time.findIndex((t) => t >= today);
  if (todayIndex < 0) todayIndex = w.time.length - 1;

  let dr = 0; // se parte del suelo a capacidad de campo al inicio de la serie
  const days: WaterDay[] = [];
  for (let i = 0; i < w.time.length; i++) {
    const date = w.time[i];
    const m = new Date(date + "T12:00:00").getMonth();
    const kcCrop = crop.kc[m] ?? 0;
    const kc = kcCrop > 0 ? kcCrop : 0.15; // suelo desnudo fuera de cultivo
    const rain = w.rain[i] ?? 0;
    const et0 = w.et0[i] ?? 0;
    const etc = kc * et0;
    const effRain = effectiveRain(rain);
    let irrigation = logged.get(date) ?? 0;
    let kind: WaterDay["irrigationKind"] = irrigation > 0 ? "anotado" : null;
    let next = dr - effRain - irrigation + etc;
    // Riego supuesto en el pasado si no hay riegos anotados (para no partir de un suelo seco irreal)
    if (irrigated && opts.assumePastIrrigation && i < todayIndex && irrigation === 0 && logged.size === 0 && kcCrop > 0 && next > raw) {
      irrigation = next;
      kind = "supuesto";
      next = 0;
    }
    dr = Math.min(taw, Math.max(0, next));
    days.push({ date, forecast: i > todayIndex, rain, effRain, et0, kc, etc, irrigation, irrigationKind: kind, depletion: dr, awPct: 100 * (1 - dr / taw) });
  }

  let result: WaterResult["next"] = null;
  const noCropNow = (crop.kc[new Date().getMonth()] ?? 0) === 0;
  if (irrigated) {
    for (let i = todayIndex; i < days.length; i++) {
      const d = days[i];
      const inCrop = (crop.kc[new Date(d.date + "T12:00:00").getMonth()] ?? 0) > 0;
      if (inCrop && d.depletion >= raw) {
        const netMm = d.depletion;
        const grossMm = netMm / (p.irrigation.efficiency || 1);
        const rate = systemRateMmH(p);
        result = { date: d.date, netMm, grossMm, hours: rate ? grossMm / rate : null, volumeM3: grossMm * 10 * p.areaHa, inCrop };
        break;
      }
    }
  }
  return { days, todayIndex, taw, raw, thresholdPct: 100 * (1 - crop.p), next: result, noCropNow };
}
