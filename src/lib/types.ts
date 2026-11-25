import type { Feature, MultiPolygon, Polygon } from "geojson";

export type SigpacRef = {
  provincia: number;
  municipio: number;
  agregado: number;
  zona: number;
  poligono: number;
  parcela: number;
  recinto: number;
};

export type IrrigationSystem = "secano" | "goteo" | "microaspersion" | "aspersion" | "pivot" | "gravedad";

export type Irrigation = {
  system: IrrigationSystem;
  efficiency: number; // eficiencia de aplicación 0-1
  emitterFlowLh: number; // goteo: caudal nominal del gotero (L/h)
  emitterSpacingM: number; // goteo: separación entre goteros en el lateral (m)
  lateralsPerRow: number; // goteo: laterales por línea de plantas
  emittersPerPlant: number | null; // leñosos: goteros por árbol (null = los calcula Tempero)
  wetPct: number | null; // leñosos: % mínimo de superficie mojada (null = 25 %)
  cu: number; // coeficiente de uniformidad 0-1
  ceWater: number; // conductividad eléctrica del agua de riego (dS/m)
  hoursPerDay: number; // horas de riego disponibles al día
  rateMmH: number; // aspersión, pívot…: pluviometría del sistema (mm/h)
  waterNitrateMgL: number; // nitratos del agua de riego (mg/L)
  seasonVolumeM3Ha: number; // volumen de riego por campaña (0 = el calculado)
};

export type SoilAnalysis = {
  nMinKgHa: number | null;
  pOlsenPpm: number | null;
  kPpm: number | null;
  organicMatterPct: number | null;
};

export type FertPlan = {
  yieldT: number;
  prevLegume: boolean;
  organicNKgHa: number;
  extraNKgHa: number;
  overrides: { n?: number; p?: number; k?: number }; // kg por t de cosecha
};

export type Parcel = {
  id: string;
  name: string;
  sigpac: SigpacRef | null;
  usoSigpac: string | null;
  geometry: Polygon | MultiPolygon;
  areaHa: number;
  slopePct: number | null;
  altitudeM: number | null;
  cropId: string; // identificador científico (mismos datos que Brote)
  variety: string;
  sowDate: string | null; // siembra o trasplante (anuales)
  spacing: [number, number]; // marco: entre líneas, entre plantas (m)
  coverPct: number; // leñosos: cobertura del suelo por la copa (%)
  soil: string; // clase textural USDA
  vulnerable: boolean;
  irrigation: Irrigation;
  analysis: SoilAnalysis;
  fert: FertPlan;
  color?: string;
  createdAt: string;
};

export type EntryType = "tratamiento" | "fertilizacion" | "riego" | "labor" | "cosecha";

export type Entry = {
  id: string;
  type: EntryType;
  date: string;
  parcelIds: string[];
  status: "hecho" | "pendiente";
  data: Record<string, string>;
  createdAt: string;
};

export type Farm = {
  name: string;
  holder: string;
  nif: string;
  rea: string;
  campaign: string;
  advisor: string;
};

export type ParcelFeature = Feature<Polygon | MultiPolygon, { id: string; name: string; color: string; selected: boolean }>;
