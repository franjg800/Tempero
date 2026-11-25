// Suelo: clase textural USDA y retención de agua (Saxton y Rawls, 2006), igual que en Brote.
export const TEXTURES: { id: string; sand: number; clay: number; infil: number; wetR: number }[] = [
  // infil: velocidad de infiltración básica orientativa (mm/h); wetR: radio mojado orientativo de un gotero de 4 L/h (m)
  { id: "Arenoso", sand: 90, clay: 5, infil: 30, wetR: 0.3 },
  { id: "Arenoso franco", sand: 82, clay: 8, infil: 25, wetR: 0.35 },
  { id: "Franco arenoso", sand: 65, clay: 12, infil: 20, wetR: 0.45 },
  { id: "Franco", sand: 42, clay: 20, infil: 13, wetR: 0.55 },
  { id: "Franco limoso", sand: 20, clay: 15, infil: 10, wetR: 0.6 },
  { id: "Limoso", sand: 8, clay: 6, infil: 8, wetR: 0.6 },
  { id: "Franco arcillo arenoso", sand: 58, clay: 27, infil: 10, wetR: 0.6 },
  { id: "Franco arcilloso", sand: 33, clay: 33, infil: 8, wetR: 0.7 },
  { id: "Franco arcillo limoso", sand: 10, clay: 33, infil: 7, wetR: 0.7 },
  { id: "Arcillo arenoso", sand: 52, clay: 42, infil: 6, wetR: 0.75 },
  { id: "Arcillo limoso", sand: 7, clay: 47, infil: 5, wetR: 0.8 },
  { id: "Arcilloso", sand: 20, clay: 55, infil: 4, wetR: 0.8 },
];

// Equivalencias con los nombres de la primera versión
const LEGACY: Record<string, string> = {
  arenoso: "Arenoso", "franco-arenoso": "Franco arenoso", franco: "Franco", "franco-limoso": "Franco limoso",
  "franco-arcilloso": "Franco arcilloso", arcilloso: "Arcilloso",
};

export const textureOf = (id: string) => TEXTURES.find((t) => t.id === (LEGACY[id] ?? id)) ?? TEXTURES[3];

export type SoilProps = { tex: string; fc: number; wp: number; awc: number; om: number; infil: number; wetR: number };

/** Capacidad de campo, punto de marchitez y agua útil (mm por metro) a partir de arena, arcilla y materia orgánica. */
export function soilProps(texId: string, omPct: number | null): SoilProps {
  const t = textureOf(texId);
  const S = t.sand / 100, C = t.clay / 100, OM = Math.min(8, Math.max(0.2, omPct ?? 1.5));
  const t15 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031;
  const wp = t15 + (0.14 * t15 - 0.02);
  const t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299;
  const fc = t33 + (1.283 * t33 * t33 - 0.374 * t33 - 0.015);
  return { tex: t.id, fc, wp, awc: Math.max(20, (fc - wp) * 1000), om: OM, infil: t.infil, wetR: t.wetR };
}
