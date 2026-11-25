// Catálogo de cultivos. Todos los valores son ORIENTATIVOS y se pueden ajustar en cada parcela.
// Kc mensual (enero → diciembre) simplificado a partir de FAO-56 para condiciones de España.
// Extracciones en kg por tonelada de cosecha (incluye restos cuando es lo habitual en las guías).

export type Fraction = { label: string; share: number; month: number }; // month: 0 = enero

export type Crop = {
  id: string;
  name: string;
  group: "cereal" | "extensivo" | "lenoso" | "horticola" | "forrajero" | "otro";
  color: string;
  kc: number[]; // 12 valores; 0 = sin cultivo ese mes
  rootM: number; // profundidad radicular efectiva
  p: number; // fracción de agotamiento admisible (FAO-56)
  ext: { n: number; p: number; k: number }; // kg/t de N, P2O5 y K2O
  yieldT: number; // rendimiento orientativo t/ha
  unit: string; // unidad del rendimiento
  legume?: boolean;
  fractions: Fraction[];
};

export const CROPS: Crop[] = [
  {
    id: "trigo", name: "Trigo", group: "cereal", color: "#D9A21B",
    kc: [0.5, 0.7, 1.0, 1.15, 1.1, 0.45, 0, 0, 0, 0, 0.35, 0.4], rootM: 1.0, p: 0.55,
    ext: { n: 28, p: 11, k: 22 }, yieldT: 4, unit: "t grano/ha",
    fractions: [
      { label: "Fondo · siembra", share: 0.3, month: 10 },
      { label: "Cobertera · ahijado", share: 0.4, month: 0 },
      { label: "Cobertera · encañado", share: 0.3, month: 2 },
    ],
  },
  {
    id: "cebada", name: "Cebada", group: "cereal", color: "#E0B85A",
    kc: [0.5, 0.75, 1.05, 1.15, 0.9, 0.3, 0, 0, 0, 0, 0.35, 0.4], rootM: 1.0, p: 0.55,
    ext: { n: 24, p: 10, k: 22 }, yieldT: 4, unit: "t grano/ha",
    fractions: [
      { label: "Fondo · siembra", share: 0.35, month: 10 },
      { label: "Cobertera · ahijado", share: 0.65, month: 1 },
    ],
  },
  {
    id: "avena", name: "Avena", group: "cereal", color: "#C9B27A",
    kc: [0.5, 0.7, 1.0, 1.1, 1.0, 0.4, 0, 0, 0, 0, 0.35, 0.4], rootM: 1.0, p: 0.55,
    ext: { n: 25, p: 10, k: 25 }, yieldT: 3, unit: "t grano/ha",
    fractions: [
      { label: "Fondo · siembra", share: 0.35, month: 10 },
      { label: "Cobertera · ahijado", share: 0.65, month: 1 },
    ],
  },
  {
    id: "maiz", name: "Maíz", group: "extensivo", color: "#1E6AA0",
    kc: [0, 0, 0, 0.3, 0.5, 0.9, 1.15, 1.15, 0.8, 0.4, 0, 0], rootM: 1.2, p: 0.55,
    ext: { n: 25, p: 10, k: 22 }, yieldT: 12, unit: "t grano/ha",
    fractions: [
      { label: "Fondo · siembra", share: 0.3, month: 3 },
      { label: "Cobertera · 6-8 hojas", share: 0.7, month: 5 },
    ],
  },
  {
    id: "girasol", name: "Girasol", group: "extensivo", color: "#E6C229",
    kc: [0, 0, 0, 0.3, 0.6, 1.0, 1.05, 0.6, 0, 0, 0, 0], rootM: 1.3, p: 0.6,
    ext: { n: 45, p: 18, k: 70 }, yieldT: 2, unit: "t pipa/ha",
    fractions: [{ label: "Fondo · siembra", share: 1, month: 2 }],
  },
  {
    id: "olivar", name: "Olivar", group: "lenoso", color: "#2E5B3B",
    kc: [0.5, 0.5, 0.65, 0.6, 0.55, 0.5, 0.45, 0.45, 0.55, 0.6, 0.65, 0.5], rootM: 1.2, p: 0.65,
    ext: { n: 18, p: 4, k: 22 }, yieldT: 6, unit: "t aceituna/ha",
    fractions: [
      { label: "Prebrotación", share: 0.5, month: 1 },
      { label: "Primavera", share: 0.5, month: 3 },
    ],
  },
  {
    id: "vinedo", name: "Viñedo", group: "lenoso", color: "#7B3F61",
    kc: [0, 0, 0.2, 0.3, 0.5, 0.65, 0.7, 0.65, 0.45, 0.3, 0, 0], rootM: 1.2, p: 0.45,
    ext: { n: 7, p: 3, k: 9 }, yieldT: 8, unit: "t uva/ha",
    fractions: [
      { label: "Brotación", share: 0.6, month: 3 },
      { label: "Cuajado", share: 0.4, month: 5 },
    ],
  },
  {
    id: "almendro", name: "Almendro", group: "lenoso", color: "#8C6A4A",
    kc: [0.4, 0.45, 0.55, 0.75, 0.9, 0.95, 0.95, 0.9, 0.75, 0.6, 0.45, 0.4], rootM: 1.2, p: 0.5,
    ext: { n: 65, p: 20, k: 70 }, yieldT: 1.2, unit: "t pepita/ha",
    fractions: [
      { label: "Floración", share: 0.4, month: 1 },
      { label: "Crecimiento del fruto", share: 0.4, month: 3 },
      { label: "Poscosecha", share: 0.2, month: 8 },
    ],
  },
  {
    id: "alfalfa", name: "Alfalfa", group: "forrajero", color: "#4F8A3A", legume: true,
    kc: [0.4, 0.5, 0.7, 0.9, 0.95, 0.95, 0.95, 0.95, 0.9, 0.7, 0.5, 0.4], rootM: 1.5, p: 0.55,
    ext: { n: 0, p: 6, k: 25 }, yieldT: 12, unit: "t MS/ha",
    fractions: [{ label: "Invierno (P y K)", share: 1, month: 0 }],
  },
  {
    id: "patata", name: "Patata", group: "horticola", color: "#B07A3B",
    kc: [0, 0, 0.5, 0.75, 1.1, 1.1, 0.75, 0, 0, 0, 0, 0], rootM: 0.5, p: 0.35,
    ext: { n: 4.5, p: 1.8, k: 8 }, yieldT: 40, unit: "t/ha",
    fractions: [
      { label: "Fondo · plantación", share: 0.5, month: 2 },
      { label: "Cobertera · aporcado", share: 0.5, month: 4 },
    ],
  },
  {
    id: "tomate", name: "Tomate de industria", group: "horticola", color: "#C2412D",
    kc: [0, 0, 0, 0.6, 0.8, 1.15, 1.15, 0.8, 0, 0, 0, 0], rootM: 0.8, p: 0.4,
    ext: { n: 2.8, p: 1, k: 4.5 }, yieldT: 90, unit: "t/ha",
    fractions: [
      { label: "Fondo · trasplante", share: 0.3, month: 3 },
      { label: "Fertirrigación", share: 0.7, month: 5 },
    ],
  },
  {
    id: "cebolla", name: "Cebolla", group: "horticola", color: "#A6668C",
    kc: [0.7, 0.8, 0.9, 1.0, 1.05, 0.9, 0.75, 0, 0, 0, 0, 0.6], rootM: 0.4, p: 0.3,
    ext: { n: 3, p: 1.3, k: 3.8 }, yieldT: 60, unit: "t/ha",
    fractions: [
      { label: "Fondo", share: 0.4, month: 11 },
      { label: "Cobertera", share: 0.6, month: 3 },
    ],
  },
  {
    id: "lechuga", name: "Lechuga", group: "horticola", color: "#7FA36E",
    kc: [0.9, 0.95, 0.9, 0, 0, 0, 0, 0, 0, 0.7, 0.85, 0.9], rootM: 0.3, p: 0.3,
    ext: { n: 2.5, p: 1, k: 5 }, yieldT: 40, unit: "t/ha",
    fractions: [
      { label: "Fondo", share: 0.5, month: 9 },
      { label: "Cobertera", share: 0.5, month: 10 },
    ],
  },
  {
    id: "barbecho", name: "Barbecho", group: "otro", color: "#B8B5A8",
    kc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], rootM: 0.5, p: 0.5,
    ext: { n: 0, p: 0, k: 0 }, yieldT: 0, unit: "—",
    fractions: [],
  },
];

export const cropById = (id: string): Crop => CROPS.find((c) => c.id === id) ?? CROPS[CROPS.length - 1];

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Agua útil (mm por metro de suelo) según textura. Orientativo.
export const SOILS: { id: import("./types").SoilTexture; name: string; awMmM: number }[] = [
  { id: "arenoso", name: "Arenoso", awMmM: 70 },
  { id: "franco-arenoso", name: "Franco-arenoso", awMmM: 110 },
  { id: "franco", name: "Franco", awMmM: 160 },
  { id: "franco-limoso", name: "Franco-limoso", awMmM: 180 },
  { id: "franco-arcilloso", name: "Franco-arcilloso", awMmM: 170 },
  { id: "arcilloso", name: "Arcilloso", awMmM: 160 },
];

export const IRRIGATION: { id: import("./types").IrrigationSystem; name: string; eff: number }[] = [
  { id: "secano", name: "Secano", eff: 1 },
  { id: "goteo", name: "Goteo", eff: 0.9 },
  { id: "microaspersion", name: "Microaspersión", eff: 0.85 },
  { id: "aspersion", name: "Aspersión", eff: 0.75 },
  { id: "pivot", name: "Pívot", eff: 0.8 },
  { id: "gravedad", name: "Gravedad / surcos", eff: 0.6 },
];

// Usos SIGPAC más habituales
export const USOS_SIGPAC: Record<string, string> = {
  TA: "Tierra arable", TH: "Huerta", OV: "Olivar", VI: "Viñedo", FY: "Frutales", FS: "Frutos secos",
  FL: "Frutos secos y olivar", FV: "Frutales y viñedo", OF: "Olivar y frutales", VO: "Viñedo y olivar",
  CI: "Cítricos", PA: "Pasto arbolado", PR: "Pasto arbustivo", PS: "Pastizal", IV: "Invernadero",
  FO: "Forestal", IM: "Improductivo", ZU: "Zona urbana", CA: "Viales", AG: "Agua", ED: "Edificaciones",
  ZC: "Zona concentrada", TC: "Tierra arable y cultivos permanentes",
};

export function cropFromUso(uso: string | null): string {
  switch (uso) {
    case "OV": return "olivar";
    case "VI": return "vinedo";
    case "FS": return "almendro";
    case "TH": return "tomate";
    default: return "trigo";
  }
}
