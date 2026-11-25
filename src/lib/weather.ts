// Datos diarios de lluvia y evapotranspiración de referencia (Open-Meteo, sin clave).
export type DailyWeather = { time: string[]; rain: number[]; et0: number[]; tmax: number[]; tmin: number[]; source: string };

const cache = new Map<string, { at: number; data: DailyWeather }>();

export async function fetchDaily(lat: number, lon: number, pastDays = 60, forecastDays = 8): Promise<DailyWeather> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${pastDays},${forecastDays}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;
  const ss = typeof window !== "undefined" ? window.sessionStorage : null;
  try {
    const raw = ss?.getItem("w:" + key);
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; data: DailyWeather };
      if (Date.now() - parsed.at < 30 * 60 * 1000) {
        cache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch {
    /* sin almacenamiento de sesión */
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min` +
    `&past_days=${pastDays}&forecast_days=${forecastDays}&timezone=Europe%2FMadrid`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("No se han podido descargar los datos del tiempo (" + r.status + ")");
  const j = await r.json();
  const d = j.daily;
  const data: DailyWeather = {
    time: d.time,
    rain: d.precipitation_sum.map((x: number | null) => x ?? 0),
    et0: d.et0_fao_evapotranspiration.map((x: number | null) => x ?? 0),
    tmax: d.temperature_2m_max,
    tmin: d.temperature_2m_min,
    source: "Open-Meteo",
  };
  const rec = { at: Date.now(), data };
  cache.set(key, rec);
  try {
    ss?.setItem("w:" + key, JSON.stringify(rec));
  } catch {
    /* sin almacenamiento de sesión */
  }
  return data;
}
