// Animación del agua: partículas que bajan por el terreno siguiendo la dirección de máxima pendiente,
// se aceleran en las vaguadas y se quedan quietas en las zonas que se encharcan.
import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type { Dem } from "./dem";
import type { Hydro } from "./hydro";

const T = 8; // puntos de estela
export const TIME_SCALE = 60; // 1 s de animación = 1 min real

export class WaterSim {
  private n: number;
  private x: Float32Array;
  private y: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private still: Uint8Array;
  private trail: Float64Array; // n · T · 2
  private tlen: Uint8Array;
  private tclock: Float32Array;
  private raf = 0;
  private last = 0;
  private lastDraw = 0;
  private source: [number, number] | null = null;
  running = false;
  pooled = 0;

  constructor(
    private map: maplibregl.Map,
    private d: Dem,
    private hy: Hydro,
    private spawn: Int32Array, // celdas donde cae la lluvia
    n = 900,
  ) {
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.still = new Uint8Array(n);
    this.trail = new Float64Array(n * T * 2);
    this.tlen = new Uint8Array(n);
    this.tclock = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.respawn(i);
      this.age[i] = Math.random() * this.life[i];
    }
  }

  /** Punto de riego (boca, gotero, hidrante): el agua sale de ahí en vez de llover. */
  setSource(lngLat: [number, number] | null) {
    this.source = lngLat;
    for (let i = 0; i < this.n; i++) {
      this.respawn(i);
      this.age[i] = Math.random() * this.life[i] * (lngLat ? 1 : 0.6);
    }
  }

  private respawn(i: number) {
    const { w, h } = this.d;
    let cx: number, cy: number;
    if (this.source) {
      const [sx, sy] = this.d.fromLngLat(this.source[0], this.source[1]);
      const r = Math.random() * 2.5, a = Math.random() * Math.PI * 2;
      cx = sx + Math.cos(a) * r;
      cy = sy + Math.sin(a) * r;
    } else if (this.spawn.length) {
      const c = this.spawn[(Math.random() * this.spawn.length) | 0];
      cx = (c % w) + Math.random();
      cy = ((c / w) | 0) + Math.random();
    } else {
      cx = w * (0.15 + Math.random() * 0.7);
      cy = h * (0.15 + Math.random() * 0.7);
    }
    this.x[i] = cx;
    this.y[i] = cy;
    this.age[i] = 0;
    this.life[i] = 14 + Math.random() * 16;
    this.still[i] = 0;
    this.tlen[i] = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    // primero que cargue el relieve: la animación no debe quitarle tiempo a las teselas
    const t0 = performance.now();
    const wait = () => {
      if (!this.running) return;
      let ready = true;
      try {
        ready = !this.map.getTerrain() || this.map.isSourceLoaded("dem");
      } catch {
        ready = true;
      }
      if (ready || performance.now() - t0 > 10000) this.loop();
      else setTimeout(wait, 300);
    };
    wait();
  }

  private loop() {
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.step(dt);
      if (t - this.lastDraw > 40) {
        this.lastDraw = t;
        this.draw();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  clear() {
    this.stop();
    const empty = { type: "FeatureCollection" as const, features: [] };
    (this.map.getSource("t-water-trail") as GeoJSONSource | undefined)?.setData(empty);
    (this.map.getSource("t-water-head") as GeoJSONSource | undefined)?.setData(empty);
  }

  private step(dt: number) {
    const { w, h } = this.d;
    const { rec, slope, acc, pool } = this.hy;
    const cellM = (this.d.cellM[0] + this.d.cellM[1]) / 2;
    let pooled = 0;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] > this.life[i]) {
        this.respawn(i);
        continue;
      }
      const cx = Math.floor(this.x[i]), cy = Math.floor(this.y[i]);
      if (cx < 0 || cy < 0 || cx >= w || cy >= h || Number.isNaN(this.d.z[cy * w + cx])) {
        this.respawn(i);
        continue;
      }
      const c = cy * w + cx;
      if (pool[c]) {
        // en una charca el agua se frena y se queda
        this.still[i] = 1;
        pooled++;
        this.x[i] += (Math.random() - 0.5) * 0.04;
        this.y[i] += (Math.random() - 0.5) * 0.04;
        this.age[i] += dt * 0.2;
        this.track(i, dt);
        continue;
      }
      const r = rec[c];
      if (r < 0) {
        this.respawn(i);
        continue;
      }
      const tx = (r % w) + 0.5, ty = ((r / w) | 0) + 0.5;
      let dx = tx - this.x[i], dy = ty - this.y[i];
      const L = Math.hypot(dx, dy) || 1;
      dx /= L;
      dy /= L;
      // velocidad (m/s): lámina ~0,1-0,3 m/s; en surcos y vaguadas hasta ~1 m/s
      const v = Math.min(1.4, 0.06 + 2.2 * Math.sqrt(Math.max(0.0005, slope[c])) * Math.pow(acc[c], 0.12));
      const move = Math.min(L + 0.3, ((v * TIME_SCALE) / cellM) * dt);
      const jit = (Math.random() - 0.5) * 0.25 * move;
      this.x[i] += dx * move - dy * jit;
      this.y[i] += dy * move + dx * jit;
      this.track(i, dt);
    }
    this.pooled = pooled;
  }

  private track(i: number, dt: number) {
    this.tclock[i] += dt;
    if (this.tclock[i] < 0.07 && this.tlen[i] > 0) return;
    this.tclock[i] = 0;
    const [lng, lat] = this.d.toLngLat(this.x[i], this.y[i]);
    const base = i * T * 2;
    const len = this.tlen[i];
    if (len < T) this.tlen[i] = len + 1;
    for (let k = Math.min(len, T - 1); k > 0; k--) {
      this.trail[base + k * 2] = this.trail[base + (k - 1) * 2];
      this.trail[base + k * 2 + 1] = this.trail[base + (k - 1) * 2 + 1];
    }
    this.trail[base] = lng;
    this.trail[base + 1] = lat;
  }

  private draw() {
    const trails: GeoJSON.Feature[] = [];
    const heads: GeoJSON.Feature[] = [];
    for (let i = 0; i < this.n; i++) {
      const len = this.tlen[i];
      if (!len) continue;
      const base = i * T * 2;
      const fade = Math.min(1, this.age[i] / 1.5, (this.life[i] - this.age[i]) / 2);
      heads.push({ type: "Feature", properties: { o: fade, s: this.still[i] }, geometry: { type: "Point", coordinates: [this.trail[base], this.trail[base + 1]] } });
      if (len >= 2 && !this.still[i]) {
        const coords: number[][] = [];
        for (let k = len - 1; k >= 0; k--) coords.push([this.trail[base + k * 2], this.trail[base + k * 2 + 1]]);
        trails.push({ type: "Feature", properties: { o: fade }, geometry: { type: "LineString", coordinates: coords } });
      }
    }
    (this.map.getSource("t-water-trail") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: trails });
    (this.map.getSource("t-water-head") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: heads });
  }
}
