// Clima histórico de la parcela: 10 años diarios de Open-Meteo (archivo ERA5), como en Brote.
export type MonthClimate = { tmin: number; tmax: number; tmed: number; p: number; et0: number; rh: number | null; u2: number | null };
export type Climate = {
  lat: number;
  lon: number;
  from: number;
  to: number;
  monthly: MonthClimate[];
  years: Record<string, { et0: number[]; p: number[] }>; // 365 días por año (se quita el 29 de febrero)
  p: number; // lluvia media anual
  et0: number; // ETo media anual
  frostDays: number;
};

const KEY = "tempero-clima";

function readCache(): Record<string, { at: number; c: Climate }> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function writeCache(all: Record<string, { at: number; c: Climate }>) {
  const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* sin espacio: no se guarda en caché */
  }
}

const pending = new Map<string, Promise<Climate>>();

export function climateKey(lat: number, lon: number) {
  return `${(Math.round(lat * 20) / 20).toFixed(2)},${(Math.round(lon * 20) / 20).toFixed(2)}`;
}

export async function fetchClimate(lat: number, lon: number): Promise<Climate> {
  const key = climateKey(lat, lon);
  const cached = readCache()[key];
  if (cached && Date.now() - cached.at < 90 * 864e5) return cached.c;
  if (pending.has(key)) return pending.get(key)!;
  const job = (async () => {
    const [la, lo] = key.split(",").map(Number);
    const end = new Date().getFullYear() - 1;
    const start = end - 9;
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${la}&longitude=${lo}&start_date=${start}-01-01&end_date=${end}-12-31` +
      `&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_min,temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_mean&timezone=Europe%2FMadrid`;
    let r = await fetch(url);
    if (!r.ok) {
      await new Promise((res) => setTimeout(res, 3000));
      r = await fetch(url);
    }
    if (!r.ok) throw new Error("No se ha podido descargar el clima histórico (" + r.status + ")");
    const D = (await r.json()).daily;
    const mon = Array.from({ length: 12 }, () => ({ tmin: [] as number[], tmax: [] as number[], rh: [] as number[], u: [] as number[], p: 0, et0: 0 }));
    const years: Climate["years"] = {};
    const frost: Record<string, number> = {};
    (D.time as string[]).forEach((t, i) => {
      if (t.slice(5) === "02-29") return;
      const y = t.slice(0, 4);
      const m = +t.slice(5, 7) - 1;
      const Y = (years[y] = years[y] || { et0: [], p: [] });
      const e = D.et0_fao_evapotranspiration[i] ?? 0;
      const p = D.precipitation_sum[i] ?? 0;
      Y.et0.push(Math.round(e * 100) / 100);
      Y.p.push(Math.round(p * 10) / 10);
      const M = mon[m];
      M.p += p;
      M.et0 += e;
      const tn = D.temperature_2m_min[i];
      if (tn != null) {
        M.tmin.push(tn);
        if (tn < 0) frost[y] = (frost[y] ?? 0) + 1;
      }
      if (D.temperature_2m_max[i] != null) M.tmax.push(D.temperature_2m_max[i]);
      if (D.relative_humidity_2m_min[i] != null) M.rh.push(D.relative_humidity_2m_min[i]);
      if (D.wind_speed_10m_mean[i] != null) M.u.push(D.wind_speed_10m_mean[i]);
    });
    const ny = Object.keys(years).length || 1;
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    const monthly = mon.map((M) => {
      const tmin = avg(M.tmin) ?? 0, tmax = avg(M.tmax) ?? 0, u = avg(M.u);
      // viento a 10 m (km/h) → u2 a 2 m (m/s): ×(1/3,6)×0,748 (FAO-56, ec. 47)
      return { tmin, tmax, tmed: (tmin + tmax) / 2, p: M.p / ny, et0: M.et0 / ny, rh: avg(M.rh), u2: u == null ? null : (u / 3.6) * 0.748 };
    });
    const c: Climate = {
      lat: la, lon: lo, from: start, to: end, monthly, years,
      p: monthly.reduce((s, m) => s + m.p, 0),
      et0: monthly.reduce((s, m) => s + m.et0, 0),
      frostDays: Object.values(frost).reduce((s, v) => s + v, 0) / ny,
    };
    const all = readCache();
    all[key] = { at: Date.now(), c };
    writeCache(all);
    return c;
  })();
  pending.set(key, job);
  try {
    return await job;
  } finally {
    pending.delete(key);
  }
}
