// Teselas de relieve (codificación Terrarium) generadas en el navegador a partir de los MDT cargados:
// el plano de AutoCAD donde lo haya, si no el LiDAR del IGN y, fuera de ambos, el relieve global.
import maplibregl from "maplibre-gl";
import { edgeDist, sample, type Dem } from "./dem";

const AWS = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium";
let layers: { dem: Dem; offset: number }[] = [];
let version = 0;
let registered = false;

export function setDemLayers(list: { dem: Dem; offset: number }[]): string {
  layers = list;
  version++;
  register();
  return `tempero-dem://v${version}/{z}/{x}/{y}`;
}

function tile2lng(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180;
}
function tile2lat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

async function awsPixels(z: number, x: number, y: number, signal: AbortSignal): Promise<ImageData | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const img = await awsOnce(z, x, y, signal);
    if (img || signal.aborted) return img;
  }
  return null;
}

async function awsOnce(z: number, x: number, y: number, signal: AbortSignal): Promise<ImageData | null> {
  try {
    const r = await fetch(`${AWS}/${z}/${x}/${y}.png`, { signal });
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const c = new OffscreenCanvas(256, 256);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, 256, 256);
    return ctx.getImageData(0, 0, 256, 256);
  } catch {
    return null;
  }
}

export const demStats = { req: 0, ok: 0, err: 0, aborted: 0, last: "" };

function register() {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol("tempero-dem", async (params, abort) => {
    demStats.req++;
    try {
      const r = await tile(params.url, abort);
      demStats.ok++;
      return r;
    } catch (e) {
      if (abort.signal.aborted) demStats.aborted++;
      else {
        demStats.err++;
        demStats.last = String(e);
      }
      throw e;
    }
  });
}

async function tile(url: string, abort: AbortController) {
  {
    const params = { url };
    const m = params.url.match(/\/(\d+)\/(\d+)\/(\d+)$/);
    if (!m) throw new Error("tesela no válida");
    const [z, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const w = tile2lng(x, z), e = tile2lng(x + 1, z), n = tile2lat(y, z), s = tile2lat(y + 1, z);
    const hit = layers.filter(({ dem: d }) => !(d.bounds[0] > e || d.bounds[2] < w || d.bounds[1] > n || d.bounds[3] < s));
    const base = await awsPixels(Math.min(z, 15), x, y, abort.signal);
    if (abort.signal.aborted) throw new DOMException("cancelada", "AbortError");
    if (!hit.length) {
      if (!base) throw new Error("sin relieve");
      return { data: await encode(base) };
    }
    const img = base ?? new ImageData(256, 256);
    const px = img.data;
    for (let j = 0; j < 256; j++) {
      const lat = tile2lat(y + (j + 0.5) / 256, z);
      for (let i = 0; i < 256; i++) {
        const lng = w + ((e - w) * (i + 0.5)) / 256;
        const k = (j * 256 + i) * 4;
        let h: number;
        if (base) h = px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768;
        else {
          // sin relieve global: se prolonga el borde del MDT más general
          const { dem: d, offset } = hit[hit.length - 1];
          const [cx, cy] = d.fromLngLat(lng, lat);
          h = clampSample(d, cx, cy) + offset;
        }
        // del más general al más preciso: cada capa se funde sobre la anterior en sus bordes
        for (let L = hit.length - 1; L >= 0; L--) {
          const { dem: d, offset } = hit[L];
          const [cx, cy] = d.fromLngLat(lng, lat);
          const v = sample(d, cx, cy);
          if (Number.isNaN(v)) continue;
          const t = Math.min(1, Math.max(0, (edgeDist(d, cx, cy) - 1) / 10));
          h = h * (1 - t) + (v + offset) * t;
        }
        const val = Math.max(0, h + 32768);
        px[k] = Math.floor(val / 256);
        px[k + 1] = Math.floor(val % 256);
        px[k + 2] = Math.floor((val % 1) * 256);
        px[k + 3] = 255;
      }
    }
    return { data: await encode(img) };
  }
}

function clampSample(d: Dem, px: number, py: number) {
  const x = Math.min(d.w - 0.5, Math.max(0.5, px)), y = Math.min(d.h - 0.5, Math.max(0.5, py));
  const v = sample(d, x, y);
  if (!Number.isNaN(v)) return v;
  let s = 0, n = 0;
  for (let i = 0; i < d.z.length; i += 97) if (!Number.isNaN(d.z[i])) { s += d.z[i]; n++; }
  return n ? s / n : 0;
}

async function encode(img: ImageData): Promise<ArrayBuffer> {
  const c = new OffscreenCanvas(256, 256);
  c.getContext("2d")!.putImageData(img, 0, 0);
  const blob = await c.convertToBlob({ type: "image/png" });
  return blob.arrayBuffer();
}
