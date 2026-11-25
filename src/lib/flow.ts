// Animación del agua: partículas que bajan por el terreno siguiendo la dirección de máxima pendiente,
// se aceleran en las vaguadas y se quedan quietas en las zonas que se encharcan.
// Todo en coordenadas de la rejilla del MDT; quien dibuja decide cómo pintarlas.
import type { Dem } from "./dem";
import type { Hydro } from "./hydro";

export const TRAIL = 8; // puntos de estela
export const TIME_SCALE = 60; // 1 s de animación = 1 min real

export class WaterSim {
  readonly n: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly still: Uint8Array;
  readonly trail: Float32Array; // n · TRAIL · 2 (rejilla)
  readonly tlen: Uint8Array;
  private tclock: Float32Array;
  private source: [number, number] | null = null;
  pooled = 0;

  constructor(
    private d: Dem,
    private hy: Hydro,
    private spawn: Int32Array, // celdas donde cae la lluvia
    n: number,
    private inside: (gx: number, gy: number) => boolean = () => true, // fuera de la maqueta el agua desaparece
  ) {
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.still = new Uint8Array(n);
    this.trail = new Float32Array(n * TRAIL * 2);
    this.tlen = new Uint8Array(n);
    this.tclock = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.respawn(i);
      this.age[i] = Math.random() * this.life[i];
    }
  }

  /** Punto de riego en coordenadas de rejilla (boca, hidrante, cabecera): el agua sale de ahí en vez de llover. */
  setSource(grid: [number, number] | null) {
    this.source = grid;
    for (let i = 0; i < this.n; i++) {
      this.respawn(i);
      this.age[i] = Math.random() * this.life[i] * (grid ? 1 : 0.6);
    }
  }

  private respawn(i: number) {
    const { w, h } = this.d;
    let cx: number, cy: number;
    if (this.source) {
      const r = Math.random() * 2.5, a = Math.random() * Math.PI * 2;
      cx = this.source[0] + Math.cos(a) * r;
      cy = this.source[1] + Math.sin(a) * r;
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
    this.tclock[i] = 0;
  }

  step(dt: number) {
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
      if (cx < 0 || cy < 0 || cx >= w || cy >= h || Number.isNaN(this.d.z[cy * w + cx]) || !this.inside(this.x[i], this.y[i])) {
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
        this.age[i] -= dt * 0.8;
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
    const base = i * TRAIL * 2;
    const len = this.tlen[i];
    if (len < TRAIL) this.tlen[i] = len + 1;
    for (let k = Math.min(len, TRAIL - 1); k > 0; k--) {
      this.trail[base + k * 2] = this.trail[base + (k - 1) * 2];
      this.trail[base + k * 2 + 1] = this.trail[base + (k - 1) * 2 + 1];
    }
    this.trail[base] = this.x[i];
    this.trail[base + 1] = this.y[i];
  }

  /** Opacidad de la partícula: aparece y se apaga suavemente. */
  fade(i: number) {
    return Math.max(0, Math.min(1, this.age[i] / 1.5, (this.life[i] - this.age[i]) / 2));
  }
}
