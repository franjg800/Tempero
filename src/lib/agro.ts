// Datos agronómicos por cultivo, los mismos que usa Brote (data/agro.js):
// k: Kc [inicial, medio, final] y L: etapas en días (FAO-56, tablas 11 y 12); kcm: Kc mensual de leñosos;
// h: altura (m); zr: profundidad radicular [mín, máx] (m); p: fracción de agotamiento (FAO-56 tabla 22);
// y: rendimiento de referencia (t/ha); rec: dosis orientativa [N, P2O5, K2O] kg/ha para ese rendimiento
// (Guía práctica de la fertilización racional, MAPA); sp: marco [entre líneas, entre plantas] (m); sow: mes de siembra.
import AGRO_JSON from "@/data/agro.json";

export type Agro = {
  k?: [number, number, number];
  L?: [number, number, number, number];
  kcm?: number[];
  h: number;
  zr: [number, number];
  p: number;
  y: number;
  rec: [number, number, number];
  sp: [number, number];
  sow?: number;
  bud?: number;
  ev?: number;
  seed?: number;
  fix?: number;
  note?: string;
};

export const AGRO = AGRO_JSON as unknown as Record<string, Agro>;

export type Group = "Cereales" | "Leguminosas" | "Industriales y forrajeros" | "Hortícolas" | "Cucurbitáceas" | "Frutales y leñosos";

// Nombre común, grupo, color en el mapa y tolerancia a la salinidad (CEe umbral y pendiente de pérdida, FAO 29, Ayers y Westcot; orientativo)
const META: Record<string, [string, Group, string, number?, number?]> = {
  "triticum-aestivum": ["Trigo", "Cereales", "#D9A21B", 6.0, 7.1],
  "hordeum-vulgare": ["Cebada", "Cereales", "#E0B85A", 8.0, 5.0],
  "avena-sativa": ["Avena", "Cereales", "#C9B27A", 5.0, 7.0],
  "secale-cereale": ["Centeno", "Cereales", "#B89B5E", 6.0, 7.0],
  "oryza-sativa": ["Arroz", "Cereales", "#8FB98A", 3.0, 12],
  "zea-mays": ["Maíz", "Cereales", "#3E86B8", 1.7, 12],
  "chenopodium-quinoa": ["Quinoa", "Cereales", "#C98A5A"],
  "cicer-arietinum": ["Garbanzo", "Leguminosas", "#B5A36A"],
  "lens-culinaris": ["Lenteja", "Leguminosas", "#A8925C"],
  "glycine-max": ["Soja", "Leguminosas", "#7FA36E", 5.0, 20],
  "arachis-hypogaea": ["Cacahuete", "Leguminosas", "#C09060", 3.2, 29],
  "vicia-faba": ["Haba", "Leguminosas", "#6E9B5B", 1.6, 9.6],
  "phaseolus-vulgaris": ["Judía", "Leguminosas", "#5FA35B", 1.0, 19],
  "pisum-sativum": ["Guisante", "Leguminosas", "#79B06A"],
  "helianthus-annuus": ["Girasol", "Industriales y forrajeros", "#E6C229"],
  "beta-vulgaris": ["Remolacha azucarera", "Industriales y forrajeros", "#A6668C", 7.0, 5.9],
  "medicago-sativa": ["Alfalfa", "Industriales y forrajeros", "#4F8A3A", 2.0, 7.3],
  "solanum-lycopersicum": ["Tomate", "Hortícolas", "#C2412D", 2.5, 9.9],
  "capsicum-annuum": ["Pimiento", "Hortícolas", "#C9502E", 1.5, 14],
  "solanum-melongena": ["Berenjena", "Hortícolas", "#6B4C7A", 1.1, 6.9],
  "solanum-tuberosum": ["Patata", "Hortícolas", "#B07A3B", 1.7, 12],
  "lactuca-sativa": ["Lechuga", "Hortícolas", "#7FB86E", 1.3, 13],
  "spinacia-oleracea": ["Espinaca", "Hortícolas", "#3E7F4A", 2.0, 7.6],
  "beta-vulgaris-subsp-vulgaris": ["Acelga", "Hortícolas", "#5E9A5B"],
  "daucus-carota": ["Zanahoria", "Hortícolas", "#E07B2E", 1.0, 14],
  "allium-cepa": ["Cebolla", "Hortícolas", "#A6668C", 1.2, 16],
  "allium-sativum": ["Ajo", "Hortícolas", "#C8B9A0"],
  "allium-porrum": ["Puerro", "Hortícolas", "#8DB37A"],
  "brassica-oleracea-var-capitata": ["Col", "Hortícolas", "#6FA0A0", 1.8, 9.7],
  "brassica-oleracea-var-italica": ["Brócoli", "Hortícolas", "#4E8A6A", 2.8, 9.2],
  "brassica-oleracea-var-botrytis": ["Coliflor", "Hortícolas", "#BFC9A8"],
  "cynara-cardunculus-var-scolymus": ["Alcachofa", "Hortícolas", "#7A9A70"],
  "raphanus-sativus": ["Rábano", "Hortícolas", "#C24B6A", 1.2, 13],
  "apium-graveolens": ["Apio", "Hortícolas", "#9CC48A", 1.8, 6.2],
  "asparagus-officinalis": ["Espárrago", "Hortícolas", "#7FA35A", 4.1, 2.0],
  "fragaria-ananassa": ["Fresa", "Hortícolas", "#D2433F", 1.0, 33],
  "cucurbita-pepo": ["Calabacín", "Cucurbitáceas", "#6E9F4E", 4.7, 9.4],
  "cucurbita-maxima": ["Calabaza", "Cucurbitáceas", "#D98A2B"],
  "cucumis-sativus": ["Pepino", "Cucurbitáceas", "#5D9C5A", 2.5, 13],
  "cucumis-melo": ["Melón", "Cucurbitáceas", "#C7B85A", 1.0, 8.4],
  "citrullus-lanatus": ["Sandía", "Cucurbitáceas", "#4F8B4C"],
  "olea-europaea": ["Olivo", "Frutales y leñosos", "#2E5B3B", 4.0, 7.0],
  "vitis-vinifera": ["Vid", "Frutales y leñosos", "#7B3F61", 1.5, 9.6],
  "prunus-dulcis": ["Almendro", "Frutales y leñosos", "#8C6A4A", 1.5, 19],
  "pistacia-vera": ["Pistachero", "Frutales y leñosos", "#93A35A"],
  "juglans-regia": ["Nogal", "Frutales y leñosos", "#5A4A3A"],
  "corylus-avellana": ["Avellano", "Frutales y leñosos", "#8A6A48"],
  "castanea-sativa": ["Castaño", "Frutales y leñosos", "#6E4B32"],
  "citrus-sinensis": ["Naranjo", "Frutales y leñosos", "#E0892B", 1.7, 16],
  "citrus-limon": ["Limonero", "Frutales y leñosos", "#D9C23A", 1.5, 16],
  "citrus-reticulata": ["Mandarino", "Frutales y leñosos", "#E07A2B", 1.7, 16],
  "malus-domestica": ["Manzano", "Frutales y leñosos", "#B94A4A", 1.7, 16],
  "pyrus-communis": ["Peral", "Frutales y leñosos", "#A7A04A", 1.7, 16],
  "cydonia-oblonga": ["Membrillero", "Frutales y leñosos", "#C9A83A"],
  "prunus-persica": ["Melocotonero", "Frutales y leñosos", "#E0866A", 1.7, 21],
  "prunus-armeniaca": ["Albaricoquero", "Frutales y leñosos", "#E09A4A", 1.6, 24],
  "prunus-avium": ["Cerezo", "Frutales y leñosos", "#A8323C"],
  "prunus-domestica": ["Ciruelo", "Frutales y leñosos", "#6A3E6E", 1.5, 18],
  "ficus-carica": ["Higuera", "Frutales y leñosos", "#6E7A4A"],
  "punica-granatum": ["Granado", "Frutales y leñosos", "#B4383A"],
  "diospyros-kaki": ["Caqui", "Frutales y leñosos", "#D9772B"],
  "eriobotrya-japonica": ["Níspero", "Frutales y leñosos", "#D9A04A"],
  "persea-americana": ["Aguacate", "Frutales y leñosos", "#4A6A3A"],
  "annona-cherimola": ["Chirimoyo", "Frutales y leñosos", "#7FA36E"],
  "mangifera-indica": ["Mango", "Frutales y leñosos", "#E0A43A"],
  "actinidia-deliciosa": ["Kiwi", "Frutales y leñosos", "#7A8A3A"],
  "vaccinium-corymbosum": ["Arándano", "Frutales y leñosos", "#4A5A9A"],
  "rubus-idaeus": ["Frambueso", "Frutales y leñosos", "#B0324A"],
  "phoenix-dactylifera": ["Palmera datilera", "Frutales y leñosos", "#A88A4A"],
  "ceratonia-siliqua": ["Algarrobo", "Frutales y leñosos", "#5A4A30"],
  "musa-acuminata": ["Platanera", "Frutales y leñosos", "#C9C03A"],
  "feijoa-sellowiana": ["Feijoa", "Frutales y leñosos", "#6A8A5A"],
};

export type Crop = {
  id: string;
  name: string;
  group: Group | "Sin cultivo";
  color: string;
  agro: Agro | null;
  woody: boolean;
  legume: boolean;
  unit: string;
  salt?: { thr: number; slope: number; max: number };
};

export const BARBECHO: Crop = { id: "barbecho", name: "Barbecho", group: "Sin cultivo", color: "#B8B5A8", agro: null, woody: false, legume: false, unit: "—" };

export const CROPS: Crop[] = [
  ...Object.entries(META).map(([id, [name, group, color, thr, slope]]) => {
    const a = AGRO[id];
    const woody = !!a?.kcm && id !== "medicago-sativa";
    const unit = id === "prunus-dulcis" ? "t pepita/ha" : id === "medicago-sativa" ? "t MS/ha" : group === "Cereales" || group === "Leguminosas" ? "t grano/ha" : "t/ha";
    return {
      id, name, group, color, agro: a ?? null, woody, legume: !!a?.fix, unit,
      salt: thr != null && slope ? { thr, slope, max: thr + 100 / slope } : undefined,
    } as Crop;
  }),
  BARBECHO,
];

export const GROUPS: (Group | "Sin cultivo")[] = ["Cereales", "Leguminosas", "Industriales y forrajeros", "Hortícolas", "Cucurbitáceas", "Frutales y leñosos", "Sin cultivo"];

export const cropById = (id: string): Crop => CROPS.find((c) => c.id === id) ?? BARBECHO;

// Equivalencias con la primera versión de Tempero (identificadores antiguos)
export const LEGACY: Record<string, string> = {
  trigo: "triticum-aestivum", cebada: "hordeum-vulgare", avena: "avena-sativa", maiz: "zea-mays", girasol: "helianthus-annuus",
  olivar: "olea-europaea", vinedo: "vitis-vinifera", almendro: "prunus-dulcis", alfalfa: "medicago-sativa", patata: "solanum-tuberosum",
  tomate: "solanum-lycopersicum", cebolla: "allium-cepa", lechuga: "lactuca-sativa", barbecho: "barbecho",
};

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MON3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Reparto orientativo del N en fracciones (mes absoluto 0-11), según el tipo de cultivo y su siembra o brotación. */
export function nFractions(c: Crop, sowMonth: number): { label: string; share: number; month: number }[] {
  const m = (x: number) => ((x % 12) + 12) % 12;
  if (!c.agro || c.legume) return [];
  if (c.woody) {
    const b = (c.agro.bud ?? 3) - 1;
    return [
      { label: "Prebrotación", share: 0.4, month: m(b - 1) },
      { label: "Cuajado y crecimiento del fruto", share: 0.4, month: m(b + 2) },
      { label: "Poscosecha", share: 0.2, month: m(b + 6) },
    ];
  }
  if (c.group === "Cereales" && c.id !== "zea-mays" && c.id !== "oryza-sativa")
    return [
      { label: "Fondo · siembra", share: 0.3, month: m(sowMonth) },
      { label: "Cobertera · ahijado", share: 0.4, month: m(sowMonth + 2) },
      { label: "Cobertera · encañado", share: 0.3, month: m(sowMonth + 4) },
    ];
  if (c.id === "zea-mays")
    return [
      { label: "Fondo · siembra", share: 0.3, month: m(sowMonth) },
      { label: "Cobertera · 6-8 hojas", share: 0.7, month: m(sowMonth + 2) },
    ];
  return [
    { label: "Fondo · siembra o trasplante", share: 0.3, month: m(sowMonth) },
    { label: "Cobertera 1", share: 0.35, month: m(sowMonth + 1) },
    { label: "Cobertera 2", share: 0.35, month: m(sowMonth + 2) },
  ];
}

export function cropFromUso(uso: string | null): string {
  switch (uso) {
    case "OV": return "olea-europaea";
    case "VI": return "vitis-vinifera";
    case "FS": return "prunus-dulcis";
    case "CI": return "citrus-sinensis";
    case "FY": return "prunus-persica";
    case "TH": return "solanum-lycopersicum";
    default: return "triticum-aestivum";
  }
}
