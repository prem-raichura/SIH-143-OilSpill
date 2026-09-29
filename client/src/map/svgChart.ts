// Small SVG map helpers for static charts (report figures, the landing and sign-in chart).
// Equirectangular projection with longitude scaled by cos(latitude): accurate enough at case scale (a few degrees).
import type { Bounds, LonLat } from "../data/types";
import { geometryRings } from "../lib/geo";

const KM_PER_DEG = 111.32;

export interface Projector {
  W: number;
  H: number;
  /** lon/lat to SVG x, y */
  xy: (p: LonLat) => [number, number];
  /** Path through the points; closed for rings. */
  path: (pts: LonLat[], close?: boolean) => string;
  /** The lon/lat window the W x H box shows: west, south, east, north. */
  view: Bounds;
  /** Kilometres per SVG unit (same in x and y). */
  kmPerPx: number;
}

/** Projection centred on a point with a given scale (SVG units per degree of latitude). */
export function centredProjector(center: LonLat, pxPerDeg: number, W: number, H: number): Projector {
  const k = Math.cos((center[1] * Math.PI) / 180);
  const xy = (p: LonLat): [number, number] => [W / 2 + (p[0] - center[0]) * k * pxPerDeg, H / 2 - (p[1] - center[1]) * pxPerDeg];
  const path = (pts: LonLat[], close = false) =>
    pts.length ? `M${pts.map((p) => xy(p).map((v) => v.toFixed(1)).join(",")).join(" L")}${close ? "Z" : ""}` : "";
  const halfLon = W / 2 / (k * pxPerDeg);
  const halfLat = H / 2 / pxPerDeg;
  return {
    W,
    H,
    xy,
    path,
    view: [center[0] - halfLon, center[1] - halfLat, center[0] + halfLon, center[1] + halfLat],
    kmPerPx: KM_PER_DEG / pxPerDeg,
  };
}

/** Projection that fits the bounds inside W x H (centred, aspect kept). */
export function fitProjector([w, s, e, n]: Bounds, W: number, H: number): Projector {
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const pxPerDeg = Math.min(W / Math.max(1e-6, (e - w) * k), H / Math.max(1e-6, n - s));
  return centredProjector([(w + e) / 2, (s + n) / 2], pxPerDeg, W, H);
}

/** Height that keeps the bounds' aspect at width W, clamped to [minH, maxH]. */
export function aspectHeight([w, s, e, n]: Bounds, W: number, minH: number, maxH: number): number {
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  return Math.min(maxH, Math.max(minH, (W * (n - s)) / Math.max(1e-6, (e - w) * k)));
}

/** Bounding box of points, padded by a fraction of its size (and at least minPadDeg). */
export function boundsOf(pts: LonLat[], padFrac = 0.08, minPadDeg = 0.05): Bounds | null {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    if (!isFinite(x) || !isFinite(y)) continue;
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  if (!isFinite(w)) return null;
  const px = Math.max((e - w) * padFrac, minPadDeg);
  const py = Math.max((n - s) * padFrac, minPadDeg);
  return [w - px, s - py, e + px, n + py];
}

/** One path (even-odd fill) for every land ring that reaches into the projector's view. */
export function landPath(land: { features: { geometry: { type: string; coordinates: unknown } }[] } | undefined, proj: Projector): string {
  if (!land) return "";
  const [vw, vs, ve, vn] = proj.view;
  const parts: string[] = [];
  for (const f of land.features) {
    for (const ring of geometryRings(f.geometry)) {
      let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of ring) {
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > n) n = y;
      }
      if (e < vw || w > ve || n < vs || s > vn) continue;
      parts.push(proj.path(ring, true));
    }
  }
  return parts.join(" ");
}

const NICE_KM = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];

/** A round distance (km) that fits in at most maxPx, with its length in SVG units. */
export function scaleBar(proj: Projector, maxPx: number): { km: number; px: number } {
  const km = [...NICE_KM].reverse().find((d) => d / proj.kmPerPx <= maxPx) ?? NICE_KM[0];
  return { km, px: km / proj.kmPerPx };
}
