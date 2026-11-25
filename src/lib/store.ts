"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Entry, Farm, Parcel } from "./types";
import { cropById, LEGACY } from "./agro";

export const DEFAULT_IRRIGATION: Parcel["irrigation"] = {
  system: "secano",
  efficiency: 1,
  emitterFlowLh: 2.2,
  emitterSpacingM: 0.5,
  lateralsPerRow: 1,
  emittersPerPlant: null,
  wetPct: null,
  cu: 0.9,
  ceWater: 1,
  hoursPerDay: 20,
  rateMmH: 6,
  waterNitrateMgL: 0,
  seasonVolumeM3Ha: 0,
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type State = {
  farm: Farm;
  parcels: Parcel[];
  entries: Entry[];
  selectedId: string | null;
  mapView: { center: [number, number]; zoom: number } | null;
  setFarm: (f: Partial<Farm>) => void;
  addParcel: (p: Parcel) => void;
  updateParcel: (id: string, patch: Partial<Parcel>) => void;
  removeParcel: (id: string) => void;
  select: (id: string | null) => void;
  addEntry: (e: Omit<Entry, "id" | "createdAt">) => string;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  removeEntry: (id: string) => void;
  setMapView: (v: { center: [number, number]; zoom: number }) => void;
  importAll: (data: { farm: Farm; parcels: Parcel[]; entries: Entry[] }) => void;
  reset: () => void;
};

const defaultFarm: Farm = { name: "Mi explotación", holder: "", nif: "", rea: "", campaign: campaignNow(), advisor: "" };

export function campaignNow(d = new Date()) {
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      farm: defaultFarm,
      parcels: [],
      entries: [],
      selectedId: null,
      mapView: null,
      setFarm: (f) => set((s) => ({ farm: { ...s.farm, ...f } })),
      addParcel: (p) => set((s) => ({ parcels: [...s.parcels, p], selectedId: p.id })),
      updateParcel: (id, patch) => set((s) => ({ parcels: s.parcels.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removeParcel: (id) =>
        set((s) => ({
          parcels: s.parcels.filter((p) => p.id !== id),
          entries: s.entries
            .map((e) => ({ ...e, parcelIds: e.parcelIds.filter((x) => x !== id) }))
            .filter((e) => e.parcelIds.length > 0),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),
      select: (id) => set({ selectedId: id }),
      addEntry: (e) => {
        const id = uid();
        set((s) => ({ entries: [...s.entries, { ...e, id, createdAt: new Date().toISOString() }] }));
        return id;
      },
      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      setMapView: (v) => set({ mapView: v }),
      importAll: (data) => set({ farm: { ...defaultFarm, ...data.farm }, parcels: data.parcels ?? [], entries: data.entries ?? [], selectedId: null }),
      reset: () => set({ farm: defaultFarm, parcels: [], entries: [], selectedId: null, mapView: null }),
    }),
    {
      name: "tempero-v1",
      version: 2,
      migrate: (persisted, version) => {
        const st = persisted as { parcels?: Parcel[] };
        if (version < 2 && st?.parcels) st.parcels = st.parcels.map(upgradeParcel);
        return persisted as State;
      },
    },
  ),
);

/** true cuando los datos guardados en el navegador ya están cargados (evita parpadeos). */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const done = () => setH(true);
    if (useStore.persist.hasHydrated()) done();
    const un = useStore.persist.onFinishHydration(done);
    return un;
  }, []);
  return h;
}



/** Datos guardados con la versión 1 → formato actual. */
export function upgradeParcel(p: Parcel): Parcel {
  const cropId = LEGACY[p.cropId] ?? p.cropId;
  const c = cropById(cropId);
  const soilMap: Record<string, string> = { arenoso: "Arenoso", "franco-arenoso": "Franco arenoso", franco: "Franco", "franco-limoso": "Franco limoso", "franco-arcilloso": "Franco arcilloso", arcilloso: "Arcilloso" };
  return {
    ...p,
    cropId,
    sowDate: p.sowDate ?? null,
    spacing: p.spacing ?? (c.agro ? [c.agro.sp[0], c.agro.sp[1]] : [1, 1]),
    coverPct: p.coverPct ?? 50,
    soil: soilMap[p.soil] ?? p.soil ?? "Franco",
    irrigation: { ...DEFAULT_IRRIGATION, ...p.irrigation },
  };
}

export function defaultSow(cropId: string, now = new Date()): string | null {
  const c = cropById(cropId);
  if (!c.agro || c.woody || c.agro.sow == null) return null;
  const m = c.agro.sow - 1;
  const y = m < now.getMonth() - 3 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function newParcel(init: Partial<Parcel> & Pick<Parcel, "geometry" | "areaHa" | "name">): Parcel {
  const cropId = init.cropId ?? "triticum-aestivum";
  const crop = cropById(cropId);
  return {
    id: uid(),
    sigpac: null,
    usoSigpac: null,
    slopePct: null,
    altitudeM: null,
    cropId,
    variety: "",
    sowDate: defaultSow(cropId),
    spacing: crop.agro ? [crop.agro.sp[0], crop.agro.sp[1]] : [1, 1],
    coverPct: 50,
    soil: "Franco",
    vulnerable: false,
    irrigation: { ...DEFAULT_IRRIGATION },
    analysis: { nMinKgHa: null, pOlsenPpm: null, kPpm: null, organicMatterPct: null },
    fert: { yieldT: crop.agro?.y ?? 0, prevLegume: false, organicNKgHa: 0, extraNKgHa: 0, overrides: {} },
    createdAt: new Date().toISOString(),
    ...init,
  };
}
