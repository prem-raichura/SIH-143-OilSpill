import { describe, expect, it } from "vitest";
import type { TrackFeature } from "../data/types";
import { reachEllipse, inPolygon, fmtLat, fmtLon } from "./geo";
import { indexTrack, stateAt, splitAt } from "./tracks";
import { backwardRoute } from "./oilroutes";

const track: TrackFeature = {
  type: "Feature",
  geometry: { type: "LineString", coordinates: [[70, 10], [70.1, 10], [70.2, 10], [70.3, 10], [70.4, 10]] },
  properties: { mmsi: 1, name: "T", role: "candidate", vessel_type: 70, synthetic: true, t_offset_s: [-7200, -6600, -6000, 0, 600], sog: [10, 10, 10, 10, 10] },
};

describe("tracks", () => {
  const ti = indexTrack(track);
  it("finds the AIS gap", () => {
    expect(ti.gaps).toHaveLength(1);
    expect(ti.gaps[0].hours).toBeCloseTo(6000 / 3600, 3);
  });
  it("interpolates between fixes and heads east", () => {
    const s = stateAt(ti, (-6600 - 300) / 3600);
    expect(s.status).toBe("moving");
    expect(s.pos[0]).toBeCloseTo(70.05, 3);
    expect(s.bearing).toBeGreaterThan(89);
    expect(s.bearing).toBeLessThan(91);
  });
  it("reports gap and before/after states", () => {
    expect(stateAt(ti, -1).status).toBe("gap");
    expect(stateAt(ti, -3).status).toBe("before");
    expect(stateAt(ti, 2).status).toBe("after");
  });
  it("splits at a time", () => {
    const { travelled, remaining } = splitAt(ti, (-6600 - 300) / 3600);
    expect(travelled.length).toBe(2);
    expect(remaining[0][0]).toBeCloseTo(70.05, 3);
  });
});

describe("geo", () => {
  it("formats chart coordinates", () => {
    expect(fmtLat(8.81412)).toBe("8°48.8′N");
    expect(fmtLon(75.97747)).toBe("75°58.6′E");
  });
  it("reach ellipse contains the midpoint, not a far point", () => {
    const ring = reachEllipse([70, 10], [70.2, 10], 2, 25)!;
    expect(inPolygon([70.1, 10], [ring])).toBe(true);
    expect(inPolygon([71.5, 10], [ring])).toBe(false);
  });
  it("reach ellipse is null when unreachable", () => {
    expect(reachEllipse([70, 10], [72, 10], 1, 25)).toBeNull();
  });
});

describe("oil routes", () => {
  it("mean of a symmetric cloud is its centre", () => {
    const frame = [[1, 1], [-1, -1], [1, -1], [-1, 1]] as [number, number][];
    const r = backwardRoute([frame, frame], 2);
    expect(r.mean[0][0]).toBeCloseTo(0, 6);
    expect(r.hours).toEqual([0, -1]);
    expect(r.members).toHaveLength(2);
  });
});
