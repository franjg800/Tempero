import type { IrrigationSystem } from "./types";

export const IRRIGATION: { id: IrrigationSystem; name: string; eff: number }[] = [
  { id: "secano", name: "Secano", eff: 1 },
  { id: "goteo", name: "Goteo", eff: 0.9 },
  { id: "microaspersion", name: "Microaspersión", eff: 0.85 },
  { id: "aspersion", name: "Aspersión", eff: 0.75 },
  { id: "pivot", name: "Pívot", eff: 0.8 },
  { id: "gravedad", name: "Gravedad / surcos", eff: 0.6 },
];

// Usos SIGPAC
export const USOS_SIGPAC: Record<string, string> = {
  TA: "Tierra arable", TH: "Huerta", OV: "Olivar", VI: "Viñedo", FY: "Frutales", FS: "Frutos secos",
  FL: "Frutos secos y olivar", FV: "Frutal y viñedo", OF: "Olivar y frutal", VO: "Viñedo y olivar",
  CI: "Cítricos", PA: "Pasto arbolado", PR: "Pasto arbustivo", PS: "Pastizal", IV: "Invernadero",
  FO: "Forestal", IM: "Improductivo", ZU: "Zona urbana", CA: "Viales", AG: "Agua", ED: "Edificaciones",
  ZC: "Zona concentrada", TC: "Tierra arable y cultivos permanentes", OC: "Olivar y cítricos", CF: "Cítricos y frutal",
  CS: "Cítricos y frutos secos", FF: "Frutos secos y frutal", VF: "Viñedo y frutal",
};
