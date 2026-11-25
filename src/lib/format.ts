import type { Parcel, SigpacRef } from "./types";

export const nf = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

export const ha = (n: number) => nf(n, 2) + " ha";

export function sigpacCode(s: SigpacRef | null) {
  if (!s) return "—";
  return [s.provincia, s.municipio, s.agregado, s.zona, s.poligono, s.parcela, s.recinto].join(":");
}

export function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function shortDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
}

export function longDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function hoursText(h: number | null) {
  if (h == null) return "—";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh > 0 ? `${hh} h ${mm} min` : `${mm} min`;
}

export const parcelNames = (ids: string[], parcels: Parcel[]) =>
  ids.map((id) => parcels.find((p) => p.id === id)?.name ?? "?").join(", ");

export const parcelsArea = (ids: string[], parcels: Parcel[]) =>
  ids.reduce((s, id) => s + (parcels.find((p) => p.id === id)?.areaHa ?? 0), 0);
