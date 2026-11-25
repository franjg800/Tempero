// Colores de la maqueta: rampa de cotas y clases de pendiente (agronómicas)
export type Base = "orto" | "cotas" | "pendientes";
export const SLOPE_CLASSES: [number, string, string][] = [
  [1, "#E9F1DC", "< 1 %"],
  [2, "#BFDCA0", "1–2 %"],
  [5, "#F0D27C", "2–5 %"],
  [10, "#E69A55", "5–10 %"],
  [20, "#C9583A", "10–20 %"],
  [Infinity, "#7D2B1F", "> 20 %"],
];
const RAMP: [number, [number, number, number]][] = [
  [0, [47, 111, 166]], [0.18, [79, 163, 160]], [0.38, [140, 192, 132]], [0.58, [232, 215, 122]], [0.8, [209, 143, 78]], [1, [138, 75, 44]],
];
export function rampColor(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++)
    if (t <= RAMP[i][0]) {
      const [t0, a] = RAMP[i - 1], [t1, b] = RAMP[i];
      const k = (t - t0) / (t1 - t0);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  return RAMP[RAMP.length - 1][1];
}

