// Modelo digital del terreno (MDT): rejilla regular de cotas con su conversión a coordenadas geográficas.
import { fromArrayBuffer } from "geotiff";

export type Dem = {
  w: number;
  h: number;
  z: Float32Array; // cota (m) por celda, fila a fila de norte a sur; NaN = sin dato
  cellM: [number, number]; // tamaño de celda en metros (x, y)
  toLngLat: (px: number, py: number) => [number, number]; // px, py en coordenadas de esquina (0..w, 0..h)
  fromLngLat: (lng: number, lat: number) => [number, number];
  bounds: [number, number, number, number]; // oeste, sur, este, norte (envolvente geográfica)
  source: string;
  kind: "ign" | "cad";
};

export type BBox = [number, number, number, number];

/** Amplía una envolvente con un margen proporcional y uno fijo (grados). */
export function padBBox(b: BBox, frac = 0.25): BBox {
  const dx = (b[2] - b[0]) * frac + 0.0015, dy = (b[3] - b[1]) * frac + 0.0012;
  return [b[0] - dx, b[1] - dy, b[2] + dx, b[3] + dy];
}

export function bboxSizeM(b: BBox): [number, number] {
  const mx = 111320 * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
  return [(b[2] - b[0]) * mx, (b[3] - b[1]) * 110540];
}

/** MDT del IGN (LiDAR PNOA) por servicio WCS. Celda de 5 m, o 25 m si la zona es muy grande. */
export async function fetchIgnDem(bb: BBox): Promise<Dem> {
  const [w, s, e, n] = bb;
  const [wm, hm] = bboxSizeM(bb);
  const res = Math.max(wm, hm) / 5 > 1000 ? 25 : 5;
  const url =
    `https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=Elevacion4258_${res}` +
    `&SUBSET=Lat(${s.toFixed(6)},${n.toFixed(6)})&SUBSET=Long(${w.toFixed(6)},${e.toFixed(6)})&FORMAT=image/tiff`;
  let r: Response | null = null;
  for (let i = 0; i < 2 && !r?.ok; i++) {
    try {
      r = await fetch(url);
    } catch {
      r = null;
    }
  }
  if (!r || !r.ok) throw new Error("el IGN no ha devuelto el modelo del terreno" + (r ? ` (${r.status})` : ""));
  const tiff = await fromArrayBuffer(await r.arrayBuffer());
  const img = await tiff.getImage();
  const W = img.getWidth(), H = img.getHeight();
  const [west, south, east, north] = img.getBoundingBox();
  const ras = (await img.readRasters({ interleave: true })) as unknown as ArrayLike<number>;
  const nodata = img.getGDALNoData();
  const raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = ras[i];
    raw[i] = v == null || v === nodata || v < -100 || v > 5000 ? NaN : v;
  }
  const cx = (east - west) / W, cy = (north - south) / H;
  const mx = 111320 * Math.cos((((south + north) / 2) * Math.PI) / 180);
  return {
    w: W, h: H,
    z: blur(dequantize(raw, W, H), W, H, 2),
    cellM: [cx * mx, cy * 110540],
    toLngLat: (px, py) => [west + px * cx, north - py * cy],
    fromLngLat: (lng, lat) => [(lng - west) / cx, (north - lat) / cy],
    bounds: [west, south, east, north],
    source: `MDT${String(res).padStart(2, "0")} del IGN (LiDAR PNOA), celda de ${res} m`,
    kind: "ign",
  };
}

/** Valor interpolado (bilineal) en coordenadas de esquina. NaN fuera o sin dato. */
export function sample(d: Dem, px: number, py: number): number {
  const fx = px - 0.5, fy = py - 0.5;
  if (fx < 0 || fy < 0 || fx > d.w - 1 || fy > d.h - 1) {
    // borde: valor de la celda más próxima si está dentro
    const i = Math.floor(px), j = Math.floor(py);
    if (i < 0 || j < 0 || i >= d.w || j >= d.h) return NaN;
    return d.z[j * d.w + i];
  }
  const i = Math.floor(fx), j = Math.floor(fy);
  const i1 = Math.min(d.w - 1, i + 1), j1 = Math.min(d.h - 1, j + 1);
  const tx = fx - i, ty = fy - j;
  const a = d.z[j * d.w + i], b = d.z[j * d.w + i1], c = d.z[j1 * d.w + i], e = d.z[j1 * d.w + i1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
}

/** Distancia (en celdas) al borde de la rejilla, para fundir con el relieve de fuera. */
export function edgeDist(d: Dem, px: number, py: number) {
  return Math.min(px, py, d.w - px, d.h - py);
}

/**
 * El WCS del IGN sirve cotas enteras: en una finca llana el terreno sale en escalones de 1 m.
 * Cada escalón es en realidad una curva de nivel a ±0,5 m; se reconstruye la superficie continua
 * interpolando entre la distancia al escalón inferior y al superior.
 */
export function dequantize(z: Float32Array, w: number, h: number): Float32Array {
  const n = w * h;
  const out = new Float32Array(n);
  let integer = true;
  const levels = new Set<number>();
  for (let i = 0; i < n; i++) {
    const v = z[i];
    if (Number.isNaN(v)) continue;
    if (v !== Math.round(v)) integer = false;
    levels.add(v);
  }
  if (!integer || levels.size > 600) return z.slice();
  const lv = [...levels].sort((a, b) => a - b);
  const dDown = new Float32Array(n).fill(Infinity);
  const dUp = new Float32Array(n).fill(Infinity);
  const R = 80; // celdas de ventana
  // envolvente de cada nivel
  const box = new Map<number, [number, number, number, number]>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = z[y * w + x];
      if (Number.isNaN(v)) continue;
      const b = box.get(v);
      if (!b) box.set(v, [x, y, x, y]);
      else {
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
    }
  for (const L of lv) {
    const b = box.get(L)!;
    const x0 = Math.max(0, b[0] - R), y0 = Math.max(0, b[1] - R), x1 = Math.min(w - 1, b[2] + R), y1 = Math.min(h - 1, b[3] + R);
    const dl = chamfer(z, w, x0, y0, x1, y1, (v) => v < L);
    const du = chamfer(z, w, x0, y0, x1, y1, (v) => v > L);
    const ww = x1 - x0 + 1;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (z[i] !== L) continue;
        const k = (y - y0) * ww + (x - x0);
        dDown[i] = dl[k];
        dUp[i] = du[k];
      }
  }
  const S = 18; // celdas para redondear cimas y fondos
  for (let i = 0; i < n; i++) {
    const v = z[i];
    if (Number.isNaN(v)) {
      out[i] = NaN;
      continue;
    }
    const a = dDown[i] - 0.5, b = dUp[i] - 0.5;
    if (Number.isFinite(a) && Number.isFinite(b)) out[i] = v - 0.5 + a / Math.max(1e-6, a + b);
    else if (Number.isFinite(a)) out[i] = v - 0.5 + 0.5 * Math.min(1, a / S) + 0.15 * Math.min(1, a / (3 * S));
    else if (Number.isFinite(b)) out[i] = v + 0.5 - 0.5 * Math.min(1, b / S) - 0.15 * Math.min(1, b / (3 * S));
    else out[i] = v;
  }
  return out;
}

/** Distancia de chaflán (1, √2) en una ventana a las celdas que cumplen `src`. */
function chamfer(z: Float32Array, w: number, x0: number, y0: number, x1: number, y1: number, src: (v: number) => boolean) {
  const ww = x1 - x0 + 1, hh = y1 - y0 + 1;
  const d = new Float32Array(ww * hh);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < ww; x++) {
      const v = z[(y + y0) * w + x + x0];
      d[y * ww + x] = !Number.isNaN(v) && src(v) ? 0 : Infinity;
    }
  const D = Math.SQRT2;
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < ww; x++) {
      const k = y * ww + x;
      let m = d[k];
      if (x > 0 && d[k - 1] + 1 < m) m = d[k - 1] + 1;
      if (y > 0) {
        if (d[k - ww] + 1 < m) m = d[k - ww] + 1;
        if (x > 0 && d[k - ww - 1] + D < m) m = d[k - ww - 1] + D;
        if (x < ww - 1 && d[k - ww + 1] + D < m) m = d[k - ww + 1] + D;
      }
      d[k] = m;
    }
  for (let y = hh - 1; y >= 0; y--)
    for (let x = ww - 1; x >= 0; x--) {
      const k = y * ww + x;
      let m = d[k];
      if (x < ww - 1 && d[k + 1] + 1 < m) m = d[k + 1] + 1;
      if (y < hh - 1) {
        if (d[k + ww] + 1 < m) m = d[k + ww] + 1;
        if (x < ww - 1 && d[k + ww + 1] + D < m) m = d[k + ww + 1] + D;
        if (x > 0 && d[k + ww - 1] + D < m) m = d[k + ww - 1] + D;
      }
      d[k] = m;
    }
  return d;
}

/** Suavizado binomial separable (1-2-1) repetido `passes` veces; respeta los NaN. */
export function blur(z: Float32Array, w: number, h: number, passes = 1): Float32Array {
  let a = z.slice();
  const t = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (Number.isNaN(a[i])) {
          t[i] = NaN;
          continue;
        }
        let s = 2 * a[i], ws = 2;
        if (x > 0 && !Number.isNaN(a[i - 1])) { s += a[i - 1]; ws++; }
        if (x < w - 1 && !Number.isNaN(a[i + 1])) { s += a[i + 1]; ws++; }
        t[i] = s / ws;
      }
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (Number.isNaN(t[i])) {
          b[i] = NaN;
          continue;
        }
        let s = 2 * t[i], ws = 2;
        if (y > 0 && !Number.isNaN(t[i - w])) { s += t[i - w]; ws++; }
        if (y < h - 1 && !Number.isNaN(t[i + w])) { s += t[i + w]; ws++; }
        b[i] = s / ws;
      }
    a = b;
  }
  return a;
}
