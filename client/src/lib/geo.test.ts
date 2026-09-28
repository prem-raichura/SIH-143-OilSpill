import { describe, expect, it } from "vitest";
import { fmtLonLat, parseLatLon } from "./geo";

describe("parseLatLon", () => {
  const close = (p: [number, number] | null, lon: number, lat: number) => {
    expect(p).not.toBeNull();
    expect(p![0]).toBeCloseTo(lon, 4);
    expect(p![1]).toBeCloseTo(lat, 4);
  };
  it("reads decimal lat, lon", () => close(parseLatLon("18.95, 72.83"), 72.83, 18.95));
  it("reads negative decimals", () => close(parseLatLon("-12.5 -45.25"), -45.25, -12.5));
  it("reads degrees and minutes with symbols", () => close(parseLatLon("18°57′N 72°50′E"), 72 + 50 / 60, 18 + 57 / 60));
  it("reads degrees and decimal minutes with hemispheres", () => close(parseLatLon("18 57.0 N 72 49.8 W"), -(72 + 49.8 / 60), 18.95));
  it("reads its own display format", () => close(parseLatLon(fmtLonLat([72.83, 18.95])), 72.83, 18.95));
  it("rejects nonsense and out-of-range values", () => {
    expect(parseLatLon("")).toBeNull();
    expect(parseLatLon("Mumbai")).toBeNull();
    expect(parseLatLon("95, 20")).toBeNull();
    expect(parseLatLon("10 75 N 20 0 E")).toBeNull();
  });
});
