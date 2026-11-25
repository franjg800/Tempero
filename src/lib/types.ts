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

export type IrrigationSystem =
  | "secano"
  | "goteo"
  | "microaspersion"
  | "aspersion"
  | "pivot"
  | "gravedad";

export type SoilTexture =
  | "arenoso"
  | "franco-arenoso"
  | "franco"
  | "franco-limoso"
  | "franco-arcilloso"
  | "arcilloso";

export type Irrigation = {
  system: IrrigationSystem;
  efficiency: number; // 0-1
  emitterFlowLh: number; // goteo: caudal por gotero
  emitterSpacingM: number; // goteo: separación entre goteros
  lineSpacingM: number; // goteo: separación entre ramales
  rateMmH: number; // aspersión, pívot…: pluviometría del sistema
  waterNitrateMgL: number; // nitratos en el agua de riego
  seasonVolumeM3Ha: number; // volumen de riego previsto por campaña
};

export type SoilAnalysis = {
  nMinKgHa: number | null; // N mineral en el perfil al inicio
  pOlsenPpm: number | null;
  kPpm: number | null;
  organicMatterPct: number | null;
};

export type FertPlan = {
  yieldT: number; // rendimiento objetivo (t/ha)
  prevLegume: boolean; // cultivo anterior leguminosa
  organicNKgHa: number; // N de estiércoles u orgánicos previstos
  extraNKgHa: number; // otros aportes que quiera descontar
  overrides: { n?: number; p?: number; k?: number }; // extracciones por t editadas
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
  cropId: string;
  variety: string;
  soil: SoilTexture;
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
  date: string; // AAAA-MM-DD
  parcelIds: string[];
  status: "hecho" | "pendiente";
  data: Record<string, string>;
  createdAt: string;
};

export type Farm = {
  name: string;
  holder: string;
  nif: string;
  rea: string; // nº de registro de explotación
  campaign: string;
  advisor: string;
};

export type ParcelFeature = Feature<Polygon | MultiPolygon, { id: string; name: string; color: string; selected: boolean }>;
