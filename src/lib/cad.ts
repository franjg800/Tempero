// Importación de planos topográficos de AutoCAD (DXF) y de Civil 3D / MDT (LandXML) a una rejilla de cotas.
import DxfParser from "dxf-parser";
import Delaunator from "delaunator";
import proj4 from "proj4";
import type { Dem } from "./dem";

export const CRS = [
  { id: "EPSG:25830", name: "ETRS89 · UTM huso 30 (península centro)", def: "+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs" },
  { id: "EPSG:25829", name: "ETRS89 · UTM huso 29 (Galicia, oeste)", def: "+proj=utm +zone=29 +ellps=GRS80 +units=m +no_defs" },
  { id: "EPSG:25831", name: "ETRS89 · UTM huso 31 (Cataluña, Baleares)", def: "+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs" },
  { id: "EPSG:23030", name: "ED50 · UTM huso 30 (planos antiguos)", def: "+proj=utm +zone=30 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs" },
  { id: "EPSG:23029", name: "ED50 · UTM huso 29 (planos antiguos)", def: "+proj=utm +zone=29 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs" },
  { id: "EPSG:23031", name: "ED50 · UTM huso 31 (planos antiguos)", def: "+proj=utm +zone=31 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs" },
  { id: "EPSG:32628", name: "WGS84 · UTM huso 28 (Canarias)", def: "+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs" },
] as const;
export type CrsId = (typeof CRS)[number]["id"];

export function guessCrs(lng: number): CrsId {
  if (lng < -12) return "EPSG:32628";
  if (lng < -6) return "EPSG:25829";
  if (lng >= 0) return "EPSG:25831";
  return "EPSG:25830";
}

export type CadLayer = { name: string; points: number; withZ: number };
export type CadData = {
  file: string;
  format: "DXF" | "LandXML";
  layers: CadLayer[];
  pts: { x: number; y: number; z: number; layer: string }[];
  faces: Uint32Array | null; // triángulos de LandXML (índices en pts)
  fromText: boolean; // cotas sacadas de textos numéricos
};

/** Añade puntos intermedios a una polilínea para que la triangulación no cree caras largas. */
function densify(v: { x: number; y: number; z: number }[], step: number, closed: boolean) {
  const out: { x: number; y: number; z: number }[] = [];
  const pts = closed && v.length > 2 ? [...v, v[0]] : v;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(L / step));
    for (let s = 0; s < k; s++) out.push({ x: a.x + ((b.x - a.x) * s) / k, y: a.y + ((b.y - a.y) * s) / k, z: a.z + ((b.z - a.z) * s) / k });
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

export function parseCad(file: string, text: string): CadData {
  if (/<LandXML/i.test(text.slice(0, 4000))) return parseLandXml(file, text);
  return parseDxf(file, text);
}

function parseDxf(file: string, text: string): CadData {
  const dxf = new DxfParser().parseSync(text);
  if (!dxf) throw new Error("no se ha podido leer el DXF");
  const pts: CadData["pts"] = [];
  const texts: CadData["pts"] = [];
  const layers = new Map<string, CadLayer>();
  const add = (layer: string, p: { x: number; y: number; z: number }[]) => {
    const L = layers.get(layer) ?? { name: layer, points: 0, withZ: 0 };
    layers.set(layer, L);
    for (const q of p) {
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
      L.points++;
      if (q.z && Number.isFinite(q.z)) {
        L.withZ++;
        pts.push({ x: q.x, y: q.y, z: q.z, layer });
      }
    }
  };
  // Separación de densificado: 1/300 del tamaño del dibujo, mínimo 0,5 m
  let x0 = Infinity, x1 = -Infinity;
  const ents = (dxf.entities ?? []) as unknown as Record<string, unknown>[];
  for (const e of ents) {
    const v = (e.vertices as { x: number }[] | undefined) ?? (e.position ? [e.position as { x: number }] : []);
    for (const p of v) if (Number.isFinite(p.x)) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
  }
  const step = Math.max(0.5, (x1 - x0) / 300 || 1);
  for (const e of ents) {
    const layer = String(e.layer ?? "0");
    const t = e.type as string;
    if (t === "LWPOLYLINE") {
      const z = Number(e.elevation ?? 0);
      const v = (e.vertices as { x: number; y: number; z?: number }[]).map((p) => ({ x: p.x, y: p.y, z: p.z ?? z }));
      add(layer, densify(v, step, !!e.shape));
    } else if (t === "POLYLINE") {
      if (e.isPolyfaceMesh) {
        const v = (e.vertices as { x: number; y: number; z: number }[]).filter((p) => p.x || p.y || p.z);
        add(layer, v);
      } else {
        const v = (e.vertices as { x: number; y: number; z: number }[]).map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
        add(layer, densify(v, step, !!e.shape));
      }
    } else if (t === "LINE") {
      const v = e.vertices as { x: number; y: number; z: number }[];
      add(layer, densify(v.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })), step, false));
    } else if (t === "3DFACE") {
      add(layer, (e.vertices as { x: number; y: number; z: number }[]).map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })));
    } else if (t === "POINT" || t === "INSERT") {
      const p = e.position as { x: number; y: number; z?: number } | undefined;
      if (p) add(layer, [{ x: p.x, y: p.y, z: p.z ?? 0 }]);
    } else if (t === "TEXT" || t === "MTEXT") {
      const raw = String(e.text ?? "").replace(/\\[A-Za-z][^;]*;|[{}]/g, "").trim().replace(",", ".");
      const p = (e.startPoint ?? e.position) as { x: number; y: number } | undefined;
      if (p && /^-?\d{1,4}(\.\d{1,3})?$/.test(raw)) texts.push({ x: p.x, y: p.y, z: Number(raw), layer });
    }
  }
  let fromText = false;
  if (pts.length < 10 && texts.length >= 10) {
    // Plano en 2D con las cotas escritas como texto
    fromText = true;
    for (const p of texts) {
      pts.push(p);
      const L = layers.get(p.layer) ?? { name: p.layer, points: 0, withZ: 0 };
      L.points++;
      L.withZ++;
      layers.set(p.layer, L);
    }
  }
  if (pts.length < 10) throw new Error("el plano no tiene cotas: las curvas o puntos deben tener elevación (Z) o cotas escritas como texto");
  return { file, format: "DXF", layers: [...layers.values()].filter((l) => l.withZ > 0).sort((a, b) => b.withZ - a.withZ), pts, faces: null, fromText };
}

function parseLandXml(file: string, text: string): CadData {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const pts: CadData["pts"] = [];
  const idx = new Map<string, number>();
  const nums = (s: string | null) => (s ?? "").trim().split(/\s+/).map(Number);
  // LandXML: «norte este cota»
  doc.querySelectorAll("Surface Pnts > P").forEach((p) => {
    const [n, e, z] = nums(p.textContent);
    if (![n, e, z].every(Number.isFinite)) return;
    idx.set(p.getAttribute("id") ?? String(pts.length + 1), pts.length);
    pts.push({ x: e, y: n, z, layer: "Superficie" });
  });
  const faces: number[] = [];
  doc.querySelectorAll("Surface Faces > F").forEach((f) => {
    if (f.getAttribute("i") === "1") return; // cara invisible
    const ids = (f.textContent ?? "").trim().split(/\s+/);
    const tri = ids.map((i) => idx.get(i));
    if (tri.length === 3 && tri.every((t) => t != null)) faces.push(...(tri as number[]));
  });
  doc.querySelectorAll("CgPoint").forEach((p) => {
    const [n, e, z] = nums(p.textContent);
    if ([n, e, z].every(Number.isFinite) && z) pts.push({ x: e, y: n, z, layer: "Puntos" });
  });
  if (pts.length < 10) throw new Error("el LandXML no tiene una superficie con puntos");
  const layers = new Map<string, CadLayer>();
  for (const p of pts) {
    const L = layers.get(p.layer) ?? { name: p.layer, points: 0, withZ: 0 };
    L.points++;
    L.withZ++;
    layers.set(p.layer, L);
  }
  return { file, format: "LandXML", layers: [...layers.values()], pts, faces: faces.length ? Uint32Array.from(faces) : null, fromText: false };
}

export type CadModel = {
  file: string;
  crs: CrsId;
  layers: string[];
  x0: number; // esquina noroeste de la rejilla (m, UTM)
  y0: number;
  cell: number;
  w: number;
  h: number;
  z: Float32Array;
  points: number;
};

/** Triangula los puntos (o usa las caras del LandXML) y rasteriza el TIN en una rejilla UTM. */
export function buildModel(cad: CadData, crs: CrsId, layerNames: string[]): CadModel {
  const use = new Set(layerNames);
  let P = cad.faces ? cad.pts : cad.pts.filter((p) => use.has(p.layer));
  if (P.length < 10) throw new Error("las capas elegidas tienen menos de 10 puntos con cota");
  // Quitar duplicados y limitar a 250 000 puntos
  if (!cad.faces) {
    const seen = new Set<string>();
    P = P.filter((p) => {
      const k = `${Math.round(p.x * 20)},${Math.round(p.y * 20)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (P.length > 250000) {
      const k = Math.ceil(P.length / 250000);
      P = P.filter((_, i) => i % k === 0);
    }
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const area = (x1 - x0) * (y1 - y0);
  const cell = Math.max(0.5, Math.sqrt(area / 360000));
  const w = Math.max(2, Math.ceil((x1 - x0) / cell)), h = Math.max(2, Math.ceil((y1 - y0) / cell));
  const tri = cad.faces ?? new Delaunator(P.flatMap((p) => [p.x, p.y])).triangles;
  // Longitud de arista típica para descartar triángulos largos del contorno
  const edges: number[] = [];
  for (let t = 0; t < tri.length; t += Math.max(3, Math.floor(tri.length / 3000 / 3) * 3)) {
    const a = P[tri[t]], b = P[tri[t + 1]];
    edges.push(Math.hypot(a.x - b.x, a.y - b.y));
  }
  edges.sort((a, b) => a - b);
  const maxEdge = Math.max(cell * 4, (edges[Math.floor(edges.length / 2)] || cell) * 8);
  const z = new Float32Array(w * h).fill(NaN);
  for (let t = 0; t < tri.length; t += 3) {
    const a = P[tri[t]], b = P[tri[t + 1]], c = P[tri[t + 2]];
    if (Math.max(Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(b.x - c.x, b.y - c.y), Math.hypot(c.x - a.x, c.y - a.y)) > maxEdge) continue;
    const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(det) < 1e-9) continue;
    // celdas cuyo centro cae en el triángulo (columna i → x0 + (i+0.5)·cell; fila j → y1 − (j+0.5)·cell)
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - x0) / cell)), i1 = Math.min(w - 1, Math.ceil((Math.max(a.x, b.x, c.x) - x0) / cell));
    const j0 = Math.max(0, Math.floor((y1 - Math.max(a.y, b.y, c.y)) / cell)), j1 = Math.min(h - 1, Math.ceil((y1 - Math.min(a.y, b.y, c.y)) / cell));
    for (let j = j0; j <= j1; j++) {
      const py = y1 - (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + (i + 0.5) * cell;
        const l1 = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / det;
        const l2 = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        z[j * w + i] = l1 * a.z + l2 * b.z + l3 * c.z;
      }
    }
  }
  return { file: cad.file, crs, layers: layerNames, x0, y0: y1, cell, w, h, z, points: P.length };
}

/** Convierte el modelo UTM en un MDT con conversión a coordenadas geográficas. */
export function modelDem(m: CadModel): Dem {
  const def = CRS.find((c) => c.id === m.crs)!.def;
  const tr = proj4(def, "WGS84");
  const toLngLat = (px: number, py: number) => tr.forward([m.x0 + px * m.cell, m.y0 - py * m.cell]) as [number, number];
  const fromLngLat = (lng: number, lat: number) => {
    const [x, y] = tr.inverse([lng, lat]);
    return [(x - m.x0) / m.cell, (m.y0 - y) / m.cell] as [number, number];
  };
  const corners = [toLngLat(0, 0), toLngLat(m.w, 0), toLngLat(0, m.h), toLngLat(m.w, m.h)];
  return {
    w: m.w, h: m.h, z: m.z,
    cellM: [m.cell, m.cell],
    toLngLat, fromLngLat,
    bounds: [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))],
    source: `Plano ${m.file} (${m.points.toLocaleString("es-ES")} puntos, celda de ${m.cell.toFixed(1)} m)`,
    kind: "cad",
  };
}

// Guardado del plano en el navegador (IndexedDB), para no tener que cargarlo cada vez
const DB = "tempero-planos", STORE = "planos";
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveModel(m: CadModel | null) {
  try {
    const d = await db();
    const tx = d.transaction(STORE, "readwrite");
    if (m) tx.objectStore(STORE).put(m, "actual");
    else tx.objectStore(STORE).delete("actual");
    await new Promise((r) => (tx.oncomplete = r));
  } catch {
    /* sin almacenamiento: solo esta sesión */
  }
}
export async function loadModel(): Promise<CadModel | null> {
  try {
    const d = await db();
    const r = d.transaction(STORE).objectStore(STORE).get("actual");
    return await new Promise((res) => {
      r.onsuccess = () => res((r.result as CadModel) ?? null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}
