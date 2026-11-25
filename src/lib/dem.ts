// Modelo digital del terreno (MDT): rejilla regular de cotas con su conversión a coordenadas geográficas.
import { fromArrayBuffer } from "geotiff";

export type Dem = {
  w: number;
  h: number;
  z: Float32Array; // cota (m) por celda, fila a fila de norte a sur; NaN = sin dato
  cellM: [number, number]; // tamaño de celda en metros (x, y)
  toLngLat: (px: number, py: number) => [number, number]; // px, py en coordenadas de celda (0..w, 0..h)
  fromLngLat: (lng: number, lat: number) => [number, number];
  bounds: [number, number, number, number]; // oeste, sur, este, norte
  source: string;
};

/** MDT del IGN (LiDAR PNOA) por servicio WCS. Resolución 5 m, o 25 m si la zona es grande. */
export async function fetchIgnDem(b: [number, number, number, number], marginFrac = 0.25): Promise<Dem> {
  let [w, s, e, n] = b;
  const dx = (e - w) * marginFrac + 0.0015, dy = (n - s) * marginFrac + 0.0012;
  w -= dx; e += dx; s -= dy; n += dy;
  const midLat = (s + n) / 2;
  const mPerDegX = 111320 * Math.cos((midLat * Math.PI) / 180);
  const widthM = (e - w) * mPerDegX, heightM = (n - s) * 110540;
  const res = Math.max(widthM, heightM) / 5 > 900 ? 25 : 5;
  const url =
    `https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&REQUEST=GetCoverage&VERSION=2.0.1&COVERAGEID=Elevacion4258_${res}` +
    `&SUBSET=Lat(${s.toFixed(6)},${n.toFixed(6)})&SUBSET=Long(${w.toFixed(6)},${e.toFixed(6)})&FORMAT=image/tiff`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("El IGN no ha devuelto el modelo del terreno (" + r.status + ")");
  const tiff = await fromArrayBuffer(await r.arrayBuffer());
  const img = await tiff.getImage();
  const W = img.getWidth(), H = img.getHeight();
  const [west, south, east, north] = img.getBoundingBox();
  const ras = (await img.readRasters({ interleave: true })) as unknown as ArrayLike<number>;
  const nodata = img.getGDALNoData();
  const z = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = ras[i];
    z[i] = v == null || v === nodata || v < -100 ? NaN : v;
  }
  const cx = (east - west) / W, cy = (north - south) / H;
  return {
    w: W, h: H, z,
    cellM: [cx * mPerDegX, cy * 110540],
    toLngLat: (px, py) => [west + px * cx, north - py * cy],
    fromLngLat: (lng, lat) => [(lng - west) / cx, (north - lat) / cy],
    bounds: [west, south, east, north],
    source: `MDT${String(res).padStart(2, "0")} del IGN (LiDAR PNOA), celda de ${res} m`,
  };
}
