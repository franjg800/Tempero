"use client";

// Maqueta 3D del terreno: solo la finca o la parcela, recortada sobre fondo blanco,
// con la ortofoto encima, zócalo de tierra y sombras suaves. No carga ningún mapa alrededor.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { sample, type Dem } from "@/lib/dem";
import type { Exit, Hydro } from "@/lib/hydro";
import { TRAIL, WaterSim } from "@/lib/flow";

export type MaquetaApi = { snapshot: () => Promise<Blob | null> };

type Props = {
  dem: Dem;
  hy: Hydro;
  spawn: Int32Array;
  polys: (Polygon | MultiPolygon)[];
  crop: "parcelas" | "entorno";
  ex: number;
  overlays: { contours: FeatureCollection; streams: FeatureCollection; pools: FeatureCollection };
  show: { contours: boolean; streams: boolean; pools: boolean };
  exits: Exit[];
  playing: boolean;
  mode: "lluvia" | "punto";
  point: [number, number] | null;
  particles: number;
  onPoint: (lngLat: [number, number]) => void;
  apiRef?: MutableRefObject<MaquetaApi | null>;
};

type Region = {
  x0: number; y0: number; step: number; nx: number; ny: number;
  h: Float32Array; inside: Uint8Array;
  zmin: number; zmax: number; cgx: number; cgy: number; sizeM: number;
  bbox: [number, number, number, number]; // lng/lat
  rings: [number, number][][][]; // polígonos en coordenadas de rejilla
};

// ---------- región recortada ----------

function inPolys(x: number, y: number, polys: [number, number][][][]) {
  for (const rings of polys) {
    let inside = false;
    for (const r of rings)
      for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
        const [xa, ya] = r[a], [xb, yb] = r[b];
        if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
      }
    if (inside) return true;
  }
  return false;
}

function makeRegion(d: Dem, polys: (Polygon | MultiPolygon)[], crop: Props["crop"]): Region | null {
  const rings = polys.flatMap((g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates)).map((poly) => poly.map((r) => r.map(([lng, lat]) => d.fromLngLat(lng, lat))));
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const poly of rings) for (const [x, y] of poly[0]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  if (!Number.isFinite(bx0)) { bx0 = 0; by0 = 0; bx1 = d.w; by1 = d.h; }
  const pad = crop === "entorno" ? Math.max(bx1 - bx0, by1 - by0) * 0.2 + 6 : 0.8;
  const x0 = Math.max(0.5, bx0 - pad), y0 = Math.max(0.5, by0 - pad);
  const x1 = Math.min(d.w - 0.5, bx1 + pad), y1 = Math.min(d.h - 0.5, by1 + pad);
  if (x1 <= x0 || y1 <= y0) return null;
  const step = Math.min(1, Math.max(0.12, Math.max(x1 - x0, y1 - y0) / 260));
  const nx = Math.ceil((x1 - x0) / step) + 1, ny = Math.ceil((y1 - y0) / step) + 1;
  const h = new Float32Array(nx * ny), inside = new Uint8Array(nx * ny);
  let zmin = Infinity, zmax = -Infinity;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const gx = x0 + i * step, gy = y0 + j * step, k = j * nx + i;
      const v = sample(d, gx, gy);
      h[k] = v;
      const ok = !Number.isNaN(v) && (crop === "entorno" || inPolys(gx, gy, rings));
      inside[k] = ok ? 1 : 0;
      if (ok) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); }
    }
  if (!Number.isFinite(zmin)) return null;
  const cgx = x0 + ((nx - 1) * step) / 2, cgy = y0 + ((ny - 1) * step) / 2;
  const sizeM = Math.max((nx - 1) * step * d.cellM[0], (ny - 1) * step * d.cellM[1]);
  const corners = [d.toLngLat(x0, y0), d.toLngLat(x0 + (nx - 1) * step, y0), d.toLngLat(x0, y0 + (ny - 1) * step), d.toLngLat(x0 + (nx - 1) * step, y0 + (ny - 1) * step)];
  const bbox: Region["bbox"] = [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))];
  return { x0, y0, step, nx, ny, h, inside, zmin, zmax, cgx, cgy, sizeM, bbox, rings };
}

// ---------- ortofoto (mosaico de teselas PNOA solo para la finca) ----------

const PNOA = (z: number, x: number, y: number) =>
  `https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix=${z}&TileRow=${y}&TileCol=${x}`;
const lon2x = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z * 256;
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * 256;
};

type Mosaic = { z: number; tx0: number; ty0: number; W: number; H: number; px: (lng: number, lat: number) => [number, number]; key: string };

function mosaicLayout(b: Region["bbox"]): Mosaic {
  const [w, s, e, n] = b;
  let z = 19;
  while (z > 10 && (lon2x(e, z) - lon2x(w, z) > 2300 || lat2y(s, z) - lat2y(n, z) > 2300)) z--;
  const tx0 = Math.floor(lon2x(w, z) / 256), tx1 = Math.floor(lon2x(e, z) / 256);
  const ty0 = Math.floor(lat2y(n, z) / 256), ty1 = Math.floor(lat2y(s, z) / 256);
  return {
    z, tx0, ty0, W: (tx1 - tx0 + 1) * 256, H: (ty1 - ty0 + 1) * 256,
    px: (lng, lat) => [lon2x(lng, z) - tx0 * 256, lat2y(lat, z) - ty0 * 256],
    key: `${z}/${tx0}/${ty0}/${tx1}/${ty1}`,
  };
}

const mosaicCache = new Map<string, Promise<HTMLCanvasElement>>();
function loadMosaic(m: Mosaic): Promise<HTMLCanvasElement> {
  const hit = mosaicCache.get(m.key);
  if (hit) return hit;
  const p = (async () => {
    const c = document.createElement("canvas");
    c.width = m.W;
    c.height = m.H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#B9AE92";
    ctx.fillRect(0, 0, m.W, m.H);
    const jobs: Promise<void>[] = [];
    for (let ty = 0; ty < m.H / 256; ty++)
      for (let tx = 0; tx < m.W / 256; tx++)
        jobs.push(
          new Promise<void>((res) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              ctx.drawImage(img, tx * 256, ty * 256);
              res();
            };
            img.onerror = () => res();
            img.src = PNOA(m.z, m.tx0 + tx, m.ty0 + ty);
          }),
        );
    await Promise.all(jobs);
    return c;
  })();
  mosaicCache.set(m.key, p);
  return p;
}

function drawOverlays(ctx: CanvasRenderingContext2D, m: Mosaic, o: Props["overlays"], show: Props["show"], polys: Props["polys"], crop: Props["crop"]) {
  const u = Math.max(1, m.W / 1100);
  const path = (coords: number[][]) => {
    coords.forEach(([lng, lat], i) => {
      const [x, y] = m.px(lng, lat);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (show.pools)
    for (const f of o.pools.features) {
      const g = f.geometry as MultiPolygon;
      ctx.beginPath();
      for (const poly of g.coordinates) for (const ring of poly) { path(ring); ctx.closePath(); }
      ctx.fillStyle = (f.properties?.depth ?? 0) >= 0.2 ? "rgba(30,94,154,0.55)" : "rgba(70,160,225,0.5)";
      ctx.fill("evenodd");
    }
  if (show.contours) {
    for (const f of o.contours.features) {
      const master = !!f.properties?.master;
      ctx.beginPath();
      path((f.geometry as GeoJSON.LineString).coordinates);
      ctx.strokeStyle = master ? "rgba(255,247,226,0.92)" : "rgba(255,247,226,0.5)";
      ctx.lineWidth = master ? 1.8 * u : 0.9 * u;
      ctx.stroke();
    }
    ctx.font = `600 ${Math.round(11 * u)}px "Instrument Sans", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of o.contours.features) {
      if (!f.properties?.master) continue;
      const c = (f.geometry as GeoJSON.LineString).coordinates;
      if (c.length < 12) continue;
      const [x, y] = m.px(c[Math.floor(c.length / 2)][0], c[Math.floor(c.length / 2)][1]);
      const t = (Math.round(f.properties.z * 10) / 10).toLocaleString("es-ES");
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = "rgba(20,32,26,0.75)";
      ctx.strokeText(t, x, y);
      ctx.fillStyle = "#FFF7E2";
      ctx.fillText(t, x, y);
    }
  }
  if (show.streams)
    for (const f of o.streams.features) {
      ctx.beginPath();
      path((f.geometry as GeoJSON.LineString).coordinates);
      const a = Math.log(Math.max(2, f.properties?.acc ?? 2));
      ctx.strokeStyle = "rgba(98,193,240,0.85)";
      ctx.lineWidth = Math.min(6, 0.6 + (a - 3) * 0.6) * u;
      ctx.stroke();
    }
  if (crop === "entorno")
    for (const g of polys) {
      ctx.beginPath();
      for (const poly of g.type === "Polygon" ? [g.coordinates] : g.coordinates) for (const ring of poly) { path(ring); ctx.closePath(); }
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.2 * u;
      ctx.stroke();
    }
}

// ---------- componente ----------

type Scene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  light: THREE.DirectionalLight;
  model: THREE.Group;
  terrain: THREE.Mesh | null;
  ground: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture | null;
  heads: THREE.Points;
  trails: THREE.LineSegments;
  pin: THREE.Group;
  exits: THREE.Group;
};

function circleSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.55, "rgba(255,255,255,0.9)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function Maqueta(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  const S = useRef<Scene | null>(null);
  const P = useRef(props);
  P.current = props;
  const sim = useRef<WaterSim | null>(null);
  const exScale = useRef(props.ex);

  const polyKey = useMemo(() => JSON.stringify(props.polys).length + ":" + props.polys.length + ":" + JSON.stringify(props.polys).slice(0, 200), [props.polys]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const region = useMemo(() => makeRegion(props.dem, props.polys, props.crop), [props.dem, polyKey, props.crop]);
  const regionRef = useRef(region);
  regionRef.current = region;
  const mosaic = useMemo(() => (region ? mosaicLayout(region.bbox) : null), [region]);

  // Altura en la escena para un punto de la rejilla
  const heightAt = (gx: number, gy: number) => {
    const r = regionRef.current;
    if (!r) return 0;
    const v = sample(P.current.dem, gx, gy);
    return Number.isNaN(v) ? 0 : (v - r.zmin) * exScale.current;
  };
  const toWorld = (gx: number, gy: number, lift = 0) => {
    const r = regionRef.current!;
    const d = P.current.dem;
    return new THREE.Vector3((gx - r.cgx) * d.cellM[0], heightAt(gx, gy) + lift, (gy - r.cgy) * d.cellM[1]);
  };
  const insideAt = (gx: number, gy: number) => {
    const r = regionRef.current;
    if (!r) return false;
    const i = Math.round((gx - r.x0) / r.step), j = Math.round((gy - r.y0) / r.step);
    return i >= 0 && j >= 0 && i < r.nx && j < r.ny && r.inside[j * r.nx + i] === 1;
  };

  // Escena (una vez)
  useEffect(() => {
    const el = box.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.38;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d1c2, 1.15));
    const light = new THREE.DirectionalLight(0xffffff, 2.3);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.radius = 4;
    scene.add(light, light.target);

    const model = new THREE.Group();
    scene.add(model);
    const material = new THREE.MeshStandardMaterial({ color: 0xcfc6ae, roughness: 0.93, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.17 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sprite = circleSprite();
    const heads = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 3.6, sizeAttenuation: false, map: sprite, vertexColors: true, transparent: true, depthWrite: false }));
    const trails = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    heads.renderOrder = 3;
    trails.renderOrder = 2;
    heads.frustumCulled = false;
    trails.frustumCulled = false;
    scene.add(heads, trails);

    const pin = new THREE.Group();
    pin.visible = false;
    scene.add(pin);
    const exits = new THREE.Group();
    scene.add(exits);

    S.current = { renderer, scene, camera, controls, light, model, terrain: null, ground, material, texture: null, heads, trails, pin, exits };

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    // Clic para el punto de riego (sin arrastrar)
    let down: [number, number] | null = null;
    const ray = new THREE.Raycaster();
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      const s = S.current;
      if (!down || !s?.terrain || P.current.mode !== "punto") return;
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      // se avanza por el rayo hasta tocar la superficie de la maqueta
      const r = regionRef.current;
      if (!r) return;
      const d = P.current.dem;
      const o = ray.ray.origin, dir = ray.ray.direction;
      const stepLen = r.sizeM / 600;
      const p = new THREE.Vector3();
      for (let k = 0; k < 6000; k++) {
        p.copy(dir).multiplyScalar(k * stepLen).add(o);
        const gx = p.x / d.cellM[0] + r.cgx, gy = p.z / d.cellM[1] + r.cgy;
        if (!insideAt(gx, gy)) continue;
        if (p.y <= heightAt(gx, gy)) {
          P.current.onPoint(d.toLngLat(gx, gy));
          return;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Bucle
    let last = performance.now();
    const v = new THREE.Vector3();
    renderer.setAnimationLoop((t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      controls.update();
      const w = sim.current;
      if (w && P.current.playing && (P.current.mode === "lluvia" || P.current.point)) {
        w.step(dt);
        drawWater(w);
        heads.visible = trails.visible = true;
      } else if (!P.current.playing && w) {
        heads.visible = trails.visible = true;
      } else heads.visible = trails.visible = false;
      // etiquetas y norte
      const lab = labels.current;
      if (lab) {
        const W = el.clientWidth, H = el.clientHeight;
        for (const node of Array.from(lab.children) as HTMLElement[]) {
          v.set(Number(node.dataset.x), Number(node.dataset.y), Number(node.dataset.z)).project(camera);
          const vis = v.z < 1;
          node.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -140%)`;
          node.style.opacity = vis ? "1" : "0";
        }
      }
      if (compass.current) compass.current.style.transform = `rotate(${(controls.getAzimuthalAngle() * 180) / Math.PI}deg)`;
      renderer.render(scene, camera);
    });

    if (props.apiRef)
      props.apiRef.current = {
        snapshot: () =>
          new Promise((res) => {
            renderer.render(scene, camera);
            renderer.domElement.toBlob((b) => res(b), "image/png");
          }),
      };

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      S.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawWater(w: WaterSim) {
    const s = S.current;
    const r = regionRef.current;
    if (!s || !r) return;
    const d = P.current.dem;
    const lift = r.sizeM * 0.0012;
    const n = w.n;
    const hp = s.heads.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!hp || hp.count !== n) return;
    const hc = s.heads.geometry.getAttribute("color") as THREE.BufferAttribute;
    const tp = s.trails.geometry.getAttribute("position") as THREE.BufferAttribute;
    const tc = s.trails.geometry.getAttribute("color") as THREE.BufferAttribute;
    const H = hp.array as Float32Array, HC = hc.array as Float32Array, TP = tp.array as Float32Array, TC = tc.array as Float32Array;
    const wx = (gx: number) => (gx - r.cgx) * d.cellM[0];
    const wz = (gy: number) => (gy - r.cgy) * d.cellM[1];
    for (let i = 0; i < n; i++) {
      const f = w.tlen[i] ? w.fade(i) : 0;
      const gx = w.x[i], gy = w.y[i];
      H[i * 3] = wx(gx);
      H[i * 3 + 1] = heightAt(gx, gy) + lift;
      H[i * 3 + 2] = wz(gy);
      const still = w.still[i];
      HC[i * 4] = still ? 0.36 : 0.66;
      HC[i * 4 + 1] = still ? 0.7 : 0.88;
      HC[i * 4 + 2] = 1;
      HC[i * 4 + 3] = f;
      const base = i * TRAIL * 2;
      const len = still ? 0 : w.tlen[i];
      for (let k = 0; k < TRAIL - 1; k++) {
        const o = (i * (TRAIL - 1) + k) * 2;
        const ok = k + 1 < len;
        const ax = w.trail[base + k * 2], ay = w.trail[base + k * 2 + 1];
        const bx = ok ? w.trail[base + (k + 1) * 2] : ax, by = ok ? w.trail[base + (k + 1) * 2 + 1] : ay;
        TP[o * 3] = wx(ax); TP[o * 3 + 1] = heightAt(ax, ay) + lift; TP[o * 3 + 2] = wz(ay);
        TP[o * 3 + 3] = wx(bx); TP[o * 3 + 4] = heightAt(bx, by) + lift; TP[o * 3 + 5] = wz(by);
        const a0 = ok ? f * (1 - k / (TRAIL - 1)) : 0, a1 = ok ? f * (1 - (k + 1) / (TRAIL - 1)) : 0;
        TC.set([0.62, 0.86, 1, a0 * 0.85, 0.62, 0.86, 1, a1 * 0.85], o * 4);
      }
    }
    hp.needsUpdate = hc.needsUpdate = tp.needsUpdate = tc.needsUpdate = true;
  }

  // Geometría: superficie recortada + zócalo
  useEffect(() => {
    const s = S.current;
    if (!s || !region || !mosaic) return;
    exScale.current = props.ex;
    const d = props.dem;
    const { nx, ny, step, x0, y0, h, inside, zmin, cgx, cgy, sizeM } = region;
    const ex = props.ex;
    const N = nx * ny;
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i, gx = x0 + i * step, gy = y0 + j * step;
        pos[k * 3] = (gx - cgx) * d.cellM[0];
        pos[k * 3 + 1] = Number.isNaN(h[k]) ? 0 : (h[k] - zmin) * ex;
        pos[k * 3 + 2] = (gy - cgy) * d.cellM[1];
        const [lng, lat] = d.toLngLat(gx, gy);
        const [px, py] = mosaic.px(lng, lat);
        uv[k * 2] = px / mosaic.W;
        uv[k * 2 + 1] = 1 - py / mosaic.H;
      }
    const idx: number[] = [];
    const tri = (a: number, b: number, c: number) => {
      // orientación hacia arriba
      const ax = pos[a * 3], az = pos[a * 3 + 2], bx = pos[b * 3], bz = pos[b * 3 + 2], cx = pos[c * 3], cz = pos[c * 3 + 2];
      const ny_ = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (ny_ >= 0) idx.push(a, b, c);
      else idx.push(a, c, b);
    };
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
        const ia = inside[a], ib = inside[b], ic = inside[c], ie = inside[e];
        const cnt = ia + ib + ic + ie;
        if (cnt === 4) { tri(a, c, b); tri(b, c, e); }
        else if (cnt === 3) {
          if (!ia) tri(b, c, e);
          else if (!ib) tri(a, c, e);
          else if (!ic) tri(a, e, b);
          else tri(a, c, b);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // Bordes: aristas que solo pertenecen a un triángulo → paredes del zócalo
    const edges = new Map<number, [number, number, number, number]>(); // a, b, nº de triángulos, vértice opuesto
    for (let t = 0; t < idx.length; t += 3)
      for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + ((e + 1) % 3)], c = idx[t + ((e + 2) % 3)];
        const key = Math.min(a, b) * N + Math.max(a, b);
        const cur = edges.get(key);
        if (cur) cur[2]++;
        else edges.set(key, [a, b, 1, c]);
      }
    const thick = Math.max(1, sizeM * 0.022);
    const soil = thick * 0.3;
    const baseY = -thick;
    // Paredes con vértices compartidos entre aristas vecinas: normales suavizadas, sin rayas
    const wp: number[] = [], wc: number[] = [], wi: number[] = [];
    const ring = new Map<number, number>(); // vértice del borde → primer índice de sus 4 vértices de pared
    const cSoilTop = new THREE.Color("#7A5B40"), cSoil = new THREE.Color("#55402F"), cBase = new THREE.Color("#F2EEE6"), cBase2 = new THREE.Color("#DCD4C5");
    const wallVerts = (v: number) => {
      let k = ring.get(v);
      if (k != null) return k;
      k = wp.length / 3;
      ring.set(v, k);
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      wp.push(x, y, z, x, y - soil, z, x, y - soil, z, x, baseY, z);
      for (const c of [cSoilTop, cSoil, cBase, cBase2]) wc.push(c.r, c.g, c.b);
      return k;
    };
    for (const [a0, b0, n, c] of edges.values()) {
      if (n !== 1) continue;
      // que la cara mire hacia fuera (al lado contrario del triángulo)
      const dx = pos[b0 * 3] - pos[a0 * 3], dz = pos[b0 * 3 + 2] - pos[a0 * 3 + 2];
      const mx = pos[c * 3] - (pos[a0 * 3] + pos[b0 * 3]) / 2, mz = pos[c * 3 + 2] - (pos[a0 * 3 + 2] + pos[b0 * 3 + 2]) / 2;
      const out = dz * mx - dx * mz < 0; // normal (dz, −dx) apunta fuera
      const [a, b] = out ? [a0, b0] : [b0, a0];
      const A = wallVerts(a), B = wallVerts(b);
      wi.push(A, B, A + 1, B, B + 1, A + 1); // banda de tierra
      wi.push(A + 2, B + 2, A + 3, B + 2, B + 3, A + 3); // zócalo
    }
    const wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
    wgeo.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3));
    wgeo.setIndex(wi);
    wgeo.computeVertexNormals();

    // Sustituir el modelo
    s.model.children.forEach((o) => (o as THREE.Mesh).geometry?.dispose());
    s.model.clear();
    const terrain = new THREE.Mesh(geo, s.material);
    terrain.castShadow = terrain.receiveShadow = true;
    const walls = new THREE.Mesh(wgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }));
    walls.castShadow = walls.receiveShadow = true;
    s.model.add(terrain, walls);
    s.terrain = terrain;

    // Suelo de sombras y luz a la medida de la maqueta
    s.ground.scale.set(sizeM * 8, sizeM * 8, 1);
    s.ground.position.y = baseY - 0.01;
    const top = (region.zmax - zmin) * ex;
    s.light.position.set(-sizeM * 0.75, sizeM * 1.15 + top, -sizeM * 0.55);
    s.light.target.position.set(0, 0, 0);
    const sc = s.light.shadow.camera;
    sc.left = sc.bottom = -sizeM * 0.9;
    sc.right = sc.top = sizeM * 0.9;
    sc.near = sizeM * 0.1;
    sc.far = sizeM * 4 + top;
    sc.updateProjectionMatrix();
    s.light.shadow.bias = -0.0004;
    s.light.shadow.normalBias = sizeM * 0.0012;
    s.camera.near = sizeM * 0.005;
    s.camera.far = sizeM * 30;
    s.camera.updateProjectionMatrix();
    s.controls.minDistance = sizeM * 0.15;
    s.controls.maxDistance = sizeM * 6;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, mosaic, props.ex]);

  // Encuadre inicial al cambiar de finca o de recorte
  useEffect(() => {
    const s = S.current;
    if (!s || !region) return;
    const top = (region.zmax - region.zmin) * props.ex;
    const D = region.sizeM;
    const el = box.current!;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    // distancia para que quepa la maqueta con aire alrededor
    const dist = (D * 0.66) / Math.tan(((s.camera.fov / 2) * Math.PI) / 180) / Math.min(1, aspect);
    const dir = new THREE.Vector3(0.32, 0.62, 0.72).normalize();
    s.controls.target.set(0, top * 0.3, 0);
    s.camera.position.copy(dir.multiplyScalar(dist)).add(s.controls.target);
    s.controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // Ortofoto + capas pintadas
  useEffect(() => {
    const s = S.current;
    if (!s || !mosaic) return;
    let alive = true;
    loadMosaic(mosaic).then((base) => {
      if (!alive || !S.current) return;
      const c = document.createElement("canvas");
      c.width = mosaic.W;
      c.height = mosaic.H;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(base, 0, 0);
      drawOverlays(ctx, mosaic, props.overlays, props.show, props.polys, props.crop);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = s.renderer.capabilities.getMaxAnisotropy();
      s.texture?.dispose();
      s.texture = tex;
      s.material.map = tex;
      s.material.color.set(0xffffff);
      s.material.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosaic, props.overlays, props.show.contours, props.show.streams, props.show.pools, props.crop]);

  // Simulación del agua
  useEffect(() => {
    const s = S.current;
    if (!s || !region) return;
    const w = new WaterSim(props.dem, props.hy, props.spawn, props.particles, insideAt);
    sim.current = w;
    const n = w.n;
    s.heads.geometry.dispose();
    s.trails.geometry.dispose();
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    hg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * (TRAIL - 1) * 6), 3));
    tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * (TRAIL - 1) * 8), 4));
    s.heads.geometry = hg;
    s.trails.geometry = tg;
    return () => {
      sim.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, props.hy, props.spawn, props.particles]);

  // Punto de riego
  useEffect(() => {
    const s = S.current;
    const w = sim.current;
    if (!s || !region) return;
    const d = props.dem;
    const grid = props.mode === "punto" && props.point ? d.fromLngLat(props.point[0], props.point[1]) : null;
    w?.setSource(grid);
    s.pin.clear();
    s.pin.visible = !!grid;
    if (grid) {
      const D = region.sizeM;
      const p = toWorld(grid[0], grid[1]);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.002, D * 0.002, D * 0.04, 12), new THREE.MeshStandardMaterial({ color: 0x1e6aa0 }));
      stem.position.set(p.x, p.y + D * 0.02, p.z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(D * 0.008, 20, 14), new THREE.MeshStandardMaterial({ color: 0x1e6aa0, roughness: 0.4 }));
      head.position.set(p.x, p.y + D * 0.042, p.z);
      head.castShadow = stem.castShadow = true;
      s.pin.add(stem, head);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.point, region, props.ex, props.hy]);

  // Salidas del agua
  useEffect(() => {
    const s = S.current;
    const lab = labels.current;
    if (!s || !region || !lab) return;
    s.exits.clear();
    lab.innerHTML = "";
    const D = region.sizeM;
    props.exits.forEach((e, i) => {
      const [gx, gy] = props.dem.fromLngLat(e.lngLat[0], e.lngLat[1]);
      const p = toWorld(gx, gy, D * 0.004);
      const m = new THREE.Mesh(new THREE.SphereGeometry(D * 0.007, 20, 14), new THREE.MeshStandardMaterial({ color: e.pool ? 0x1e5e9a : 0xb4532a, roughness: 0.5 }));
      m.position.copy(p);
      m.castShadow = true;
      s.exits.add(m);
      const el = document.createElement("div");
      el.className = "pointer-events-none absolute top-0 left-0 rounded-md bg-[oklch(0.22_0.02_155/0.86)] px-1.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-white transition-opacity";
      el.textContent = `${e.pool ? "Charca" : i + 1} · ${Math.round(e.share * 100)} %`;
      el.dataset.x = String(p.x);
      el.dataset.y = String(p.y);
      el.dataset.z = String(p.z);
      lab.appendChild(el);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.exits, region, props.ex]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_38%,#ffffff_0%,#f5f3ee_58%,#e7e3da_100%)]">
      <div ref={box} className={`absolute inset-0 ${props.mode === "punto" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`} />
      <div ref={labels} className="pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute bottom-6 left-6 flex h-12 w-12 items-center justify-center rounded-full border border-linea bg-white/90 shadow-[0_2px_8px_oklch(0.2_0.02_155/0.12)]" aria-label="Norte">
        <div ref={compass} className="flex flex-col items-center">
          <span className="text-[10px] leading-none font-bold text-tinta">N</span>
          <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden><path d="M6 0 L11 12 L6 9 L1 12 Z" fill="#B4532A" /><path d="M6 9 L11 12 L6 20 L1 12 Z" fill="#C9C2B3" /></svg>
        </div>
      </div>
    </div>
  );
}
