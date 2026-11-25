// Hidrología del terreno sobre la rejilla del MDT: hacia dónde corre el agua, dónde se junta y dónde se encharca.
import { contours } from "d3-contour";
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon, Point } from "geojson";
import type { Dem } from "./dem";

const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

export type Hydro = {
  zf: Float64Array; // superficie rellenada (sin hoyos, con pendiente mínima en llanos)
  rec: Int32Array; // celda receptora (−1 = sale de la zona)
  acc: Float32Array; // celdas que drenan a cada celda (incluida ella)
  depth: Float32Array; // profundidad de encharcamiento (m)
  slope: Float32Array; // pendiente (tanto por uno)
  pool: Int32Array; // id de charca (0 = no)
};

/** Montículo binario mínimo de índices por cota. */
class Heap {
  private a: number[] = [];
  constructor(private key: Float64Array) {}
  get size() { return this.a.length; }
  push(i: number) {
    const a = this.a, k = this.key;
    a.push(i);
    let c = a.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (k[a[p]] <= k[a[c]]) break;
      [a[p], a[c]] = [a[c], a[p]];
      c = p;
    }
  }
  pop() {
    const a = this.a, k = this.key;
    const top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < a.length && k[a[l]] < k[a[m]]) m = l;
        if (r < a.length && k[a[r]] < k[a[m]]) m = r;
        if (m === c) break;
        [a[m], a[c]] = [a[c], a[m]];
        c = m;
      }
    }
    return top;
  }
}

export function analyse(d: Dem): Hydro {
  const { w, h, z } = d;
  const n = w * h;
  const zf = new Float64Array(n);
  const closed = new Uint8Array(n);
  const parent = new Int32Array(n).fill(-1);
  const heap = new Heap(zf);
  let pit: number[] = [];
  let ph = 0; // cabeza de la cola de llanos
  const valid = (i: number) => !Number.isNaN(z[i]);
  // Semillas: borde de la rejilla y celdas junto a huecos sin dato
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!valid(i)) {
        closed[i] = 1;
        zf[i] = NaN;
        continue;
      }
      let edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (!edge)
        for (let k = 0; k < 8 && !edge; k++) if (!valid(i + DY[k] * w + DX[k])) edge = true;
      if (edge) {
        zf[i] = z[i];
        closed[i] = 1;
        heap.push(i);
      }
    }
  // Priority-Flood + ε (Barnes et al., 2014)
  const EPS = 1e-4;
  while (heap.size || ph < pit.length) {
    let c: number;
    if (ph < pit.length) {
      c = pit[ph++];
      if (ph === pit.length) { pit = []; ph = 0; }
    } else c = heap.pop();
    const cx = c % w, cy = (c / w) | 0;
    for (let k = 0; k < 8; k++) {
      const x = cx + DX[k], y = cy + DY[k];
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x;
      if (closed[j]) continue;
      closed[j] = 1;
      parent[j] = c;
      if (z[j] <= zf[c] + EPS) {
        zf[j] = zf[c] + EPS;
        pit.push(j);
      } else {
        zf[j] = z[j];
        heap.push(j);
      }
    }
  }
  // Dirección D8 de máxima pendiente sobre la superficie rellenada
  const [cw, ch] = d.cellM;
  const dist = DX.map((dx, k) => Math.hypot(dx * cw, DY[k] * ch));
  const rec = new Int32Array(n).fill(-1);
  const slope = new Float32Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!valid(i)) continue;
      let best = 0, bk = -1;
      for (let k = 0; k < 8; k++) {
        const xx = x + DX[k], yy = y + DY[k];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!valid(j)) continue;
        const s = (zf[i] - zf[j]) / dist[k];
        if (s > best) {
          best = s;
          bk = j;
        }
      }
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      rec[i] = bk >= 0 ? bk : edge ? -1 : parent[i];
      // pendiente real (Horn) sobre la superficie original
      const g = (xx: number, yy: number) => {
        const X = Math.min(w - 1, Math.max(0, xx)), Y = Math.min(h - 1, Math.max(0, yy));
        const v = z[Y * w + X];
        return Number.isNaN(v) ? z[i] : v;
      };
      const dzdx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1) - g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1)) / (8 * cw);
      const dzdy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1) - g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1)) / (8 * ch);
      slope[i] = Math.hypot(dzdx, dzdy);
    }
  // Acumulación de flujo: de la cota más alta a la más baja
  const order = new Uint32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) if (valid(i)) order[m++] = i;
  const ord = order.subarray(0, m).sort((a, b) => zf[b] - zf[a]);
  const acc = new Float32Array(n);
  for (const i of ord) acc[i] += 1;
  for (const i of ord) if (rec[i] >= 0) acc[rec[i]] += acc[i];
  // Charcas: zonas que el relleno ha tenido que levantar más de 5 cm, de al menos 4 celdas
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) depth[i] = valid(i) ? Math.max(0, zf[i] - z[i]) : 0;
  const pool = new Int32Array(n);
  let id = 0;
  const minCells = Math.max(4, Math.round(60 / (cw * ch)));
  for (let i = 0; i < n; i++) {
    if (pool[i] || depth[i] < 0.05) continue;
    const comp: number[] = [i];
    pool[i] = -1;
    for (let q = 0; q < comp.length; q++) {
      const c = comp[q], cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 8; k += 2) {
        const x = cx + DX[k], y = cy + DY[k];
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        if (!pool[j] && depth[j] >= 0.05) {
          pool[j] = -1;
          comp.push(j);
        }
      }
    }
    const keep = comp.length >= minCells;
    if (keep) id++;
    for (const c of comp) pool[c] = keep ? id : 0;
  }
  for (let i = 0; i < n; i++) if (!pool[i]) depth[i] = depth[i] >= 0.05 ? 0 : depth[i];
  return { zf, rec, acc, depth, slope, pool };
}

/** Celdas dentro de un conjunto de polígonos (rayos, en coordenadas de rejilla). */
export function maskOf(d: Dem, polys: (Polygon | MultiPolygon)[]): Uint8Array {
  const mask = new Uint8Array(d.w * d.h);
  for (const g of polys) {
    const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const rings of parts) {
      const rr = rings.map((r) => r.map(([lng, lat]) => d.fromLngLat(lng, lat)));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of rr[0]) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(d.h - 1, Math.ceil(y1)); y++)
        for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(d.w - 1, Math.ceil(x1)); x++) {
          const px = x + 0.5, py = y + 0.5;
          let inside = false;
          for (const r of rr)
            for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
              const [xa, ya] = r[a], [xb, yb] = r[b];
              if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
            }
          if (inside) mask[y * d.w + x] = 1;
        }
    }
  }
  return mask;
}

/** Equidistancia razonable para unas 15-40 curvas. */
export function contourStep(range: number) {
  for (const s of [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100]) if (range / s <= 40) return s;
  return 200;
}

export function contourLines(d: Dem, step: number): FeatureCollection<LineString, { z: number; master: boolean }> {
  const { w, h, z } = d;
  let lo = Infinity, hi = -Infinity;
  for (const v of z) if (!Number.isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const features: Feature<LineString, { z: number; master: boolean }>[] = [];
  if (!Number.isFinite(lo)) return { type: "FeatureCollection", features };
  const fill = lo - 1000;
  const vals = Array.from(z, (v) => (Number.isNaN(v) ? fill : v));
  const levels: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) levels.push(+t.toFixed(3));
  const near = (x: number, y: number) => {
    // ¿punto junto al borde o a una celda sin dato?
    if (x <= 0.6 || y <= 0.6 || x >= w - 0.6 || y >= h - 0.6) return true;
    const i = Math.floor(x), j = Math.floor(y);
    for (let yy = j - 1; yy <= j; yy++) for (let xx = i - 1; xx <= i; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h && Number.isNaN(z[yy * w + xx])) return true;
    return false;
  };
  const gen = contours().size([w, h]).thresholds(levels).smooth(true);
  for (const mp of gen(vals)) {
    const master = Math.abs(mp.value / (step * 5) - Math.round(mp.value / (step * 5))) < 1e-6;
    for (const poly of mp.coordinates)
      for (const ring of poly) {
        let cur: [number, number][] = [];
        const flush = () => {
          if (cur.length >= 3) features.push({ type: "Feature", properties: { z: mp.value, master }, geometry: { type: "LineString", coordinates: cur } });
          cur = [];
        };
        for (const [x, y] of ring) {
          if (near(x, y)) flush();
          else cur.push(d.toLngLat(x, y));
        }
        flush();
      }
  }
  return { type: "FeatureCollection", features };
}

/** Red de escorrentía: celdas que recogen el agua de más de `minCells` celdas. */
export function streams(d: Dem, hy: Hydro, minCells: number): FeatureCollection<LineString, { acc: number; ha: number }> {
  const { w, h } = d;
  const n = w * h;
  const isS = (i: number) => hy.acc[i] >= minCells;
  const inCount = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (isS(i) && hy.rec[i] >= 0 && isS(hy.rec[i])) inCount[hy.rec[i]]++;
  const cellHa = (d.cellM[0] * d.cellM[1]) / 10000;
  const features: Feature<LineString, { acc: number; ha: number }>[] = [];
  const ctr = (i: number) => d.toLngLat((i % w) + 0.5, ((i / w) | 0) + 0.5);
  for (let i = 0; i < n; i++) {
    if (!isS(i) || inCount[i] === 1) continue;
    const pts: number[] = [i];
    let c = i;
    for (let guard = 0; guard < n; guard++) {
      const r = hy.rec[c];
      if (r < 0 || !isS(r)) break;
      pts.push(r);
      c = r;
      if (inCount[r] !== 1) break;
    }
    if (pts.length < 2) continue;
    let coords: number[][] = pts.map(ctr);
    coords = chaikin(chaikin(coords));
    features.push({ type: "Feature", properties: { acc: hy.acc[c], ha: +(hy.acc[c] * cellHa).toFixed(2) }, geometry: { type: "LineString", coordinates: coords } });
  }
  return { type: "FeatureCollection", features };
}

function chaikin(p: number[][]): number[][] {
  if (p.length < 3) return p;
  const out = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b] = [p[i], p[i + 1]];
    out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
  }
  out.push(p[p.length - 1]);
  return out;
}

/** Polígonos de las charcas. */
export function poolPolygons(d: Dem, hy: Hydro): FeatureCollection<MultiPolygon, { depth: number }> {
  const vals = Array.from(hy.depth);
  const features: Feature<MultiPolygon, { depth: number }>[] = [];
  const gen = contours().size([d.w, d.h]).thresholds([0.05, 0.2, 0.5]).smooth(true);
  for (const mp of gen(vals)) {
    if (!mp.coordinates.length) continue;
    features.push({
      type: "Feature",
      properties: { depth: mp.value },
      geometry: { type: "MultiPolygon", coordinates: mp.coordinates.map((poly) => poly.map((ring) => ring.map(([x, y]) => d.toLngLat(x, y)))) },
    });
  }
  return { type: "FeatureCollection", features };
}

export type Exit = { lngLat: [number, number]; share: number; ha: number; pool: boolean };

export type TerrainStats = {
  cells: number;
  zMin: number;
  zMax: number;
  zMean: number;
  slopeMean: number; // %
  slopeP90: number; // %
  aspect: string | null; // hacia dónde cae
  exits: Exit[];
  pools: { n: number; areaM2: number; volM3: number; maxDepth: number };
};

const COMPASS = ["el este", "el nordeste", "el norte", "el noroeste", "el oeste", "el suroeste", "el sur", "el sureste"];

export function stats(d: Dem, hy: Hydro, mask: Uint8Array): TerrainStats | null {
  const { w, h, z } = d;
  const n = w * h;
  let cells = 0, zMin = Infinity, zMax = -Infinity, zs = 0, ss = 0, gx = 0, gy = 0;
  const slopes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!mask[i] || Number.isNaN(z[i])) continue;
    cells++;
    const v = z[i];
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
    zs += v;
    ss += hy.slope[i];
    slopes.push(hy.slope[i]);
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
      gx += (z[i - 1] - z[i + 1]) / d.cellM[0]; // hacia el este si positivo (baja hacia el este)
      gy += (z[i + w] - z[i - w]) / d.cellM[1]; // hacia el norte si positivo
    }
  }
  if (!cells) return null;
  slopes.sort((a, b) => a - b);
  const gm = Math.hypot(gx, gy) / cells;
  const aspect = gm > 0.002 ? COMPASS[(Math.round((Math.atan2(gy, gx) / (Math.PI / 4))) + 8) % 8] : null;
  // Salidas del agua: se sigue cada celda aguas abajo hasta que deja la parcela o cae en una charca
  const exitOf = new Int32Array(n).fill(-2);
  const path: number[] = [];
  const counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (!mask[i] || Number.isNaN(z[i])) continue;
    path.length = 0;
    let c = i, ex = -1;
    for (let g = 0; g < n; g++) {
      if (exitOf[c] !== -2) { ex = exitOf[c]; break; }
      path.push(c);
      if (hy.pool[c] && mask[c]) { ex = c; break; }
      const r = hy.rec[c];
      if (r < 0) { ex = c; break; }
      if (!mask[r]) { ex = r; break; }
      c = r;
    }
    for (const p of path) exitOf[p] = ex;
    counts.set(ex, (counts.get(ex) ?? 0) + 1);
  }
  // Agrupar salidas cercanas (≤ 6 celdas)
  const groups: { i: number; n: number; pool: boolean }[] = [];
  for (const [i, c] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (i < 0) continue;
    const x = i % w, y = (i / w) | 0;
    const R = Math.max(6, 25 / d.cellM[0]); // salidas a menos de 25 m se juntan
    const g = groups.find((g) => Math.hypot((g.i % w) - x, ((g.i / w) | 0) - y) <= R && g.pool === !!(hy.pool[i] && mask[i]));
    if (g) g.n += c;
    else groups.push({ i, n: c, pool: !!(hy.pool[i] && mask[i]) });
  }
  groups.sort((a, b) => b.n - a.n);
  const cellHa = (d.cellM[0] * d.cellM[1]) / 10000;
  const exits = groups.slice(0, 4).filter((g) => g.n / cells >= 0.03).map((g) => ({
    lngLat: d.toLngLat((g.i % w) + 0.5, ((g.i / w) | 0) + 0.5),
    share: g.n / cells,
    ha: g.n * cellHa,
    pool: g.pool,
  }));
  // Charcas dentro de la parcela
  const ids = new Set<number>();
  let areaM2 = 0, volM3 = 0, maxDepth = 0;
  const cellM2 = d.cellM[0] * d.cellM[1];
  for (let i = 0; i < n; i++)
    if (mask[i] && hy.pool[i]) {
      ids.add(hy.pool[i]);
      areaM2 += cellM2;
      volM3 += hy.depth[i] * cellM2;
      maxDepth = Math.max(maxDepth, hy.depth[i]);
    }
  return {
    cells, zMin, zMax, zMean: zs / cells,
    slopeMean: (ss / cells) * 100,
    slopeP90: slopes[Math.floor(slopes.length * 0.9)] * 100,
    aspect, exits,
    pools: { n: ids.size, areaM2, volM3, maxDepth },
  };
}

export function exitPoints(st: TerrainStats | null): FeatureCollection<Point, { label: string; pool: boolean }> {
  return {
    type: "FeatureCollection",
    features: (st?.exits ?? []).map((e) => ({
      type: "Feature",
      properties: { label: `${Math.round(e.share * 100)} %`, pool: e.pool },
      geometry: { type: "Point", coordinates: e.lngLat },
    })),
  };
}
