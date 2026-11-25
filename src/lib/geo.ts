import area from "@turf/area";
import union from "@turf/union";
import centroid from "@turf/centroid";
import bbox from "@turf/bbox";
import { featureCollection, feature } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { Parcel } from "./types";

export const areaHa = (g: Polygon | MultiPolygon) => area(feature(g)) / 10000;

export function mergePolygons(parts: (Polygon | MultiPolygon)[]): Polygon | MultiPolygon | null {
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  try {
    const u = union(featureCollection(parts.map((g) => feature(g))) as never) as Feature<Polygon | MultiPolygon> | null;
    return u ? u.geometry : parts[0];
  } catch {
    return parts[0];
  }
}

export function centerOf(g: Polygon | MultiPolygon): [number, number] {
  const c = centroid(feature(g)).geometry.coordinates;
  return [c[0], c[1]];
}

export function boundsOf(parcels: Parcel[]): [number, number, number, number] | null {
  if (!parcels.length) return null;
  const fc = featureCollection(parcels.map((p) => feature(p.geometry)));
  const b = bbox(fc as never);
  return [b[0], b[1], b[2], b[3]];
}
