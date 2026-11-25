"use client";

import { useEffect, useState } from "react";
import type { Parcel } from "./types";
import { climateKey, fetchClimate, type Climate } from "./climate";
import { centerOf } from "./geo";

export function useClimate(parcel: Parcel | null | undefined) {
  const [state, setState] = useState<{ data: Climate | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: false });
  const [lon, lat] = parcel ? centerOf(parcel.geometry) : [0, 0];
  const key = parcel ? climateKey(lat, lon) : "";
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!parcel) return;
    let alive = true;
    setState((s) => ({ data: s.data && climateKey(s.data.lat, s.data.lon) === key ? s.data : null, error: null, loading: true }));
    fetchClimate(lat, lon)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: String(e.message || e), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);
  return { ...state, retry: () => setRetry((r) => r + 1) };
}
