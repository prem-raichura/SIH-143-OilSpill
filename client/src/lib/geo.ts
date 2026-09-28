import type { Bounds, LonLat } from "../data/types";

export const EARTH_R_KM = 6371.0088;
export const KM_PER_NM = 1.852;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceKm(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from a to b, degrees clockwise from north, 0..360. */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Point reached from `p` after `km` along `bearing` (spherical). */
export function destination(p: LonLat, bearing: number, km: number): LonLat {
  const d = km / EARTH_R_KM;
  const b = rad(bearing);
  const la1 = rad(p[1]);
  const lo1 = rad(p[0]);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [deg(lo2), deg(la2)];
}

/** Local east/north kilometres around an origin (equirectangular; fine within a few hundred km). */
export function makeEnu(origin: LonLat) {
  const kx = (Math.PI / 180) * EARTH_R_KM * Math.cos(rad(origin[1]));
  const ky = (Math.PI / 180) * EARTH_R_KM;
  return {
    toKm: (p: LonLat): [number, number] => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * ky],
    toLonLat: (x: number, y: number): LonLat => [origin[0] + x / kx, origin[1] + y / ky],
  };
}

/** 8°48.8′N */
export function fmtLat(lat: number): string {
  return `${dm(Math.abs(lat))}${lat >= 0 ? "N" : "S"}`;
}
/** 75°58.6′E */
export function fmtLon(lon: number): string {
  return `${dm(Math.abs(lon))}${lon >= 0 ? "E" : "W"}`;
}
function dm(v: number): string {
  let d = Math.floor(v);
  let m = Math.round((v - d) * 600) / 10;
  if (m >= 60) {
    d += 1;
    m = 0;
  }
  return `${d}°${m.toFixed(1)}′`;
}
export function fmtLonLat(p: LonLat, decimal = false): string {
  return decimal ? `${p[1].toFixed(4)}, ${p[0].toFixed(4)}` : `${fmtLat(p[1])} ${fmtLon(p[0])}`;
}

export function fmtKm(km: number, digits = 1): string {
  if (!isFinite(km)) return "–";
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(digits)} km`;
}
export function fmtKmNm(km: number): string {
  const nm = km / KM_PER_NM;
  return `${fmtKm(km)} (${nm >= 100 ? Math.round(nm) : nm.toFixed(1)} nm)`;
}

export function boundsOf(points: Iterable<LonLat>): Bounds | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of points) {
    if (!isFinite(x) || !isFinite(y)) continue;
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return isFinite(w) ? [w, s, e, n] : null;
}

export function unionBounds(...bs: (Bounds | null | undefined)[]): Bounds | null {
  const ok = bs.filter(Boolean) as Bounds[];
  if (!ok.length) return null;
  return [
    Math.min(...ok.map((b) => b[0])),
    Math.min(...ok.map((b) => b[1])),
    Math.max(...ok.map((b) => b[2])),
    Math.max(...ok.map((b) => b[3])),
  ];
}

export function padBounds(b: Bounds, frac = 0.1): Bounds {
  const dx = (b[2] - b[0]) * frac || 0.05;
  const dy = (b[3] - b[1]) * frac || 0.05;
  return [b[0] - dx, b[1] - dy, b[2] + dx, b[3] + dy];
}

/** Ray-casting point-in-polygon for one ring set (outer + holes). */
export function inPolygon(p: LonLat, rings: LonLat[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function inGeometry(p: LonLat, g: { type: string; coordinates: unknown }): boolean {
  if (g.type === "Polygon") return inPolygon(p, g.coordinates as LonLat[][]);
  if (g.type === "MultiPolygon") return (g.coordinates as LonLat[][][]).some((poly) => inPolygon(p, poly));
  return false;
}

/** Distance (km) from p to the nearest vertex/edge of a set of rings (approximate, planar per segment). */
export function distanceToRingsKm(p: LonLat, rings: LonLat[][]): number {
  const enu = makeEnu(p);
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = enu.toKm(ring[i]);
      const [bx, by] = enu.toKm(ring[i + 1]);
      const dx = bx - ax, dy = by - ay;
      const L = dx * dx + dy * dy;
      const t = L > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  }
  return best;
}

export function geometryRings(g: { type: string; coordinates: unknown }): LonLat[][] {
  if (g.type === "Polygon") return g.coordinates as LonLat[][];
  if (g.type === "MultiPolygon") return (g.coordinates as LonLat[][][]).flat();
  return [];
}

/** Ellipse (as a ring) of points reachable when moving between foci f1 and f2 in time `hours` at `kn` knots. */
export function reachEllipse(f1: LonLat, f2: LonLat, hours: number, kn = 25, steps = 64): LonLat[] | null {
  const mid: LonLat = [(f1[0] + f2[0]) / 2, (f1[1] + f2[1]) / 2];
  const enu = makeEnu(mid);
  const [x1, y1] = enu.toKm(f1);
  const [x2, y2] = enu.toKm(f2);
  const c = Math.hypot(x2 - x1, y2 - y1) / 2;
  const a = (kn * KM_PER_NM * hours) / 2;
  if (a <= c) return null; // could not even cover the direct distance
  const b = Math.sqrt(a * a - c * c);
  const th = Math.atan2(y2 - y1, x2 - x1);
  const ring: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ex = a * Math.cos(t);
    const ey = b * Math.sin(t);
    ring.push(enu.toLonLat(ex * Math.cos(th) - ey * Math.sin(th), ex * Math.sin(th) + ey * Math.cos(th)));
  }
  return ring;
}
