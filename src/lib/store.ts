"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Entry, Farm, Parcel } from "./types";
import { cropById, IRRIGATION } from "./crops";

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
    { name: "tempero-v1", version: 1 },
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

export function newParcel(init: Partial<Parcel> & Pick<Parcel, "geometry" | "areaHa" | "name">): Parcel {
  const cropId = init.cropId ?? "trigo";
  const crop = cropById(cropId);
  return {
    id: uid(),
    sigpac: null,
    usoSigpac: null,
    slopePct: null,
    altitudeM: null,
    cropId,
    variety: "",
    soil: "franco",
    vulnerable: false,
    irrigation: {
      system: "secano",
      efficiency: IRRIGATION[0].eff,
      emitterFlowLh: 2.2,
      emitterSpacingM: 0.5,
      lineSpacingM: 1,
      rateMmH: 6,
      waterNitrateMgL: 0,
      seasonVolumeM3Ha: 0,
    },
    analysis: { nMinKgHa: null, pOlsenPpm: null, kPpm: null, organicMatterPct: null },
    fert: { yieldT: crop.yieldT, prevLegume: false, organicNKgHa: 0, extraNKgHa: 0, overrides: {} },
    createdAt: new Date().toISOString(),
    ...init,
  };
}
