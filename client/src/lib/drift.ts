// "Pick any ship": a fast drift-corrected track, same idea as the pipeline's screening step.
// Each AIS point before the image is moved to the image time with
//   V = current (circulation + tide) + alpha * wind10,
// using alpha = 3 % because the forcing arrows carry no separate Stokes drift (no Stokes term -> 3-3.5 %).
// A screening approximation only: no spreading, no weathering, coarse 0.5 degree forcing.
import type { LonLat } from "../data/types";
import type { ForcingField } from "./forcing";
import { currentAt, windAt } from "./forcing";
import type { TrackIndex } from "./tracks";

export const DRIFT_ALPHA_NO_STOKES = 0.03;
const STEP_H = 0.25;
const M_PER_DEG_LAT = 111_194.9;

export interface DriftedPoint {
  from: LonLat;
  to: LonLat;
  hoursBefore: number;
  sigmaKm: number;
}

/** Rough 1-sigma for the screening: constant current error 0.1 m/s plus AIS and boundary terms. */
export function sigmaKmFor(hoursBefore: number): number {
  const drift = 0.36 * hoursBefore; // 0.1 m/s -> 0.36 km/h
  return Math.sqrt(drift * drift + 0.5 * 0.5 + 1.0 * 1.0);
}

export function advectToImage(F: ForcingField, p: LonLat, hStart: number, alpha = DRIFT_ALPHA_NO_STOKES): LonLat {
  let x = p[0];
  let y = p[1];
  let h = hStart;
  while (h < 0) {
    const dt = Math.min(STEP_H, -h);
    const c = currentAt(F, [x, y], h);
    const w = windAt(F, [x, y], h);
    const u = c[0] + alpha * w[0];
    const v = c[1] + alpha * w[1];
    const s = dt * 3600;
    y += (v * s) / M_PER_DEG_LAT;
    x += (u * s) / (M_PER_DEG_LAT * Math.cos((y * Math.PI) / 180));
    h += dt;
  }
  return [x, y];
}

/** Drift-correct every AIS fix inside [-maxAgeH, -minAgeH] hours. */
export function driftCorrectTrack(F: ForcingField, ti: TrackIndex, minAgeH: number, maxAgeH: number): DriftedPoint[] {
  const out: DriftedPoint[] = [];
  ti.tH.forEach((h, i) => {
    if (h > -minAgeH || h < -maxAgeH) return;
    const from = ti.coords[i];
    out.push({ from, to: advectToImage(F, from, h), hoursBefore: -h, sigmaKm: sigmaKmFor(-h) });
  });
  return out;
}
