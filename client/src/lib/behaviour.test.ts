import { describe, expect, it } from "vitest";
import type { TrackFeature } from "../data/types";
import { behaviourEvents } from "./behaviour";
import { indexTrack } from "./tracks";

const T0 = "2025-01-01T00:00:00Z";
function track(pts: [number, number, number, number][]): TrackFeature {
  // [lon, lat, hours after image, sog]
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: pts.map((p) => [p[0], p[1]]) },
    properties: { mmsi: 1, name: "T", role: "candidate", vessel_type: 70, synthetic: true, t_offset_s: pts.map((p) => p[2] * 3600), sog: pts.map((p) => p[3]) },
  };
}

describe("behaviour events", () => {
  it("finds an AIS gap, loitering and a port entry", () => {
    const ti = indexTrack(track([
      [70.0, 10.0, 0.0, 12], [70.05, 10.0, 0.25, 12], [70.1, 10.0, 0.5, 1], [70.1, 10.0, 0.75, 1], [70.1, 10.0, 1.0, 1],
      [70.2, 10.0, 3.0, 12], [70.3, 10.0, 3.25, 12],
    ]));
    const ev = behaviourEvents({ ti, tImage: T0, windowH: 24, ports: [[70.3, 10.01]], slick: [] });
    const types = ev.map((e) => e.type);
    expect(types).toContain("ais_gap");
    expect(types).toContain("loitering");
    expect(types).toContain("port_entry");
    expect(ev.every((e) => e.derived)).toBe(true);
  });

  it("finds corridor re-entry only after 3 h", () => {
    const ti = indexTrack(track([
      [70.0, 10.0, 0.5, 10], [70.5, 10.0, 2.0, 10], [70.02, 10.0, 4.0, 10], [70.03, 10.0, 4.25, 10],
    ]));
    const ev = behaviourEvents({ ti, tImage: T0, windowH: 24, ports: [], slick: [[70.0, 10.0]] });
    const re = ev.find((e) => e.type === "corridor_reentry");
    expect(re?.t).toBe("2025-01-01T04:00:00.000Z");
  });

  it("returns nothing without post-image fixes", () => {
    const ti = indexTrack(track([[70, 10, -5, 10], [70.1, 10, -4, 10]]));
    expect(behaviourEvents({ ti, tImage: T0, windowH: 24, ports: [], slick: [] })).toHaveLength(0);
  });
});
