"use client";

import { useEffect, useState } from "react";
import type { Parcel } from "./types";
import { fetchDaily, type DailyWeather } from "./weather";
import { centerOf } from "./geo";

export function useWeather(parcel: Parcel | null | undefined) {
  const [state, setState] = useState<{ data: DailyWeather | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: false });
  const key = parcel ? centerOf(parcel.geometry).map((x) => x.toFixed(3)).join(",") : "";
  useEffect(() => {
    if (!parcel) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    const [lon, lat] = centerOf(parcel.geometry);
    fetchDaily(lat, lon)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: String(e.message || e), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function sumLast(arr: number[], endIndex: number, n: number) {
  let s = 0;
  for (let i = Math.max(0, endIndex - n + 1); i <= endIndex; i++) s += arr[i] ?? 0;
  return s;
}
