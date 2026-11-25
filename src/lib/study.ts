// Necesidades de riego anuales a partir del clima histórico (método de Brote) y diseño agronómico del riego.
// FAO-56 (Allen et al., 1998): ETc = ETo·Kc, Kc medio y final corregidos por HRmín y viento (ec. 62).
// Lluvia efectiva mensual USDA-SCS. Balance diario del suelo para cada uno de los 10 años de clima.
// Riego localizado (Pizarro, Riegos localizados de alta frecuencia): coeficiente de localización Kl,
// variación climática, necesidades totales Nt = Nn / ((1 − K)·CU) con K = máx(1 − Ea, LR) y LR = CEi / (2·CEe máx).
import type { Parcel } from "./types";
import type { Climate } from "./climate";
import { cropById, type Agro, type Crop } from "./agro";
import { soilProps, type SoilProps } from "./soil";

export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const D0 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function kcAdj(kc: number, h: number, rh: number | null, u2: number | null) {
  if (kc < 0.45 || rh == null || u2 == null) return kc;
  return kc + (0.04 * (u2 - 2) - 0.004 * (rh - 45)) * Math.pow(h / 3, 0.3);
}
export const peMonthly = (p: number) => (p <= 250 ? (p * (125 - 0.2 * p)) / 125 : 125 + 0.1 * p);

export function doyOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return Math.min(364, D0[d.getMonth()] + d.getDate() - 1);
}

export type KcSeries = { kc: (number | null)[]; zr: (number | null)[]; stages: number[] | null; len: number; kini?: number; kmid?: number; kend?: number };

/** Kc y profundidad radicular de cada día del año (0-364). Anuales: curva por etapas desde la siembra. Leñosos: Kc mensual. */
export function kcSeries(A: Agro, cl: Climate | null, sowDoy: number): KcSeries {
  const kc: (number | null)[] = new Array(365).fill(null);
  const zr: (number | null)[] = new Array(365).fill(null);
  if (A.kcm) {
    for (let d = 0; d < 365; d++) {
      const m = Math.min(11, Math.floor(d / 30.42));
      kc[d] = A.kcm[m];
      zr[d] = A.zr[1];
    }
    return { kc, zr, stages: null, len: 365 };
  }
  const [li, ld, lm, ll] = A.L!;
  const len = li + ld + lm + ll;
  const mOf = (d: number) => Math.min(11, Math.floor(((sowDoy + d) % 365) / 30.42));
  const midM: number[] = [];
  for (let d = li + ld; d < li + ld + lm; d += 15) midM.push(mOf(d));
  const endM = mOf(len - 1);
  const mean = (k: "rh" | "u2", ms: number[]) => {
    if (!cl) return null;
    const v = ms.map((m) => cl.monthly[m][k]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const kini = A.k![0];
  const kmid = kcAdj(A.k![1], A.h, mean("rh", midM), mean("u2", midM));
  const kend = kcAdj(A.k![2], A.h, cl ? cl.monthly[endM].rh : null, cl ? cl.monthly[endM].u2 : null);
  for (let d = 0; d < Math.min(len, 365); d++) {
    const doy = (sowDoy + d) % 365;
    let k: number;
    if (d < li) k = kini;
    else if (d < li + ld) k = kini + ((d - li) / ld) * (kmid - kini);
    else if (d < li + ld + lm) k = kmid;
    else k = kmid + ((d - li - ld - lm) / Math.max(1, ll)) * (kend - kmid);
    kc[doy] = k;
    zr[doy] = A.zr[0] + (A.zr[1] - A.zr[0]) * Math.min(1, d / Math.max(1, li + ld));
  }
  return { kc, zr, stages: [li, ld, lm, ll], len, kini, kmid, kend };
}

export const isLocalized = (p: Parcel) => p.irrigation.system === "goteo" || p.irrigation.system === "microaspersion";

/** Coeficiente de localización: media de los dos valores centrales de Aljibury, Decroix, Hoare y Keller. */
export function klOf(A: number) {
  const v = [1.34 * A, 0.1 + A, A + 0.5 * (1 - A), A + 0.15 * (1 - A)].sort((a, b) => a - b);
  return { kl: Math.min(1, (v[1] + v[2]) / 2), methods: { aljibury: 1.34 * A, decroix: 0.1 + A, hoare: A + 0.5 * (1 - A), keller: A + 0.15 * (1 - A) } };
}

export type MonthRow = { m: number; kc: number | null; et0: number; etc: number; p: number; pe: number; nn: number; nb: number };
export type YearSim = { y: string; n: number; net: number; series: [number, number, number, number, number][] };

export type Study = {
  crop: Crop;
  A: Agro;
  soil: SoilProps;
  ks: KcSeries;
  sowDoy: number;
  months: MonthRow[];
  tot: { etc: number; pe: number; nn: number; nb: number };
  sims: YearSim[];
  med: YearSim | null;
  kr: number; // reducción por cobertura (leñosos, riego no localizado)
  kl: number; // coeficiente de localización (riego localizado)
  cover: number;
  eff: number;
  K: number; // fracción de pérdidas: máx(1 − Ea, LR)
  lr: number; // fracción de lavado
  ceMax: number | null;
  denom: number; // NB = NN / denom
  adtMax: number;
  peak: number; // mes punta (0-11)
  years: number;
};

export function study(parcel: Parcel, cl: Climate): Study | null {
  const crop = cropById(parcel.cropId);
  const A = crop.agro;
  if (!A) return null;
  const soil = soilProps(parcel.soil, parcel.analysis.organicMatterPct);
  const ir = parcel.irrigation;
  const secano = ir.system === "secano";
  const local = isLocalized(parcel);
  const sowDoy = A.kcm ? 0 : parcel.sowDate ? doyOf(parcel.sowDate) : D0[(A.sow ?? 4) - 1];
  const ks = kcSeries(A, cl, sowDoy);
  const cover = crop.woody ? clamp(parcel.coverPct / 100, 0.05, 1) : 1;
  const kr = crop.woody && !local ? Math.min(1, cover * 2) : 1;
  const kl = local ? klOf(cover).kl : 1;
  const factor = local ? kl : kr;
  const eff = secano ? 1 : clamp(ir.efficiency, 0.3, 1);
  const ceMax = crop.salt ? crop.salt.max : null;
  const lr = local ? (ir.ceWater > 0 ? ir.ceWater / (2 * (ceMax ?? 10)) : 0) : ceMax && ir.ceWater > 0 ? ir.ceWater / (5 * (crop.salt!.thr) - ir.ceWater) : 0;
  const K = Math.max(1 - eff, lr);
  const denom = secano ? 1 : local ? (1 - K) * clamp(ir.cu, 0.5, 1) : eff * (1 - lr);

  const months: MonthRow[] = cl.monthly.map((M, m) => {
    let kcSum = 0, nOn = 0;
    for (let d = D0[m]; d < D0[m] + DAYS[m]; d++) {
      const k = ks.kc[d];
      if (k != null) {
        kcSum += k;
        nOn++;
      }
    }
    const kcm = nOn ? kcSum / nOn : 0;
    const etc = M.et0 * kcm * factor * (nOn / DAYS[m]);
    const pe = nOn ? peMonthly(M.p) * (nOn / DAYS[m]) : 0;
    const nn = Math.max(0, etc - pe);
    return { m, kc: nOn ? kcm * factor : null, et0: M.et0, etc, p: M.p, pe, nn, nb: secano ? 0 : nn / denom };
  });
  const tot = months.reduce((a, x) => ({ etc: a.etc + x.etc, pe: a.pe + x.pe, nn: a.nn + x.nn, nb: a.nb + x.nb }), { etc: 0, pe: 0, nn: 0, nb: 0 });

  // Balance diario de cada año: DAS frente a AFA = p·ADT
  const sims: YearSim[] = [];
  for (const y of Object.keys(cl.years).sort()) {
    const Y = cl.years[y];
    let Dr = 0, n = 0, net = 0;
    const series: YearSim["series"] = [];
    const len = A.kcm ? 365 : ks.len;
    for (let i = 0; i < len; i++) {
      const doy = (sowDoy + i) % 365;
      const k = ks.kc[doy];
      if (k == null || Y.et0[doy] == null) continue;
      const zr = ks.zr[doy] ?? A.zr[1];
      const adt = soil.awc * zr;
      const p = clamp(A.p + 0.04 * (5 - Y.et0[doy] * k), 0.1, 0.8);
      const afa = p * adt;
      const P = Y.p[doy] > 2 ? Y.p[doy] : 0;
      Dr = Math.min(adt, Math.max(0, Dr - P + Y.et0[doy] * k * factor));
      let irr = 0;
      if (!secano) {
        if (local ? Dr >= 1 : Dr >= afa) {
          irr = Dr;
          net += Dr;
          n++;
          Dr = 0;
        }
      }
      series.push([i, Dr, afa, adt, irr]);
    }
    sims.push({ y, n, net, series });
  }
  sims.sort((a, b) => a.net - b.net);
  const med = sims.length ? sims[Math.floor(sims.length / 2)] : null;
  let peak = 0;
  months.forEach((r) => {
    if ((secano ? r.nn : r.nb) > (secano ? months[peak].nn : months[peak].nb)) peak = r.m;
  });
  return {
    crop, A, soil, ks, sowDoy, months, tot, sims, med, kr, kl, cover, eff, K, lr, ceMax, denom,
    adtMax: soil.awc * A.zr[1], peak, years: Object.keys(cl.years).length,
  };
}

// ---------- Diseño del riego localizado (goteo y microaspersión) ----------
export type DripDesign = {
  peakMonth: number;
  etoD: number;
  kc: number;
  kl: number;
  kvc: number;
  etrl: number;
  peD: number;
  nn: number;
  nt: number; // mm/día (= L/m²·día)
  K: number;
  lr: number;
  cu: number;
  woody: boolean;
  plants: number;
  sp: number; // m² por planta
  vPlant: number | null; // L/planta·día
  qa: number;
  r: number; // radio mojado (m)
  ae: number; // superficie mojada por emisor (m²)
  pMin: number; // % mínimo de superficie mojada
  eMin: number | null; // emisores mínimos por planta
  e: number | null; // emisores por planta usados
  pWet: number; // % de superficie mojada resultante
  areaPerEmitter: number; // m²
  emittersHa: number;
  emittersTotal: number;
  hours: number; // tiempo de riego en el día punta (h)
  sectors: number;
  qTotalM3h: number;
  qSectorM3h: number;
  qSectorLs: number;
  volDayM3: number;
  volYearM3: number;
  stripOk: boolean | null;
  warnings: string[];
  monthly: { m: number; mmDay: number; lPlantDay: number | null; minDay: number }[];
};

export function dripDesign(parcel: Parcel, s: Study, cl: Climate): DripDesign {
  const ir = parcel.irrigation;
  const micro = ir.system === "microaspersion";
  const pk = s.peak;
  const etoD = cl.monthly[pk].et0 / DAYS[pk];
  const raw = s.months[pk].kc != null ? s.months[pk].kc! / (s.kl || 1) : 0;
  const kc = raw;
  const kvc = 1.15;
  const etrl = etoD * kc * s.kl * kvc;
  const peD = s.months[pk].pe / DAYS[pk];
  const nn = Math.max(0, etrl - peD);
  const cu = clamp(ir.cu, 0.5, 1);
  const nt = nn / ((1 - s.K) * cu);
  const woody = s.crop.woody;
  const [row, plant] = parcel.spacing;
  const sp = Math.max(0.01, row * plant);
  const plants = (parcel.areaHa * 10000) / sp;
  const qa = Math.max(0.5, ir.emitterFlowLh);
  const r = micro ? 1.5 * Math.sqrt(qa / 35) : s.soil.wetR * Math.sqrt(qa / 4);
  const ae = Math.PI * r * r;
  const warnings: string[] = [];
  let e: number | null = null, eMin: number | null = null, areaPerEmitter: number, emittersHa: number, pWet: number, vPlant: number | null = null, stripOk: boolean | null = null;
  const pMin = woody ? Math.min(80, Math.max(5, ir.wetPct ?? 25)) : 70;
  if (woody) {
    eMin = Math.max(micro ? 1 : 2, Math.ceil(((pMin / 100) * sp) / ae));
    e = ir.emittersPerPlant ?? eMin;
    areaPerEmitter = sp / e;
    emittersHa = (10000 / sp) * e;
    pWet = Math.min(100, ((e * ae) / sp) * 100);
    vPlant = nt * sp;
    if (pWet < pMin - 0.5) warnings.push(`Con ${e} emisores por planta solo se moja el ${Math.round(pWet)} % del suelo (mínimo recomendado ${pMin} %).`);
  } else {
    const L = Math.max(0.25, ir.lateralsPerRow);
    const se = Math.max(0.1, ir.emitterSpacingM);
    areaPerEmitter = (row * se) / L;
    emittersHa = 10000 / areaPerEmitter;
    stripOk = se <= 1.6 * r;
    pWet = Math.min(100, ((L * Math.min(2 * r, row / L) * 1) / row) * 100);
    if (!stripOk) warnings.push(`Goteros a ${se} m: con un radio mojado de unos ${r.toFixed(2)} m el bulbo no llega a unirse. Acércalos a ${(1.6 * r).toFixed(2)} m o menos.`);
  }
  const hours = (nt * areaPerEmitter) / qa;
  const hp = clamp(ir.hoursPerDay, 1, 24);
  const sectors = Math.max(1, Math.floor(hp / Math.max(0.05, hours)));
  if (hours > hp) warnings.push(`En el mes punta harían falta ${hours.toFixed(1)} h de riego al día y solo hay ${hp} h: pon más emisores o de más caudal.`);
  const emittersTotal = emittersHa * parcel.areaHa;
  const qTotalM3h = (emittersTotal * qa) / 1000;
  const qSectorM3h = qTotalM3h / sectors;
  if (s.lr > 1 - s.eff) warnings.push(`El agua es salina (CE ${ir.ceWater} dS/m): la fracción de lavado (${(s.lr * 100).toFixed(0)} %) manda sobre las pérdidas por eficiencia.`);
  const monthly = s.months
    .filter((m) => m.nb > 0.5)
    .map((m) => {
      const mmDay = m.nb / DAYS[m.m];
      return { m: m.m, mmDay, lPlantDay: woody ? mmDay * sp : null, minDay: ((mmDay * areaPerEmitter) / qa) * 60 };
    });
  return {
    peakMonth: pk, etoD, kc, kl: s.kl, kvc, etrl, peD, nn, nt, K: s.K, lr: s.lr, cu, woody, plants, sp, vPlant, qa, r, ae, pMin, eMin, e, pWet,
    areaPerEmitter, emittersHa, emittersTotal, hours, sectors, qTotalM3h, qSectorM3h, qSectorLs: (qSectorM3h * 1000) / 3600,
    volDayM3: nt * 10 * parcel.areaHa, volYearM3: s.tot.nb * 10 * parcel.areaHa, stripOk, warnings, monthly,
  };
}

// ---------- Diseño del riego por aspersión, pívot o gravedad ----------
export type SprinklerDesign = {
  peakMonth: number;
  etcD: number;
  adt: number;
  afa: number;
  interval: number;
  dn: number;
  db: number;
  rate: number | null;
  hours: number | null;
  infil: number;
  rateOk: boolean | null;
  positions: number | null;
  volM3: number;
  riegosMed: number | null;
  warnings: string[];
};

export function sprinklerDesign(parcel: Parcel, s: Study, cl: Climate): SprinklerDesign {
  const ir = parcel.irrigation;
  const pk = s.peak;
  const etcD = s.months[pk].etc / DAYS[pk];
  const adt = s.adtMax;
  const p = clamp(s.A.p + 0.04 * (5 - etcD), 0.1, 0.8);
  const afa = p * adt;
  const grav = ir.system === "gravedad";
  const pivot = ir.system === "pivot";
  const rate = grav ? null : Math.max(0.5, ir.rateMmH);
  // El intervalo lo limita el suelo (AFA) y, en aspersión, que cada postura no pase de 8 h; el pívot da riegos cortos (≤ 15 mm netos)
  const byAfa = Math.floor(afa / Math.max(0.1, etcD));
  const byTime = rate ? Math.floor((8 * rate * s.denom) / Math.max(0.1, etcD)) : Infinity;
  const byPivot = pivot ? Math.floor(15 / Math.max(0.1, etcD)) : Infinity;
  const interval = Math.max(1, Math.min(byAfa, byTime, byPivot));
  const dn = interval * etcD;
  const db = dn / s.denom;
  const hours = rate ? db / rate : null;
  const rateOk = rate ? rate <= s.soil.infil : null;
  const positions = hours ? Math.max(1, Math.floor(clamp(ir.hoursPerDay, 1, 24) / hours)) : null;
  const warnings: string[] = [];
  if (rateOk === false) warnings.push(`La pluviometría (${rate} mm/h) supera la infiltración del suelo ${s.soil.tex.toLowerCase()} (unos ${s.soil.infil} mm/h): habrá escorrentía. Baja la pluviometría o riega en dos tandas.`);
  void cl;
  const riegos = Math.ceil(s.tot.nn / Math.max(1, dn));
  return { peakMonth: pk, etcD, adt, afa, interval, dn, db, rate, hours, infil: s.soil.infil, rateOk, positions, volM3: db * 10 * parcel.areaHa, riegosMed: riegos, warnings };
}
