import { describe, expect, it } from "vitest";
import type { ForcingArrows } from "../data/types";
import { advectToImage, sigmaKmFor } from "./drift";
import { buildForcing } from "./forcing";

const T0 = "2025-01-01T00:00:00Z";
function field(cur: [number, number], wind: [number, number]): ForcingArrows {
  const grid: [number, number][] = [];
  for (const y of [9.5, 10, 10.5]) for (const x of [69.5, 70, 70.5]) grid.push([x, y]);
  const frame = (t: string) => ({ t, cur: grid.map(() => cur), wind: grid.map(() => wind) });
  return { grid, units: "m/s", current: "test", wind: "test", frames: [frame("2024-12-31T00:00:00Z"), frame("2025-01-01T00:00:00Z")] };
}

describe("drift-corrected screening", () => {
  it("stays put with no current and no wind", () => {
    const F = buildForcing(field([0, 0], [0, 0]), T0);
    const p = advectToImage(F, [70, 10], -12);
    expect(p[0]).toBeCloseTo(70, 9);
    expect(p[1]).toBeCloseTo(10, 9);
  });

  it("moves north about 3.6 km per hour with a 1 m/s northward current", () => {
    const F = buildForcing(field([0, 1], [0, 0]), T0);
    const p = advectToImage(F, [70, 10], -1);
    expect((p[1] - 10) * 111.195).toBeCloseTo(3.6, 1);
    expect(p[0]).toBeCloseTo(70, 6);
  });

  it("adds 3 % of the wind when there is no separate Stokes drift", () => {
    const F = buildForcing(field([0, 0], [10, 0]), T0);
    const p = advectToImage(F, [70, 10], -1);
    const km = (p[0] - 70) * 111.195 * Math.cos((10 * Math.PI) / 180);
    expect(km).toBeCloseTo(0.3 * 3.6, 1);
  });

  it("sigma grows with age", () => {
    expect(sigmaKmFor(24)).toBeGreaterThan(sigmaKmFor(2));
  });
});
